import { supplierPaymentRepository } from "./payment.repository";
import { supplierService } from "../suppliers/supplier.service";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { CreateSupplierPaymentInput } from "@idm/shared-validation";
import type { SupplierPayment } from "@idm/shared-types";

function toDto(payment: {
  id: string;
  supplierId: string;
  purchaseInvoiceId: string | null;
  amount: number;
  date: Date;
  method: string;
  notes: string | null;
  createdAt: Date;
}): SupplierPayment {
  return {
    id: payment.id,
    supplierId: payment.supplierId,
    purchaseInvoiceId: payment.purchaseInvoiceId,
    amount: payment.amount,
    date: payment.date.toISOString(),
    method: payment.method as SupplierPayment["method"],
    notes: payment.notes,
    createdAt: payment.createdAt.toISOString(),
  };
}

export const supplierPaymentService = {
  async list(supplierId?: string): Promise<SupplierPayment[]> {
    const payments = await supplierPaymentRepository.findMany(supplierId);
    return payments.map(toDto);
  },

  async create(input: CreateSupplierPaymentInput, actorUserId: string): Promise<SupplierPayment> {
    await supplierService.getByIdOrThrow(input.supplierId);
    const result = input.purchaseInvoiceId
      ? await supplierPaymentRepository.createForInvoice({
          supplier: { connect: { id: input.supplierId } },
          purchaseInvoice: { connect: { id: input.purchaseInvoiceId } },
          amount: input.amount,
          date: input.date,
          method: input.method,
          notes: input.notes ?? null,
        }, input.purchaseInvoiceId)
      : await supplierPaymentRepository.createGeneral({
      supplier: { connect: { id: input.supplierId } },
      amount: input.amount,
      date: input.date,
      method: input.method,
      notes: input.notes ?? null,
    }, input.supplierId);

    if (result.kind === "missing") {
      throw new AppError("فاتورة الشراء غير موجودة لهذا المورد", 404, "PURCHASE_INVOICE_NOT_FOUND");
    }
    if (result.kind === "cancelled") {
      throw new AppError("لا يمكن الدفع على فاتورة شراء ملغاة", 409, "PURCHASE_INVOICE_CANCELLED");
    }
    if (result.kind === "overpayment") {
      throw new AppError(
        input.purchaseInvoiceId ? "المبلغ المدفوع أكبر من المتبقي في الفاتورة" : "المبلغ المدفوع أكبر من المستحق على المورد",
        422,
        input.purchaseInvoiceId ? "PAYMENT_EXCEEDS_INVOICE_BALANCE" : "PAYMENT_EXCEEDS_BALANCE",
      );
    }
    const created = result.payment;

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_SUPPLIER_PAYMENT",
      entityType: "SupplierPayment",
      entityId: created.id,
      newValue: created,
    });

    // Reducing the supplier's outstanding balance happens automatically
    // because the balance is always DERIVED (totalPurchases - totalPaid),
    // never stored — so there is nothing further to "update" here.

    return toDto(created);
  },
};
