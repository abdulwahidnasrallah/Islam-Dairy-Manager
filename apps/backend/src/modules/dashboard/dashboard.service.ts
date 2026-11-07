import { cashRegisterService } from "../cash-register/cash-register.service";
import { customerService } from "../customers/customer.service";
import { supplierService } from "../suppliers/supplier.service";
import { inventoryService } from "../inventory/inventory.service";
import { reportsService } from "../reports/reports.service";
import { dailyClosingService } from "../daily-closing/daily-closing.service";
import type { DashboardSummary } from "@idm/shared-types";

/**
 * Pure composition over already-built services — no direct Prisma
 * access here, unlike the read-only "projection" repositories (cash
 * register, reports). Every number on the dashboard is traceable to
 * the exact same service that page's own screen uses, so the
 * dashboard can never show a different number than what you'd see by
 * opening Cash Register / Debts / Inventory / Reports yourself.
 */
export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    const [boundaryStatus, cashSummary, totalCustomerDebt, totalSupplierDebt, stock] = await Promise.all([
      dailyClosingService.getStatus(),
      cashRegisterService.getSummary(),
      customerService.getTotalBalance(),
      supplierService.getTotalBalance(),
      inventoryService.listStock(),
    ]);

    const boundary = new Date(boundaryStatus.todaySince);
    const now = new Date();

    const [salesReport, profitReport] = await Promise.all([
      reportsService.getSalesReport(boundary, now),
      reportsService.getProfitReport(boundary, now),
    ]);

    // Falls back to sellingPrice when a product has no costPrice set,
    // so a store that hasn't filled in costs yet still gets a (rougher)
    // inventory value instead of silently showing zero.
    const inventoryValue = stock.reduce(
      (sum, product) => sum + product.currentStock * (product.costPrice ?? product.sellingPrice),
      0,
    );
    const lowStockCount = stock.filter((product) => product.isLowStock).length;

    return {
      todaySince: boundaryStatus.todaySince,
      todaySalesRevenue: salesReport.totalRevenue,
      todayProfit: profitReport.estimatedProfit,
      cashBalance: cashSummary.balance,
      totalCustomerDebt,
      totalSupplierDebt,
      inventoryValue,
      lowStockCount,
      todaySalesSummary: {
        invoiceCount: salesReport.invoiceCount,
        cashSalesTotal: salesReport.totalPaid,
        debtSalesTotal: salesReport.totalRemaining,
        totalRevenue: salesReport.totalRevenue,
      },
      isDayClosedToday: boundaryStatus.isClosedToday,
    };
  },
};
