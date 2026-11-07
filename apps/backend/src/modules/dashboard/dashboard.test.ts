import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../daily-closing/daily-closing.service", () => ({
  dailyClosingService: {
    getStatus: vi.fn().mockResolvedValue({ isClosedToday: false, todaySince: "2026-08-11T00:00:00.000Z" }),
  },
}));

vi.mock("../cash-register/cash-register.service", () => ({
  cashRegisterService: { getSummary: vi.fn().mockResolvedValue({ balance: 750, totalIn: 900, totalOut: 150, movements: [] }) },
}));

vi.mock("../customers/customer.service", () => ({
  customerService: { getTotalBalance: vi.fn().mockResolvedValue(300) },
}));

vi.mock("../suppliers/supplier.service", () => ({
  supplierService: { getTotalBalance: vi.fn().mockResolvedValue(120) },
}));

const listStockMock = vi.fn();
vi.mock("../inventory/inventory.service", () => ({
  inventoryService: { listStock: () => listStockMock() },
}));

const getSalesReportMock = vi.fn();
const getProfitReportMock = vi.fn();
vi.mock("../reports/reports.service", () => ({
  reportsService: {
    getSalesReport: (...args: unknown[]) => getSalesReportMock(...args),
    getProfitReport: (...args: unknown[]) => getProfitReportMock(...args),
  },
}));

import { dashboardService } from "./dashboard.service";

describe("dashboardService.getSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSalesReportMock.mockResolvedValue({
      invoiceCount: 4,
      totalRevenue: 400,
      totalPaid: 250,
      totalRemaining: 150,
    });
    getProfitReportMock.mockResolvedValue({ estimatedProfit: 120 });
  });

  it("values inventory using costPrice when set, falling back to sellingPrice otherwise", async () => {
    listStockMock.mockResolvedValue([
      { id: "p1", currentStock: 10, costPrice: 5, sellingPrice: 8, isLowStock: false },
      { id: "p2", currentStock: 4, costPrice: null, sellingPrice: 3, isLowStock: true },
    ]);

    const summary = await dashboardService.getSummary();

    // p1: 10 * 5 (costPrice) = 50; p2: 4 * 3 (sellingPrice fallback) = 12
    expect(summary.inventoryValue).toBe(62);
    expect(summary.lowStockCount).toBe(1);
  });

  it("splits today's sales into cash (paid) vs debt (remaining) totals", async () => {
    listStockMock.mockResolvedValue([]);

    const summary = await dashboardService.getSummary();

    expect(summary.todaySalesSummary.cashSalesTotal).toBe(250);
    expect(summary.todaySalesSummary.debtSalesTotal).toBe(150);
    expect(summary.todaySalesSummary.invoiceCount).toBe(4);
  });

  it("surfaces the cash register balance and customer/supplier debt totals directly", async () => {
    listStockMock.mockResolvedValue([]);

    const summary = await dashboardService.getSummary();

    expect(summary.cashBalance).toBe(750);
    expect(summary.totalCustomerDebt).toBe(300);
    expect(summary.totalSupplierDebt).toBe(120);
  });
});
