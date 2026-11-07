import { salesRepository } from "./sales.repository";
import { customerService } from "../customers/customer.service";
import { productService } from "../products/product.service";
import { inventoryRepository } from "../inventory/inventory.repository";
import { settingsService } from "../settings/settings.service";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { CreateInvoiceInput } from "@idm/shared-validation";
import type { Invoice, InvoiceDetail } from "@idm/shared-types";

function toDto(invoice: {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customer?: { name: string } | null;
  date: Date;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: string;
    invoiceId: string;
    productId: string;
    product?: { name: string } | null;
    quantity: number;
    unitPrice: number;
    unitCost: number | null;
    totalPrice: number;
  }>;
}): Invoice {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerId: invoice.customerId,
    customerName: invoice.customer?.name,
    date: invoice.date.toISOString(),
    totalAmount: invoice.totalAmount,
    paidAmount: invoice.paidAmount,
    remainingAmount: invoice.remainingAmount,
    status: invoice.status as Invoice["status"],
    notes: invoice.notes,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    items: invoice.items.map((item) => ({
      id: item.id,
      invoiceId: item.invoiceId,
      productId: item.productId,
      productName: item.product?.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      totalPrice: item.totalPrice,
    })),
  };
}

export const salesService = {
  async list(customerId?: string): Promise<Invoice[]> {
    const invoices = await salesRepository.findMany(customerId);
    return invoices.map(toDto);
  },

  async getByIdOrThrow(id: string) {
    const invoice = await salesRepository.findById(id);
    if (!invoice) {
      throw new AppError("الفاتورة غير موجودة", 404, "INVOICE_NOT_FOUND");
    }
    return invoice;
  },

  /** Full, self-contained invoice for the print/view page — includes store info so it doesn't need a second request. */
  async getDetail(id: string): Promise<InvoiceDetail> {
    const invoice = await this.getByIdOrThrow(id);
    const settings = await settingsService.getAll();

    return {
      ...toDto(invoice),
      storeName: settings.STORE_NAME_AR,
      storePhone: settings.STORE_PHONE || null,
      storeAddress: settings.STORE_ADDRESS || null,
      currency: settings.CURRENCY,
    };
  },

  async create(input: CreateInvoiceInput, actorUserId: string): Promise<Invoice> {
    // Confirms the customer exists — throws CUSTOMER_NOT_FOUND otherwise.
    await customerService.getByIdOrThrow(input.customerId);

    // Validate every product exists, is active, and has enough stock
    // BEFORE writing anything. Two lines for the same product in one
    // invoice are summed so the stock check accounts for both together.
    const neededByProduct = new Map<string, number>();
    for (const item of input.items) {
      neededByProduct.set(item.productId, (neededByProduct.get(item.productId) ?? 0) + item.quantity);
    }

    const productById = new Map<string, Awaited<ReturnType<typeof productService.getByIdOrThrow>>>();
    for (const [productId, neededQuantity] of neededByProduct) {
      const product = await productService.getByIdOrThrow(productId);
      productById.set(productId, product);

      if (!product.isActive) {
        throw new AppError(`المنتج "${product.name}" غير نشط ولا يمكن بيعه`, 422, "PRODUCT_INACTIVE");
      }
      const currentStock = await inventoryRepository.getStock(productId);
      if (neededQuantity > currentStock) {
        throw new AppError(
          `الكمية المطلوبة من "${product.name}" (${neededQuantity}) أكبر من المخزون المتوفر (${currentStock})`,
          422,
          "INSUFFICIENT_STOCK",
        );
      }
    }

    // Totals — and each line's cost snapshot — are always computed
    // server-side, never trusted from the client. unitCost is captured
    // NOW (from the product's current costPrice) so later cost changes
    // never retroactively alter what this sale's profit was.
    const itemsData = input.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      unitCost: productById.get(item.productId)?.costPrice ?? null,
      totalPrice: item.quantity * item.unitPrice,
    }));
    const totalAmount = itemsData.reduce((sum, item) => sum + item.totalPrice, 0);

    if (input.paidAmount > totalAmount) {
      throw new AppError("المبلغ المدفوع أكبر من إجمالي الفاتورة", 422, "OVERPAYMENT");
    }

    const settings = await settingsService.getAll();

    const created = await salesRepository.createWithMovements(
      {
        customer: { connect: { id: input.customerId } },
        date: input.date,
        totalAmount,
        paidAmount: input.paidAmount,
        remainingAmount: totalAmount - input.paidAmount,
        notes: input.notes ?? null,
      },
      itemsData,
      input.date,
      settings.INVOICE_PREFIX,
    );

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_INVOICE",
      entityType: "Invoice",
      entityId: created.id,
      newValue: created,
    });

    return toDto(created);
  },

  /**
   * Cancels a confirmed invoice: flips its status to CANCELLED and puts
   * the sold quantities back into stock via a compensating movement.
   * Because every financial aggregate (customer debt, cash register,
   * reports, dashboard) filters to `status: "CONFIRMED"`, this alone is
   * enough to reverse the invoice's effect on cash/debt — no separate
   * refund transaction is needed. The invoice row itself is kept
   * (never deleted) so its history and audit trail survive.
   */
  async cancel(id: string, actorUserId: string): Promise<Invoice> {
    const invoice = await this.getByIdOrThrow(id);

    if (invoice.status === "CANCELLED") {
      throw new AppError("الفاتورة ملغاة مسبقاً", 409, "INVOICE_ALREADY_CANCELLED");
    }

    const cancelled = await salesRepository.cancelWithMovements(id, new Date());

    await auditService.log({
      userId: actorUserId,
      action: "CANCEL_INVOICE",
      entityType: "Invoice",
      entityId: id,
      oldValue: toDto(invoice),
      newValue: toDto(cancelled),
    });

    return toDto(cancelled);
  },
};
