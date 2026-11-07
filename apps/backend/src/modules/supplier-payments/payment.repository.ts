import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

export const supplierPaymentRepository = {
  findMany(supplierId?: string) {
    return prisma.supplierPayment.findMany({
      where: supplierId ? { supplierId } : undefined,
      orderBy: { date: "desc" },
    });
  },

  create(data: Prisma.SupplierPaymentCreateInput) {
    return prisma.supplierPayment.create({ data });
  },

  createGeneral(data: Prisma.SupplierPaymentCreateInput, supplierId: string) {
    return prisma.$transaction(async (tx) => {
      const [milk, invoices, payments] = await Promise.all([
        tx.milkPurchase.aggregate({ where: { supplierId }, _sum: { totalAmount: true, paidAmount: true } }),
        tx.purchaseInvoice.aggregate({ where: { supplierId, status: "CONFIRMED" }, _sum: { totalAmount: true, paidAmount: true } }),
        tx.supplierPayment.aggregate({ where: { supplierId, purchaseInvoiceId: null }, _sum: { amount: true } }),
      ]);
      const balance =
        (milk._sum.totalAmount ?? 0) + (invoices._sum.totalAmount ?? 0) -
        (milk._sum.paidAmount ?? 0) - (invoices._sum.paidAmount ?? 0) - (payments._sum.amount ?? 0);
      if (data.amount > balance) return { kind: "overpayment" as const, balance };
      return { kind: "created" as const, payment: await tx.supplierPayment.create({ data }) };
    });
  },

  createForInvoice(data: Prisma.SupplierPaymentCreateInput, invoiceId: string) {
    return prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findUnique({ where: { id: invoiceId } });
      if (!invoice || invoice.supplierId !== data.supplier?.connect?.id) return { kind: "missing" as const };
      if (invoice.status !== "CONFIRMED") return { kind: "cancelled" as const };

      const remaining = invoice.totalAmount - invoice.paidAmount;
      if (data.amount > remaining) return { kind: "overpayment" as const };

      const payment = await tx.supplierPayment.create({ data });
      const paidAmount = invoice.paidAmount + data.amount;
      const paymentStatus = paidAmount === 0 ? "UNPAID" : paidAmount === invoice.totalAmount ? "PAID" : "PARTIALLY_PAID";
      await tx.purchaseInvoice.update({
        where: { id: invoice.id },
        data: { paidAmount, remainingAmount: invoice.totalAmount - paidAmount, paymentStatus },
      });
      return { kind: "created" as const, payment };
    });
  },
};
