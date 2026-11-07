import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

const INVOICE_INCLUDE = {
  items: { include: { product: { select: { name: true } } } },
  customer: { select: { name: true } },
} satisfies Prisma.InvoiceInclude;

export const salesRepository = {
  findMany(customerId?: string) {
    return prisma.invoice.findMany({
      where: customerId ? { customerId } : undefined,
      orderBy: { date: "desc" },
      include: INVOICE_INCLUDE,
    });
  },

  findById(id: string) {
    return prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
  },

  /**
   * Reserves the next sequential invoice number ("INV-000123") inside
   * the given transaction, using the Counter row for key "invoice".
   * Doing this in the SAME transaction as the invoice insert is what
   * makes two concurrent sales unable to collide on the same number.
   */
  async reserveNextInvoiceNumber(tx: Prisma.TransactionClient, prefix: string): Promise<string> {
    const counter = await tx.counter.upsert({
      where: { key: "invoice" },
      update: { value: { increment: 1 } },
      create: { key: "invoice", value: 1 },
    });
    return `${prefix}-${String(counter.value).padStart(6, "0")}`;
  },

  /**
   * Creates the Invoice + its InvoiceItems AND one InventoryMovement
   * (OUT, reason SALE) per line item, all inside a single transaction.
   * A sale can never exist without the matching stock deduction, or
   * vice versa — same guarantee the production module gives for IN.
   * Also reserves the invoice number inside the same transaction.
   */
  createWithMovements(
    invoiceData: Omit<Prisma.InvoiceCreateInput, "invoiceNumber">,
    itemsData: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      unitCost: number | null;
      totalPrice: number;
    }>,
    saleDate: Date,
    invoicePrefix: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.reserveNextInvoiceNumber(tx, invoicePrefix);

      const invoice = await tx.invoice.create({
        data: {
          ...invoiceData,
          invoiceNumber,
          items: {
            create: itemsData.map((item) => ({
              product: { connect: { id: item.productId } },
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: INVOICE_INCLUDE,
      });

      for (const item of itemsData) {
        await tx.inventoryMovement.create({
          data: {
            product: { connect: { id: item.productId } },
            type: "OUT",
            reason: "SALE",
            quantity: item.quantity,
            date: saleDate,
            notes: `بيع — فاتورة ${invoice.invoiceNumber}`,
          },
        });
      }

      return invoice;
    });
  },

  /**
   * Cancels an invoice and reverses its stock effect in one transaction:
   * a compensating InventoryMovement (IN, reason RETURN) per line item
   * puts the sold quantity back into stock. The invoice row itself is
   * never deleted — its status flips to CANCELLED so the historical
   * record (and its audit trail) stays intact, and every financial
   * aggregate that filters `status: "CONFIRMED"` automatically excludes
   * it from sales/cash/debt totals from this point on.
   */
  cancelWithMovements(id: string, cancelledAt: Date) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: INVOICE_INCLUDE,
      });

      for (const item of invoice.items) {
        await tx.inventoryMovement.create({
          data: {
            product: { connect: { id: item.productId } },
            type: "IN",
            reason: "RETURN",
            quantity: item.quantity,
            date: cancelledAt,
            notes: `إلغاء بيع — فاتورة ${invoice.invoiceNumber}`,
          },
        });
      }

      return invoice;
    });
  },
};
