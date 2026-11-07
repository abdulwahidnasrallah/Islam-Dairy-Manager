import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../expenses/expense.repository", () => ({
  expenseRepository: {
    getTotal: vi.fn().mockResolvedValue(0),
  },
}));

const getProfitReportMock = vi.fn();
vi.mock("../reports/reports.service", () => ({
  reportsService: {
    getProfitReport: (...args: unknown[]) => getProfitReportMock(...args),
  },
  resolveDateRange: () => ({ from: new Date("2026-08-01"), to: new Date("2026-08-31") }),
}));

const getTotalsMock = vi.fn();
const createAdjustmentMock = vi.fn(async (data: any) => ({
  id: "adj_1",
  type: data.type,
  amount: data.amount,
  date: data.date,
  reason: data.reason,
  notes: data.notes,
  createdAt: new Date(),
}));

vi.mock("./cash-register.repository", () => ({
  cashRegisterRepository: {
    getTotals: (...args: unknown[]) => getTotalsMock(...args),
    getRecentMovements: vi.fn().mockResolvedValue([]),
    createAdjustment: (...args: unknown[]) => createAdjustmentMock(...args),
  },
}));

import { cashRegisterService } from "./cash-register.service";

function totals(overrides: Partial<Record<string, number>> = {}) {
  return {
    supplierPayments: 0,
    milkPurchasePaid: 0,
    purchaseInvoicePaid: 0,
    customerPayments: 0,
    invoicePaid: 0,
    invoiceTotal: 0,
    expenses: 0,
    cashAdjustmentsIn: 0,
    cashAdjustmentsOut: 0,
    ...overrides,
  };
}

describe("cashRegisterService.createAdjustment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an OUT adjustment up to the current cash balance", async () => {
    getTotalsMock.mockResolvedValue(totals({ customerPayments: 100 }));

    const result = await cashRegisterService.createAdjustment(
      { type: "OUT", amount: 100, date: new Date("2026-08-01"), reason: "سحب شخصي", notes: null },
      "user_1",
    );

    expect(result.amount).toBe(100);
    expect(createAdjustmentMock).toHaveBeenCalled();
  });

  it("rejects an OUT adjustment greater than the current cash balance", async () => {
    getTotalsMock.mockResolvedValue(totals({ customerPayments: 50 }));

    await expect(
      cashRegisterService.createAdjustment(
        { type: "OUT", amount: 200, date: new Date("2026-08-01"), reason: "سحب شخصي", notes: null },
        "user_1",
      ),
    ).rejects.toMatchObject({ errorCode: "INSUFFICIENT_CASH_BALANCE" });

    expect(createAdjustmentMock).not.toHaveBeenCalled();
  });

  it("does not check the balance for an IN adjustment", async () => {
    getTotalsMock.mockResolvedValue(totals());

    const result = await cashRegisterService.createAdjustment(
      { type: "IN", amount: 500, date: new Date("2026-08-01"), reason: "رأس مال", notes: null },
      "user_1",
    );

    expect(result.type).toBe("IN");
  });
});

describe("cashRegisterService.getSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes balance as (customer + invoice-paid + adj-in) minus (supplier + milk-paid + expenses + adj-out)", async () => {
    getTotalsMock.mockResolvedValue(
      totals({
        customerPayments: 100,
        invoicePaid: 200,
        cashAdjustmentsIn: 1000,
        supplierPayments: 50,
        milkPurchasePaid: 30,
        expenses: 20,
        cashAdjustmentsOut: 10,
      }),
    );

    const summary = await cashRegisterService.getSummary();

    expect(summary.totalIn).toBe(1300);
    expect(summary.totalOut).toBe(110);
    expect(summary.balance).toBe(1190);
  });

  it("subtracts confirmed supplier purchase-invoice payments from the cash balance, on top of milk purchases", async () => {
    getTotalsMock.mockResolvedValue(
      totals({
        customerPayments: 500,
        milkPurchasePaid: 30,
        purchaseInvoicePaid: 120,
      }),
    );

    const summary = await cashRegisterService.getSummary();

    expect(summary.totalIn).toBe(500);
    expect(summary.totalOut).toBe(150);
    expect(summary.balance).toBe(350);
  });
});

describe("cashRegisterService.getMonthlyProfitSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to reportsService.getProfitReport for the current month's range — one profit formula, not two", async () => {
    getProfitReportMock.mockResolvedValue({
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.999Z",
      totalSalesRevenue: 1000,
      totalCOGS: 400,
      totalMilkPurchaseCost: 300,
      totalExpenses: 100,
      estimatedProfit: 500,
      itemsWithoutCost: 2,
    });

    const summary = await cashRegisterService.getMonthlyProfitSummary();

    expect(getProfitReportMock).toHaveBeenCalledTimes(1);
    expect(summary.periodLabel).toBe("هذا الشهر");
    expect(summary.totalCOGS).toBe(400);
    expect(summary.estimatedProfit).toBe(500);
    expect(summary.itemsWithoutCost).toBe(2);
  });
});
