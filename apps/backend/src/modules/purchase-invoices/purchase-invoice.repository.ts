import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

const PURCHASE_INVOICE_INCLUDE = {
  items: { include: { product: { select: { name: true, unit: true } } } },
  supplier: { select: { name: true } },
} satisfies Prisma.PurchaseInvoiceInclude;

export const purchaseInvoiceRepository = {
  findMany(supplierId?: string) {
    return prisma.purchaseInvoice.findMany({
      where: supplierId ? { supplierId } : undefined,
      orderBy: { date: "desc" },
      include: PURCHASE_INVOICE_INCLUDE,
    });
  },

  findById(id: string) {
    return prisma.purchaseInvoice.findUnique({ where: { id }, include: PURCHASE_INVOICE_INCLUDE });
  },

  /**
   * Reserves the next sequential purchase number ("PUR-000123") inside
   * the given transaction, using the Counter row for key "purchase" —
   * a DIFFERENT key from sales invoices' "invoice" key, so the two
   * numbering sequences can never collide or interfere with each other
   * even though they share the same Counter model.
   */
  async reserveNextPurchaseNumber(tx: Prisma.TransactionClient, prefix: string): Promise<string> {
    const counter = await tx.counter.upsert({
      where: { key: "purchase" },
      update: { value: { increment: 1 } },
      create: { key: "purchase", value: 1 },
    });
    return `${prefix}-${String(counter.value).padStart(6, "0")}`;
  },

  /**
   * Creates the PurchaseInvoice + its items AND one InventoryMovement
   * (IN, reason PURCHASE) per line item, all inside a single
   * transaction — a purchase can never exist without the matching
   * stock increase, or vice versa. Mirrors sales.repository.ts's
   * createWithMovements() exactly, but IN instead of OUT, and no
   * unitCost (see the note on PurchaseInvoiceItem in schema.prisma).
   */
  createWithMovements(
    purchaseData: Omit<Prisma.PurchaseInvoiceCreateInput, "purchaseNumber">,
    itemsData: Array<{ productId: string; quantity: number; unitPrice: number; totalPrice: number }>,
    purchaseDate: Date,
    purchasePrefix: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const purchaseNumber = await this.reserveNextPurchaseNumber(tx, purchasePrefix);

      const purchaseInvoice = await tx.purchaseInvoice.create({
        data: {
          ...purchaseData,
          purchaseNumber,
          items: {
            create: itemsData.map((item) => ({
              product: { connect: { id: item.productId } },
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: PURCHASE_INVOICE_INCLUDE,
      });

      for (const item of itemsData) {
        await tx.inventoryMovement.create({
          data: {
            product: { connect: { id: item.productId } },
            type: "IN",
            reason: "PURCHASE",
            quantity: item.quantity,
            date: purchaseDate,
            notes: `شراء — فاتورة ${purchaseInvoice.purchaseNumber}`,
          },
        });
      }

      return purchaseInvoice;
    });
  },

  /**
   * Cancels a purchase invoice and reverses its stock effect in one
   * transaction: a compensating InventoryMovement (OUT, reason
   * PURCHASE_CANCELLED) per line item removes the purchased quantity
   * back out of stock. The row itself is never deleted — its status
   * flips to CANCELLED so the historical record (and its audit trail)
   * stays intact, and every financial aggregate that filters
   * `status: "CONFIRMED"` automatically excludes it from purchase/cash/
   * debt totals from this point on. Mirrors
   * sales.repository.ts's cancelWithMovements().
   *
   * The status flip is a conditional updateMany (WHERE status =
   * 'CONFIRMED'), so two concurrent cancel requests can never both
   * succeed and reverse the stock twice — the loser gets `null`.
   */
  cancelWithMovements(id: string, cancelledAt: Date) {
    return prisma.$transaction(async (tx) => {
      const flipped = await tx.purchaseInvoice.updateMany({
        where: { id, status: "CONFIRMED" },
        data: { status: "CANCELLED" },
      });
      if (flipped.count === 0) return null;

      const purchaseInvoice = await tx.purchaseInvoice.findUniqueOrThrow({
        where: { id },
        include: PURCHASE_INVOICE_INCLUDE,
      });

      for (const item of purchaseInvoice.items) {
        await tx.inventoryMovement.create({
          data: {
            product: { connect: { id: item.productId } },
            type: "OUT",
            reason: "PURCHASE_CANCELLED",
            quantity: item.quantity,
            date: cancelledAt,
            notes: `إلغاء شراء — فاتورة ${purchaseInvoice.purchaseNumber}`,
          },
        });
      }

      // Keep payments already made as supplier credits after cancellation.
      // Otherwise they would disappear from the supplier balance and cash ledger.
      await tx.supplierPayment.updateMany({
        where: { purchaseInvoiceId: id },
        data: { purchaseInvoiceId: null },
      });

      return purchaseInvoice;
    });
  },
};
