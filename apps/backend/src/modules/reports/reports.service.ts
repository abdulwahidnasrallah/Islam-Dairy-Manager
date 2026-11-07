import { reportsRepository } from "./reports.repository";
import { expenseRepository } from "../expenses/expense.repository";
import { customerService } from "../customers/customer.service";
import type {
  PurchasesReport,
  ProfitReport,
  ReportsSummary,
  SalesReport,
} from "@idm/shared-types";

const DEFAULT_TOP_LIMIT = 5;

/** Defaults to the current calendar month when no range is given — same default as the cash register's profit summary. */
export function resolveDateRange(fromStr?: string, toStr?: string): { from: Date; to: Date } {
  const now = new Date();
  // Date-only strings (e.g. "2026-01-01" from a <input type="date">) parse
  // as UTC midnight in JS, so every boundary here is computed in UTC to
  // avoid mixing UTC-parsed input with locale-dependent local time.
  const from = fromStr
    ? new Date(fromStr)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = toStr
    ? new Date(new Date(toStr).getTime() + (24 * 60 * 60 * 1000 - 1))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from, to };
}

export const reportsService = {
  async getSalesReport(from: Date, to: Date): Promise<SalesReport> {
    const [totals, dailyRevenue, topProducts] = await Promise.all([
      reportsRepository.getSalesTotals(from, to),
      reportsRepository.getDailyRevenue(from, to),
      reportsRepository.getTopProducts(from, to, DEFAULT_TOP_LIMIT),
    ]);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      ...totals,
      dailyRevenue: dailyRevenue.map((p) => ({ date: p.date, amount: p.amount })),
      topProducts,
    };
  },

  async getPurchasesReport(from: Date, to: Date): Promise<PurchasesReport> {
    const [totals, purchaseInvoiceTotals, topSuppliers] = await Promise.all([
      reportsRepository.getPurchaseTotals(from, to),
      reportsRepository.getPurchaseInvoiceTotals(from, to),
      reportsRepository.getTopSuppliers(from, to, DEFAULT_TOP_LIMIT),
    ]);

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      ...totals,
      purchaseInvoiceCount: purchaseInvoiceTotals.purchaseInvoiceCount,
      totalPurchaseInvoiceCost: purchaseInvoiceTotals.totalCost,
      totalPurchaseInvoicePaid: purchaseInvoiceTotals.totalPaid,
      totalCombinedCost: totals.totalCost + purchaseInvoiceTotals.totalCost,
      totalCombinedPaid: totals.totalPaid + purchaseInvoiceTotals.totalPaid,
      topSuppliers,
    };
  },

  async getProfitReport(from: Date, to: Date): Promise<ProfitReport> {
    const [salesTotals, purchaseTotals, totalExpenses, cogs] = await Promise.all([
      reportsRepository.getSalesTotals(from, to),
      reportsRepository.getPurchaseTotals(from, to),
      expenseRepository.getTotal(from, to),
      reportsRepository.getCOGS(from, to),
    ]);

    const totalSalesRevenue = salesTotals.totalRevenue;
    const totalMilkPurchaseCost = purchaseTotals.totalCost;

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      totalSalesRevenue,
      totalCOGS: cogs.totalCOGS,
      totalMilkPurchaseCost,
      totalExpenses,
      estimatedProfit: totalSalesRevenue - cogs.totalCOGS - totalExpenses,
      itemsWithoutCost: cogs.itemsWithoutCost,
    };
  },

  /** Debt is a point-in-time snapshot, not tied to the report's date range. */
  async getTopDebtCustomers(limit = DEFAULT_TOP_LIMIT) {
    const withDebt = await customerService.listWithDebt();
    return withDebt
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit)
      .map((c) => ({ customerId: c.id, customerName: c.name, balance: c.balance }));
  },

  async getSummary(fromStr?: string, toStr?: string): Promise<ReportsSummary> {
    const { from, to } = resolveDateRange(fromStr, toStr);

    const [sales, purchases, profit, topDebtCustomers] = await Promise.all([
      this.getSalesReport(from, to),
      this.getPurchasesReport(from, to),
      this.getProfitReport(from, to),
      this.getTopDebtCustomers(),
    ]);

    return { sales, purchases, profit, topDebtCustomers };
  },
};
