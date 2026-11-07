import { describe, it, expect, vi, beforeEach } from "vitest";
import { toCsv } from "../../utils/csv";

vi.mock("../expenses/expense.repository", () => ({
  expenseRepository: { getTotal: vi.fn().mockResolvedValue(0) },
}));

const getSalesTotalsMock = vi.fn();
const getPurchaseTotalsMock = vi.fn();
const getCOGSMock = vi.fn();

vi.mock("./reports.repository", () => ({
  reportsRepository: {
    getSalesTotals: (...args: unknown[]) => getSalesTotalsMock(...args),
    getDailyRevenue: vi.fn().mockResolvedValue([]),
    getTopProducts: vi.fn().mockResolvedValue([]),
    getPurchaseTotals: (...args: unknown[]) => getPurchaseTotalsMock(...args),
    getTopSuppliers: vi.fn().mockResolvedValue([]),
    getCOGS: (...args: unknown[]) => getCOGSMock(...args),
  },
}));

vi.mock("../customers/customer.service", () => ({
  customerService: { listWithDebt: vi.fn().mockResolvedValue([]) },
}));

import { resolveDateRange, reportsService } from "./reports.service";

describe("toCsv", () => {
  it("quotes values containing commas, quotes, or newlines", () => {
    const csv = toCsv(
      [{ name: 'بقالة "الأمل", فرع 2', amount: 100 }],
      [
        { key: "name", label: "الاسم" },
        { key: "amount", label: "المبلغ" },
      ],
    );

    const lines = csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(lines[0]).toBe("الاسم,المبلغ");
    expect(lines[1]).toBe('"بقالة ""الأمل"", فرع 2",100');
  });

  it("starts with a UTF-8 BOM so Excel renders Arabic correctly", () => {
    const csv = toCsv([], [{ key: "a", label: "a" }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});

describe("resolveDateRange", () => {
  it("defaults to the current calendar month when no range is given", () => {
    const { from, to } = resolveDateRange();
    const now = new Date();

    expect(from.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(from.getUTCMonth()).toBe(now.getUTCMonth());
    expect(from.getUTCDate()).toBe(1);
    expect(to.getUTCMonth()).toBe(now.getUTCMonth());
  });

  it("uses the given range and includes the full end day", () => {
    const { from, to } = resolveDateRange("2026-01-01", "2026-01-31");

    expect(from.getUTCFullYear()).toBe(2026);
    expect(from.getUTCMonth()).toBe(0);
    expect(from.getUTCDate()).toBe(1);
    expect(to.getUTCDate()).toBe(31);
    expect(to.getUTCHours()).toBe(23);
    expect(to.getUTCMinutes()).toBe(59);
  });
});

describe("reportsService.getProfitReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes estimatedProfit from revenue minus COGS minus expenses (not minus milk purchase cost)", async () => {
    getSalesTotalsMock.mockResolvedValue({
      invoiceCount: 3,
      totalRevenue: 1000,
      totalPaid: 800,
      totalRemaining: 200,
    });
    getPurchaseTotalsMock.mockResolvedValue({
      purchaseCount: 1,
      totalQuantity: 50,
      totalCost: 300,
      totalPaid: 300,
    });
    getCOGSMock.mockResolvedValue({ totalCOGS: 400, itemsWithoutCost: 1 });

    const report = await reportsService.getProfitReport(new Date("2026-08-01"), new Date("2026-08-31"));

    expect(report.totalSalesRevenue).toBe(1000);
    expect(report.totalCOGS).toBe(400);
    expect(report.totalMilkPurchaseCost).toBe(300);
    expect(report.itemsWithoutCost).toBe(1);
    // 1000 - 400 (COGS) - 0 (expenses mocked to 0) = 600, NOT 1000 - 300 - 0 = 700
    expect(report.estimatedProfit).toBe(600);
  });
});
