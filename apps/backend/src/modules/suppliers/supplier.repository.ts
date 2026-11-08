import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Only this file talks to Prisma for suppliers. Services never import
 * `prisma` directly — this keeps the Controller → Service → Repository
 * layering real, not just a folder convention.
 *
 * Every PurchaseInvoice aggregate here filters to
 * `status: "CONFIRMED"` — a cancelled purchase invoice must contribute
 * nothing to a supplier's balance, the same way its stock increase is
 * reversed. See purchase-invoice.service.ts cancel(). MilkPurchase has
 * no such status field (it is never cancelled), so it is always
 * included as-is, exactly like before this feature existed.
 */
const CONFIRMED_PURCHASE_INVOICE = { status: "CONFIRMED" as const };

/**
 * A SupplierPayment linked to a purchase invoice is ALSO included in that
 * invoice's paidAmount (same transaction), so the invoice aggregate already
 * counts it. Only UNLINKED payments are "separate" payments here — counting
 * the linked ones again would subtract the same money twice. Linked payments
 * of a cancelled invoice vanish together with the invoice.
 */
const GENERAL_PAYMENT = { purchaseInvoiceId: null } as const;

export const supplierRepository = {
  findMany(search?: string) {
    return prisma.supplier.findMany({
      where: search
        ? { name: { contains: search } }
        : undefined,
      orderBy: { createdAt: "desc" },
    });
  },

  findById(id: string) {
    return prisma.supplier.findUnique({ where: { id } });
  },

  findByIdWithRelations(id: string) {
    return prisma.supplier.findUnique({
      where: { id },
      include: {
        milkPurchases: { orderBy: { date: "desc" } },
        payments: { orderBy: { date: "desc" } },
        purchaseInvoices: {
          orderBy: { date: "desc" },
          include: { items: { include: { product: { select: { name: true, unit: true } } } } },
        },
      },
    });
  },

  findByExactName(name: string) {
    return prisma.supplier.findFirst({ where: { name } });
  },

  create(data: Prisma.SupplierCreateInput) {
    return prisma.supplier.create({ data });
  },

  update(id: string, data: Prisma.SupplierUpdateInput) {
    return prisma.supplier.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.supplier.delete({ where: { id } });
  },

  /**
   * Aggregate totals used to derive the supplier's balance on demand —
   * now combining MilkPurchase (raw milk deliveries) and PurchaseInvoice
   * (tracked-Product purchases, CONFIRMED only) into the SAME balance,
   * since both represent money the store owes this supplier.
   */
  async getFinancialTotals(supplierId: string) {
    const [purchaseAgg, purchaseInvoiceAgg, paymentAgg] = await Promise.all([
      prisma.milkPurchase.aggregate({
        where: { supplierId },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.purchaseInvoice.aggregate({
        where: { supplierId, ...CONFIRMED_PURCHASE_INVOICE },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.supplierPayment.aggregate({
        where: { supplierId, ...GENERAL_PAYMENT },
        _sum: { amount: true },
      }),
    ]);

    const totalPurchases =
      (purchaseAgg._sum.totalAmount ?? 0) + (purchaseInvoiceAgg._sum.totalAmount ?? 0);
    const totalPaidAtPurchase =
      (purchaseAgg._sum.paidAmount ?? 0) + (purchaseInvoiceAgg._sum.paidAmount ?? 0);
    const totalSeparatePayments = paymentAgg._sum.amount ?? 0;
    const totalPaid = totalPaidAtPurchase + totalSeparatePayments;

    return {
      totalPurchases,
      totalPaid,
      balance: totalPurchases - totalPaid,
    };
  },

  hasPurchasesOrPayments(supplierId: string) {
    return prisma.$transaction([
      prisma.milkPurchase.count({ where: { supplierId } }),
      prisma.supplierPayment.count({ where: { supplierId } }),
      prisma.purchaseInvoice.count({ where: { supplierId } }),
    ]);
  },

  /**
   * Total the store owes ALL suppliers combined — used by the
   * dashboard. Same MilkPurchase + PurchaseInvoice (CONFIRMED only)
   * combination as getFinancialTotals(), just summed across every
   * supplier instead of one.
   */
  async getTotalBalance(): Promise<number> {
    const [purchaseAgg, purchaseInvoiceAgg, paymentAgg] = await Promise.all([
      prisma.milkPurchase.aggregate({ _sum: { totalAmount: true, paidAmount: true } }),
      prisma.purchaseInvoice.aggregate({
        where: CONFIRMED_PURCHASE_INVOICE,
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.supplierPayment.aggregate({ where: GENERAL_PAYMENT, _sum: { amount: true } }),
    ]);

    const totalPurchases =
      (purchaseAgg._sum.totalAmount ?? 0) + (purchaseInvoiceAgg._sum.totalAmount ?? 0);
    const totalPaid =
      (purchaseAgg._sum.paidAmount ?? 0) +
      (purchaseInvoiceAgg._sum.paidAmount ?? 0) +
      (paymentAgg._sum.amount ?? 0);
    return totalPurchases - totalPaid;
  },
};
