import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

export const supplierPaymentRepository = {
  findMany(supplierId?: string) {
    return prisma.supplierPayment.findMany({
      where: supplierId ? { supplierId } : undefined,
      orderBy: { date: "desc" },
    });
  },

  findByIdempotencyKey(idempotencyKey: string) {
    return prisma.supplierPayment.findUnique({ where: { idempotencyKey } });
  },

  /** General payment (not tied to an invoice) — only the payment row is written. */
  create(data: Prisma.SupplierPaymentCreateInput) {
    return prisma.supplierPayment.create({ data });
  },

  /**
   * Records a payment against ONE purchase invoice: the payment row AND the
   * invoice's new paidAmount / remainingAmount are written in a single
   * transaction, so they can never disagree.
   *
   * The invoice update is conditional on the paidAmount the caller read
   * (optimistic concurrency) and on status CONFIRMED: if a second payment or
   * a cancellation slipped in between the read and this write, nothing is
   * written and `null` is returned — the money can never be applied on top of
   * stale numbers (no double-counted or over-applied payment).
   */
  createLinked(
    data: Prisma.SupplierPaymentCreateInput,
    invoiceId: string,
    expectedPaidAmount: number,
    newPaidAmount: number,
    newRemainingAmount: number,
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseInvoice.updateMany({
        where: { id: invoiceId, status: "CONFIRMED", paidAmount: expectedPaidAmount },
        data: { paidAmount: newPaidAmount, remainingAmount: newRemainingAmount },
      });
      if (updated.count === 0) return null;
      return tx.supplierPayment.create({ data });
    });
  },
};
