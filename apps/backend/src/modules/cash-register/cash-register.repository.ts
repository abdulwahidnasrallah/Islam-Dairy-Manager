import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

/**
 * This repository is a read-only projection over tables owned by other
 * modules (sales, milk purchases, supplier purchase invoices, supplier/customer payments, expenses)
 * plus its own CashAdjustment table. It never writes to another
 * module's table — only aggregates and lists what's already there, so
 * there is exactly one place each cash movement is created.
 *
 * Every invoice query filters to `status: "CONFIRMED"` — a cancelled
 * sale must not count as cash in, the same way it's excluded from
 * revenue and customer debt. See sales.service.ts cancel().
 */
const CONFIRMED_INVOICE = { status: "CONFIRMED" as const };

/**
 * Supplier PurchaseInvoice rows follow the same rule as sales: only
 * CONFIRMED ones count as cash out. A cancelled purchase invoice is
 * treated as never having happened for cash purposes. MilkPurchase has
 * no status (it is never cancelled) and is queried separately, so the
 * two purchase types can never be counted twice.
 */
const CONFIRMED_PURCHASE_INVOICE = { status: "CONFIRMED" as const };

export const cashRegisterRepository = {
  async getTotals(from?: Date, to?: Date) {
    const dateFilter = from || to ? { date: { gte: from, lte: to } } : undefined;

    const [
      supplierPaymentsAgg,
      milkPurchaseAgg,
      purchaseInvoiceAgg,
      customerPaymentsAgg,
      invoiceAgg,
      expenseAgg,
      adjInAgg,
      adjOutAgg,
    ] =
      await Promise.all([
        prisma.supplierPayment.aggregate({ where: dateFilter, _sum: { amount: true } }),
        prisma.milkPurchase.aggregate({ where: dateFilter, _sum: { paidAmount: true } }),
        prisma.purchaseInvoice.aggregate({
          where: { ...dateFilter, ...CONFIRMED_PURCHASE_INVOICE },
          _sum: { paidAmount: true },
        }),
        prisma.customerPayment.aggregate({ where: dateFilter, _sum: { amount: true } }),
        prisma.invoice.aggregate({
          where: { ...dateFilter, ...CONFIRMED_INVOICE },
          _sum: { paidAmount: true, totalAmount: true },
        }),
        prisma.expense.aggregate({ where: dateFilter, _sum: { amount: true } }),
        prisma.cashAdjustment.aggregate({
          where: { ...dateFilter, type: "IN" },
          _sum: { amount: true },
        }),
        prisma.cashAdjustment.aggregate({
          where: { ...dateFilter, type: "OUT" },
          _sum: { amount: true },
        }),
      ]);

    return {
      supplierPayments: supplierPaymentsAgg._sum.amount ?? 0,
      milkPurchasePaid: milkPurchaseAgg._sum.paidAmount ?? 0,
      purchaseInvoicePaid: purchaseInvoiceAgg._sum.paidAmount ?? 0,
      customerPayments: customerPaymentsAgg._sum.amount ?? 0,
      invoicePaid: invoiceAgg._sum.paidAmount ?? 0,
      invoiceTotal: invoiceAgg._sum.totalAmount ?? 0,
      expenses: expenseAgg._sum.amount ?? 0,
      cashAdjustmentsIn: adjInAgg._sum.amount ?? 0,
      cashAdjustmentsOut: adjOutAgg._sum.amount ?? 0,
    };
  },

  /** Recent rows from every source table, merged and sorted by date — read-only, for display only. */
  async getRecentMovements(limit: number) {
    const [supplierPayments, milkPurchases, purchaseInvoices, customerPayments, invoices, expenses, adjustments] =
      await Promise.all([
        prisma.supplierPayment.findMany({
          orderBy: { date: "desc" },
          take: limit,
          include: { supplier: { select: { name: true } } },
          where: { purchaseInvoiceId: null },
        }),
        prisma.milkPurchase.findMany({
          orderBy: { date: "desc" },
          take: limit,
          include: { supplier: { select: { name: true } } },
          where: { paidAmount: { gt: 0 } },
        }),
        prisma.purchaseInvoice.findMany({
          orderBy: { date: "desc" },
          take: limit,
          include: { supplier: { select: { name: true } } },
          where: { paidAmount: { gt: 0 }, ...CONFIRMED_PURCHASE_INVOICE },
        }),
        prisma.customerPayment.findMany({
          orderBy: { date: "desc" },
          take: limit,
          include: { customer: { select: { name: true } } },
        }),
        prisma.invoice.findMany({
          orderBy: { date: "desc" },
          take: limit,
          include: { customer: { select: { name: true } } },
          where: { paidAmount: { gt: 0 }, ...CONFIRMED_INVOICE },
        }),
        prisma.expense.findMany({ orderBy: { date: "desc" }, take: limit }),
        prisma.cashAdjustment.findMany({ orderBy: { date: "desc" }, take: limit }),
      ]);

    const expenseCategoryLabels: Record<string, string> = {
      RENT: "إيجار",
      SALARIES: "رواتب",
      UTILITIES: "خدمات",
      TRANSPORT: "نقل",
      MAINTENANCE: "صيانة",
      OTHER: "أخرى",
    };

    const movements = [
      ...supplierPayments.map((p) => ({
        date: p.date,
        type: "OUT" as const,
        source: "دفعة لمورد",
        description: p.supplier.name,
        amount: p.amount,
      })),
      ...milkPurchases.map((p) => ({
        date: p.date,
        type: "OUT" as const,
        source: "شراء حليب",
        description: p.supplier.name,
        amount: p.paidAmount,
      })),
      ...purchaseInvoices.map((p) => ({
        date: p.date,
        type: "OUT" as const,
        source: "فاتورة شراء",
        description: `${p.supplier.name} — ${p.purchaseNumber}`,
        amount: p.paidAmount,
      })),
      ...customerPayments.map((p) => ({
        date: p.date,
        type: "IN" as const,
        source: "دفعة من زبون",
        description: p.customer.name,
        amount: p.amount,
      })),
      ...invoices.map((inv) => ({
        date: inv.date,
        type: "IN" as const,
        source: "بيع",
        description: inv.customer.name,
        amount: inv.paidAmount,
      })),
      ...expenses.map((e) => ({
        date: e.date,
        type: "OUT" as const,
        source: "مصروف",
        description: expenseCategoryLabels[e.category] ?? e.category,
        amount: e.amount,
      })),
      ...adjustments.map((a) => ({
        date: a.date,
        type: a.type as "IN" | "OUT",
        source: "تسوية يدوية",
        description: a.reason,
        amount: a.amount,
      })),
    ];

    return movements.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
  },

  createAdjustment(data: Prisma.CashAdjustmentCreateInput) {
    return prisma.cashAdjustment.create({ data });
  },
};
