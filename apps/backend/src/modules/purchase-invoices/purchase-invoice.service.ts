import { purchaseInvoiceRepository } from "./purchase-invoice.repository";
import { supplierService } from "../suppliers/supplier.service";
import { productService } from "../products/product.service";
import { inventoryRepository } from "../inventory/inventory.repository";
import { settingsService } from "../settings/settings.service";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { CreatePurchaseInvoiceInput } from "@idm/shared-validation";
import { getPurchasePaymentStatus } from "@idm/shared-utils";
import type { PurchaseInvoice, PurchaseInvoiceDetail, SupplierPayment } from "@idm/shared-types";

/** Prisma unique-constraint violation (e.g. the same idempotencyKey sent twice at once). */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/** Fixed prefix for purchase invoice numbers ("PUR-000123") — unlike sales'
 * INVOICE_PREFIX, this is intentionally not a configurable Setting; the
 * feature request only calls for a fixed, distinct sequence separate
 * from sales invoices, and keeping it a constant avoids touching the
 * Settings module for this feature at all. */
const PURCHASE_NUMBER_PREFIX = "PUR";

/** Money is stored as Float; rounding to 2 decimals after every multiply/sum keeps values like 0.1 × 3 from drifting into 0.30000000000000004. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toDto(purchaseInvoice: {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplier?: { name: string } | null;
  date: Date;
  totalAmount: number;
  paidAmount: number;
  initialPaidAmount?: number;
  remainingAmount: number;
  paymentMethod: string;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  payments?: Array<{
    id: string;
    supplierId: string;
    amount: number;
    date: Date;
    method: string;
    notes: string | null;
    purchaseInvoiceId: string | null;
    createdAt: Date;
  }>;
  items: Array<{
    id: string;
    purchaseInvoiceId: string;
    productId: string;
    product?: { name: string; unit: string } | null;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}): PurchaseInvoice {
  return {
    id: purchaseInvoice.id,
    purchaseNumber: purchaseInvoice.purchaseNumber,
    supplierId: purchaseInvoice.supplierId,
    supplierName: purchaseInvoice.supplier?.name,
    date: purchaseInvoice.date.toISOString(),
    totalAmount: purchaseInvoice.totalAmount,
    paidAmount: purchaseInvoice.paidAmount,
    initialPaidAmount: purchaseInvoice.initialPaidAmount ?? purchaseInvoice.paidAmount,
    remainingAmount: purchaseInvoice.remainingAmount,
    paymentMethod: purchaseInvoice.paymentMethod as PurchaseInvoice["paymentMethod"],
    status: purchaseInvoice.status as PurchaseInvoice["status"],
    paymentStatus: getPurchasePaymentStatus(purchaseInvoice.totalAmount, purchaseInvoice.paidAmount),
    payments: (purchaseInvoice.payments ?? []).map((pay) => ({
      id: pay.id,
      supplierId: pay.supplierId,
      amount: pay.amount,
      date: pay.date.toISOString(),
      method: pay.method as SupplierPayment["method"],
      notes: pay.notes,
      purchaseInvoiceId: pay.purchaseInvoiceId,
      createdAt: pay.createdAt.toISOString(),
    })),
    notes: purchaseInvoice.notes,
    createdAt: purchaseInvoice.createdAt.toISOString(),
    updatedAt: purchaseInvoice.updatedAt.toISOString(),
    items: purchaseInvoice.items.map((item) => ({
      id: item.id,
      purchaseInvoiceId: item.purchaseInvoiceId,
      productId: item.productId,
      productName: item.product?.name,
      productUnit: item.product?.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    })),
  };
}

export const purchaseInvoiceService = {
  async list(supplierId?: string): Promise<PurchaseInvoice[]> {
    const purchaseInvoices = await purchaseInvoiceRepository.findMany(supplierId);
    return purchaseInvoices.map(toDto);
  },

  async getByIdOrThrow(id: string) {
    const purchaseInvoice = await purchaseInvoiceRepository.findById(id);
    if (!purchaseInvoice) {
      throw new AppError("فاتورة الشراء غير موجودة", 404, "PURCHASE_INVOICE_NOT_FOUND");
    }
    return purchaseInvoice;
  },

  /** Full, self-contained purchase invoice for the print/view page — includes store info, same idea as sales' getDetail(). */
  async getDetail(id: string): Promise<PurchaseInvoiceDetail> {
    const purchaseInvoice = await this.getByIdOrThrow(id);
    const settings = await settingsService.getAll();

    return {
      ...toDto(purchaseInvoice),
      storeName: settings.STORE_NAME_AR,
      storePhone: settings.STORE_PHONE || null,
      storeAddress: settings.STORE_ADDRESS || null,
      currency: settings.CURRENCY,
    };
  },

  async create(input: CreatePurchaseInvoiceInput, actorUserId: string): Promise<PurchaseInvoice> {
    // Idempotency: a re-sent request (double click, retry after a timeout)
    // returns the invoice that was already created — no second invoice, no
    // second stock increase, no second debt.
    if (input.idempotencyKey) {
      const existing = await purchaseInvoiceRepository.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return toDto(existing);
    }

    // Confirms the supplier exists — throws SUPPLIER_NOT_FOUND otherwise.
    await supplierService.getByIdOrThrow(input.supplierId);

    // Confirm every product exists BEFORE writing anything. Unlike a
    // sale, a purchase never needs a stock-sufficiency check (it only
    // ever adds stock), and unlike selling, an inactive product can
    // still be restocked via a purchase — isActive only gates whether
    // a product can be SOLD, not whether it can be bought back into
    // stock.
    for (const item of input.items) {
      await productService.getByIdOrThrow(item.productId);
    }

    // Totals are always computed server-side, never trusted from the client.
    const itemsData = input.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: round2(item.quantity * item.unitPrice),
    }));
    const totalAmount = round2(itemsData.reduce((sum, item) => sum + item.totalPrice, 0));
    const paidAmount = round2(input.paidAmount);

    if (paidAmount > totalAmount) {
      throw new AppError("المبلغ المدفوع أكبر من إجمالي فاتورة الشراء", 422, "OVERPAYMENT");
    }

    let created;
    try {
      created = await purchaseInvoiceRepository.createWithMovements(
        {
          supplier: { connect: { id: input.supplierId } },
          date: input.date,
          totalAmount,
          paidAmount,
          initialPaidAmount: paidAmount,
          remainingAmount: round2(totalAmount - paidAmount),
          paymentMethod: input.paymentMethod,
          notes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
        },
        itemsData,
        input.date,
        PURCHASE_NUMBER_PREFIX,
      );
    } catch (err) {
      // Two identical requests raced: the unique key let exactly one win and
      // rolled the other back (including its stock movements). Return the winner.
      if (input.idempotencyKey && isUniqueViolation(err)) {
        const winner = await purchaseInvoiceRepository.findByIdempotencyKey(input.idempotencyKey);
        if (winner) return toDto(winner);
      }
      throw err;
    }

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_PURCHASE_INVOICE",
      entityType: "PurchaseInvoice",
      entityId: created.id,
      newValue: created,
    });

    return toDto(created);
  },

  /**
   * Cancels a confirmed purchase invoice: flips its status to CANCELLED
   * and removes the purchased quantities back out of stock. Because
   * every financial aggregate (supplier balance, cash register,
   * reports, dashboard) filters to `status: "CONFIRMED"`, this alone is
   * enough to reverse the invoice's effect on cash/debt — no separate
   * transaction is needed for that part. Unlike cancelling a SALE
   * (which only ever adds stock back and can never fail), cancelling a
   * PURCHASE removes stock that may have already been used/sold since
   * — so this checks every item still has enough stock to reverse
   * BEFORE touching anything, and rejects clearly if not.
   */
  async cancel(id: string, actorUserId: string): Promise<PurchaseInvoice> {
    const purchaseInvoice = await this.getByIdOrThrow(id);

    if (purchaseInvoice.status === "CANCELLED") {
      throw new AppError("فاتورة الشراء ملغاة مسبقاً", 409, "PURCHASE_INVOICE_ALREADY_CANCELLED");
    }

    // Two lines for the same product are summed so the check compares
    // the TOTAL quantity this invoice added against current stock.
    const purchasedByProduct = new Map<string, number>();
    for (const item of purchaseInvoice.items) {
      purchasedByProduct.set(item.productId, (purchasedByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    for (const [productId, purchasedQuantity] of purchasedByProduct) {
      const currentStock = await inventoryRepository.getStock(productId);
      if (purchasedQuantity > currentStock) {
        const product = await productService.getByIdOrThrow(productId);
        throw new AppError(
          `لا يمكن إلغاء الفاتورة — الكمية المتوفرة حالياً من "${product.name}" (${currentStock}) أقل من الكمية المشتراة في هذه الفاتورة (${purchasedQuantity})، على الأغلب لأنها بيعت أو استُهلكت جزئياً`,
          422,
          "INSUFFICIENT_STOCK_TO_CANCEL",
        );
      }
    }

    const cancelled = await purchaseInvoiceRepository.cancelWithMovements(id, new Date());
    if (!cancelled) {
      // Lost a race with another cancel request that flipped the status first.
      throw new AppError("فاتورة الشراء ملغاة مسبقاً", 409, "PURCHASE_INVOICE_ALREADY_CANCELLED");
    }

    await auditService.log({
      userId: actorUserId,
      action: "CANCEL_PURCHASE_INVOICE",
      entityType: "PurchaseInvoice",
      entityId: id,
      oldValue: toDto(purchaseInvoice),
      newValue: toDto(cancelled),
    });

    return toDto(cancelled);
  },
};
