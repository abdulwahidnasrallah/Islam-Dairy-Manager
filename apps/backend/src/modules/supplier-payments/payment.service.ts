import { supplierPaymentRepository } from "./payment.repository";
import { purchaseInvoiceRepository } from "../purchase-invoices/purchase-invoice.repository";
import { supplierService } from "../suppliers/supplier.service";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import { roundMoney } from "@idm/shared-utils";
import type { CreateSupplierPaymentInput } from "@idm/shared-validation";
import type { SupplierPayment } from "@idm/shared-types";

function toDto(payment: {
  id: string;
  supplierId: string;
  amount: number;
  date: Date;
  method: string;
  notes: string | null;
  purchaseInvoiceId?: string | null;
  createdAt: Date;
}): SupplierPayment {
  return {
    id: payment.id,
    supplierId: payment.supplierId,
    amount: payment.amount,
    date: payment.date.toISOString(),
    method: payment.method as SupplierPayment["method"],
    notes: payment.notes,
    purchaseInvoiceId: payment.purchaseInvoiceId ?? null,
    createdAt: payment.createdAt.toISOString(),
  };
}

/** Prisma unique-constraint violation (the same idempotencyKey sent twice at once). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export const supplierPaymentService = {
  async list(supplierId?: string): Promise<SupplierPayment[]> {
    const payments = await supplierPaymentRepository.findMany(supplierId);
    return payments.map(toDto);
  },

  async create(input: CreateSupplierPaymentInput, actorUserId: string): Promise<SupplierPayment> {
    // Idempotency: the same key always returns the payment already recorded —
    // never a second payment.
    if (input.idempotencyKey) {
      const existing = await supplierPaymentRepository.findByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        if (existing.supplierId !== input.supplierId) {
          throw new AppError("مفتاح العملية مستخدم لدفعة مورد آخر", 409, "IDEMPOTENCY_KEY_CONFLICT");
        }
        return toDto(existing);
      }
    }

    const amount = roundMoney(input.amount);
    // Confirms the supplier exists — throws SUPPLIER_NOT_FOUND otherwise.
    const balance = await supplierService.getBalance(input.supplierId);

    if (input.purchaseInvoiceId) {
      return this.createForInvoice({ ...input, amount }, input.purchaseInvoiceId, actorUserId);
    }

    if (amount > balance) {
      throw new AppError("المبلغ المدفوع أكبر من المستحق على المورد", 422, "PAYMENT_EXCEEDS_BALANCE");
    }

    let created;
    try {
      created = await supplierPaymentRepository.create({
        supplier: { connect: { id: input.supplierId } },
        amount,
        date: input.date,
        method: input.method,
        notes: input.notes ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      });
    } catch (err) {
      if (input.idempotencyKey && isUniqueViolation(err)) {
        const winner = await supplierPaymentRepository.findByIdempotencyKey(input.idempotencyKey);
        if (winner) return toDto(winner);
      }
      throw err;
    }

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_SUPPLIER_PAYMENT",
      entityType: "SupplierPayment",
      entityId: created.id,
      newValue: created,
    });

    // The balance is always DERIVED (totalPurchases - totalPaid), never stored,
    // so a general payment reduces it automatically.
    return toDto(created);
  },

  /**
   * A payment that settles one specific purchase invoice. It raises the
   * invoice's paidAmount and lowers its remainingAmount (status UNPAID →
   * PARTIAL → PAID follows automatically). The supplier balance counts it
   * through the invoice, so it is NOT subtracted a second time as a separate
   * payment (see supplier.repository.ts).
   */
  async createForInvoice(
    input: CreateSupplierPaymentInput,
    purchaseInvoiceId: string,
    actorUserId: string,
  ): Promise<SupplierPayment> {
    const invoice = await purchaseInvoiceRepository.findById(purchaseInvoiceId);
    if (!invoice) {
      throw new AppError("فاتورة الشراء غير موجودة", 404, "PURCHASE_INVOICE_NOT_FOUND");
    }
    if (invoice.supplierId !== input.supplierId) {
      throw new AppError("هذه الفاتورة لا تخص المورد المحدد", 422, "INVOICE_SUPPLIER_MISMATCH");
    }
    if (invoice.status !== "CONFIRMED") {
      throw new AppError("لا يمكن تسجيل دفعة على فاتورة ملغاة", 409, "PURCHASE_INVOICE_CANCELLED");
    }
    if (input.amount > roundMoney(invoice.remainingAmount)) {
      throw new AppError(
        `المبلغ أكبر من المتبقي على الفاتورة (${roundMoney(invoice.remainingAmount)})`,
        422,
        "PAYMENT_EXCEEDS_INVOICE_REMAINING",
      );
    }

    const newPaid = roundMoney(invoice.paidAmount + input.amount);
    const newRemaining = roundMoney(invoice.totalAmount - newPaid);

    let created;
    try {
      created = await supplierPaymentRepository.createLinked(
        {
          supplier: { connect: { id: input.supplierId } },
          purchaseInvoice: { connect: { id: purchaseInvoiceId } },
          amount: input.amount,
          date: input.date,
          method: input.method,
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
        },
        purchaseInvoiceId,
        invoice.paidAmount,
        newPaid,
        newRemaining,
      );
    } catch (err) {
      if (input.idempotencyKey && isUniqueViolation(err)) {
        const winner = await supplierPaymentRepository.findByIdempotencyKey(input.idempotencyKey);
        if (winner) return toDto(winner);
      }
      throw err;
    }

    if (!created) {
      // The conditional update failed. If that is because an identical request
      // (same idempotencyKey) just won the race, return ITS payment rather than
      // reporting a conflict — a double submit must look like a single one.
      if (input.idempotencyKey) {
        const winner = await supplierPaymentRepository.findByIdempotencyKey(input.idempotencyKey);
        if (winner) return toDto(winner);
      }
      throw new AppError(
        "تغيّرت الفاتورة أثناء العملية (دفعة أخرى أو إلغاء) — أعد المحاولة",
        409,
        "PURCHASE_INVOICE_CHANGED",
      );
    }

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_SUPPLIER_PAYMENT",
      entityType: "SupplierPayment",
      entityId: created.id,
      newValue: { ...created, invoiceNumber: invoice.purchaseNumber, invoicePaidAfter: newPaid, invoiceRemainingAfter: newRemaining },
    });

    return toDto(created);
  },
};
