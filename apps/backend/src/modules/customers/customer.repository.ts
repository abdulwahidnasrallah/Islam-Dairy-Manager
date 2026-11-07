import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Only this file talks to Prisma for customers. Services never import
 * `prisma` directly — this keeps the Controller → Service → Repository
 * layering real, not just a folder convention.
 *
 * Every invoice aggregate here filters to `status: "CONFIRMED"` — a
 * cancelled invoice must contribute nothing to a customer's debt, the
 * same way its stock deduction is reversed. See sales.service.ts cancel().
 */
const CONFIRMED_ONLY = { status: "CONFIRMED" as const };

export const customerRepository = {
  findMany(search?: string) {
    return prisma.customer.findMany({
      where: search ? { name: { contains: search } } : undefined,
      orderBy: { createdAt: "desc" },
    });
  },

  findById(id: string) {
    return prisma.customer.findUnique({ where: { id } });
  },

  findByIdWithRelations(id: string) {
    return prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: { orderBy: { date: "desc" }, include: { items: true } },
        payments: { orderBy: { date: "desc" } },
      },
    });
  },

  findByExactName(name: string) {
    return prisma.customer.findFirst({ where: { name } });
  },

  create(data: Prisma.CustomerCreateInput) {
    return prisma.customer.create({ data });
  },

  update(id: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.customer.delete({ where: { id } });
  },

  /** Aggregate totals used to derive the customer's balance on demand. */
  async getFinancialTotals(customerId: string) {
    const [invoiceAgg, paymentAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: { customerId, ...CONFIRMED_ONLY },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.customerPayment.aggregate({
        where: { customerId },
        _sum: { amount: true },
      }),
    ]);

    const totalInvoiced = invoiceAgg._sum.totalAmount ?? 0;
    const totalPaidAtInvoice = invoiceAgg._sum.paidAmount ?? 0;
    const totalSeparatePayments = paymentAgg._sum.amount ?? 0;
    const totalPaid = totalPaidAtInvoice + totalSeparatePayments;

    return {
      totalInvoiced,
      totalPaid,
      balance: totalInvoiced - totalPaid,
    };
  },

  /** Batch version, used by the list/debts pages so they don't do N+1 queries. */
  async getFinancialTotalsMap(customerIds: string[]) {
    if (customerIds.length === 0) return new Map();

    const [invoiceGroups, paymentGroups] = await Promise.all([
      prisma.invoice.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds }, ...CONFIRMED_ONLY },
        _sum: { totalAmount: true, paidAmount: true },
      }),
      prisma.customerPayment.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds } },
        _sum: { amount: true },
      }),
    ]);

    const map = new Map<string, { totalInvoiced: number; totalPaid: number; balance: number }>();
    for (const id of customerIds) map.set(id, { totalInvoiced: 0, totalPaid: 0, balance: 0 });

    for (const row of invoiceGroups) {
      const entry = map.get(row.customerId)!;
      entry.totalInvoiced = row._sum.totalAmount ?? 0;
      entry.totalPaid += row._sum.paidAmount ?? 0;
    }
    for (const row of paymentGroups) {
      const entry = map.get(row.customerId)!;
      entry.totalPaid += row._sum.amount ?? 0;
    }
    for (const entry of map.values()) {
      entry.balance = entry.totalInvoiced - entry.totalPaid;
    }

    return map;
  },

  hasInvoicesOrPayments(customerId: string) {
    return prisma.$transaction([
      prisma.invoice.count({ where: { customerId } }),
      prisma.customerPayment.count({ where: { customerId } }),
    ]);
  },

  /** Total owed by ALL customers combined — used by the dashboard. */
  async getTotalBalance(): Promise<number> {
    const [invoiceAgg, paymentAgg] = await Promise.all([
      prisma.invoice.aggregate({ where: CONFIRMED_ONLY, _sum: { totalAmount: true, paidAmount: true } }),
      prisma.customerPayment.aggregate({ _sum: { amount: true } }),
    ]);

    const totalInvoiced = invoiceAgg._sum.totalAmount ?? 0;
    const totalPaid = (invoiceAgg._sum.paidAmount ?? 0) + (paymentAgg._sum.amount ?? 0);
    return totalInvoiced - totalPaid;
  },
};
