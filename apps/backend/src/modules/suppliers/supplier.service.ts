import { supplierRepository } from "./supplier.repository";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { CreateSupplierInput, UpdateSupplierInput } from "@idm/shared-validation";
import type { Supplier, SupplierProfile, SupplierWithBalance } from "@idm/shared-types";

function toDto(supplier: {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Supplier {
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    address: supplier.address,
    notes: supplier.notes,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}

export const supplierService = {
  async list(search?: string): Promise<SupplierWithBalance[]> {
    const suppliers = await supplierRepository.findMany(search);

    return Promise.all(
      suppliers.map(async (supplier) => {
        const totals = await supplierRepository.getFinancialTotals(supplier.id);
        return { ...toDto(supplier), ...totals };
      }),
    );
  },

  async create(input: CreateSupplierInput, actorUserId: string): Promise<Supplier> {
    const existing = await supplierRepository.findByExactName(input.name);
    if (existing) {
      throw new AppError("يوجد مورد آخر بنفس الاسم", 409, "DUPLICATE_SUPPLIER");
    }

    const created = await supplierRepository.create({
      name: input.name,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    });

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_SUPPLIER",
      entityType: "Supplier",
      entityId: created.id,
      newValue: created,
    });

    return toDto(created);
  },

  async update(id: string, input: UpdateSupplierInput, actorUserId: string): Promise<Supplier> {
    const before = await this.getByIdOrThrow(id);

    if (input.name) {
      const existing = await supplierRepository.findByExactName(input.name);
      if (existing && existing.id !== id) {
        throw new AppError("يوجد مورد آخر بنفس الاسم", 409, "DUPLICATE_SUPPLIER");
      }
    }

    const updated = await supplierRepository.update(id, input);

    await auditService.log({
      userId: actorUserId,
      action: "UPDATE_SUPPLIER",
      entityType: "Supplier",
      entityId: id,
      oldValue: toDto(before),
      newValue: toDto(updated),
    });

    return toDto(updated);
  },

  async remove(id: string, actorUserId: string): Promise<void> {
    const before = await this.getByIdOrThrow(id);

    const [purchaseCount, paymentCount, purchaseInvoiceCount] =
      await supplierRepository.hasPurchasesOrPayments(id);
    if (purchaseCount > 0 || paymentCount > 0 || purchaseInvoiceCount > 0) {
      throw new AppError(
        "لا يمكن حذف مورد له مشتريات أو فواتير شراء أو دفعات مسجلة",
        409,
        "SUPPLIER_HAS_TRANSACTIONS",
      );
    }

    await supplierRepository.delete(id);

    await auditService.log({
      userId: actorUserId,
      action: "DELETE_SUPPLIER",
      entityType: "Supplier",
      entityId: id,
      oldValue: toDto(before),
    });
  },

  async getProfile(id: string): Promise<SupplierProfile> {
    const supplier = await supplierRepository.findByIdWithRelations(id);
    if (!supplier) {
      throw new AppError("المورد غير موجود", 404, "SUPPLIER_NOT_FOUND");
    }

    const totals = await supplierRepository.getFinancialTotals(id);

    return {
      supplier: toDto(supplier),
      ...totals,
      purchases: supplier.milkPurchases.map((p) => ({
        id: p.id,
        supplierId: p.supplierId,
        date: p.date.toISOString(),
        quantity: p.quantity,
        pricePerUnit: p.pricePerUnit,
        totalAmount: p.totalAmount,
        paidAmount: p.paidAmount,
        remainingAmount: p.remainingAmount,
        notes: p.notes,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      payments: supplier.payments.map((pay) => ({
        id: pay.id,
        supplierId: pay.supplierId,
        purchaseInvoiceId: pay.purchaseInvoiceId,
        amount: pay.amount,
        date: pay.date.toISOString(),
        method: pay.method as SupplierPayment["method"],
        notes: pay.notes,
        createdAt: pay.createdAt.toISOString(),
      })),
      purchaseInvoices: supplier.purchaseInvoices.map((inv) => ({
        id: inv.id,
        purchaseNumber: inv.purchaseNumber,
        supplierId: inv.supplierId,
        date: inv.date.toISOString(),
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        remainingAmount: inv.remainingAmount,
        paymentMethod: inv.paymentMethod as PurchaseInvoice["paymentMethod"],
        status: inv.status as PurchaseInvoice["status"],
        paymentStatus: inv.paymentStatus as PurchaseInvoice["paymentStatus"],
        notes: inv.notes,
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
        items: inv.items.map((item) => ({
          id: item.id,
          purchaseInvoiceId: item.purchaseInvoiceId,
          productId: item.productId,
          productName: item.product?.name,
          productUnit: item.product?.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      })),
    };
  },

  async getByIdOrThrow(id: string) {
    const supplier = await supplierRepository.findById(id);
    if (!supplier) {
      throw new AppError("المورد غير موجود", 404, "SUPPLIER_NOT_FOUND");
    }
    return supplier;
  },

  /** Used by other modules (e.g. supplier payments) that need just the balance. */
  async getBalance(id: string): Promise<number> {
    await this.getByIdOrThrow(id);
    const totals = await supplierRepository.getFinancialTotals(id);
    return totals.balance;
  },

  /** Total the store owes all suppliers combined — used by the dashboard. */
  async getTotalBalance(): Promise<number> {
    return supplierRepository.getTotalBalance();
  },
};
