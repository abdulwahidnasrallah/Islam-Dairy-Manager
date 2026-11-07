import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

const getSalesReportMock = vi.fn();
const getProfitReportMock = vi.fn();
vi.mock("../reports/reports.service", () => ({
  reportsService: {
    getSalesReport: (...args: unknown[]) => getSalesReportMock(...args),
    getProfitReport: (...args: unknown[]) => getProfitReportMock(...args),
  },
}));

const getCashSummaryMock = vi.fn();
vi.mock("../cash-register/cash-register.service", () => ({
  cashRegisterService: { getSummary: () => getCashSummaryMock() },
}));

const findLatestSinceMock = vi.fn();
const createMock = vi.fn();
vi.mock("./daily-closing.repository", () => ({
  dailyClosingRepository: {
    findLatestSince: (...args: unknown[]) => findLatestSinceMock(...args),
    create: (...args: unknown[]) => createMock(...args),
    list: vi.fn().mockResolvedValue([]),
  },
}));

import { dailyClosingService } from "./daily-closing.service";

describe("dailyClosingService.getTodayBoundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the start of today when the day hasn't been closed yet", async () => {
    findLatestSinceMock.mockResolvedValue(null);

    const boundary = await dailyClosingService.getTodayBoundary();
    const now = new Date();

    expect(boundary.getFullYear()).toBe(now.getFullYear());
    expect(boundary.getMonth()).toBe(now.getMonth());
    expect(boundary.getDate()).toBe(now.getDate());
    expect(boundary.getHours()).toBe(0);
    expect(boundary.getMinutes()).toBe(0);
  });

  it("returns the last closing's timestamp when today was already closed", async () => {
    const closingTime = new Date();
    closingTime.setHours(14, 30, 0, 0);
    findLatestSinceMock.mockResolvedValue({ closedAt: closingTime });

    const boundary = await dailyClosingService.getTodayBoundary();

    expect(boundary.getTime()).toBe(closingTime.getTime());
  });
});

describe("dailyClosingService.getStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports isClosedToday=false when no closing exists yet today", async () => {
    findLatestSinceMock.mockResolvedValue(null);

    const status = await dailyClosingService.getStatus();

    expect(status.isClosedToday).toBe(false);
  });

  it("reports isClosedToday=true after a closing exists today", async () => {
    const closingTime = new Date();
    closingTime.setHours(9, 0, 0, 0);
    findLatestSinceMock.mockResolvedValue({ closedAt: closingTime });

    const status = await dailyClosingService.getStatus();

    expect(status.isClosedToday).toBe(true);
  });
});

describe("dailyClosingService.closeDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findLatestSinceMock.mockResolvedValue(null);
    getSalesReportMock.mockResolvedValue({ totalRevenue: 500 });
    getProfitReportMock.mockResolvedValue({ estimatedProfit: 200 });
    getCashSummaryMock.mockResolvedValue({ balance: 1000 });
    createMock.mockImplementation(async (data: any) => ({
      id: "closing_1",
      businessDate: data.businessDate,
      closedAt: new Date(),
      closedByUserId: data.closedByUser.connect.id,
      totalSales: data.totalSales,
      totalProfit: data.totalProfit,
      cashBalanceAtClose: data.cashBalanceAtClose,
      notes: null,
    }));
  });

  it("snapshots today's sales, profit, and cash balance into a new row", async () => {
    const result = await dailyClosingService.closeDay("user_1");

    expect(result.totalSales).toBe(500);
    expect(result.totalProfit).toBe(200);
    expect(result.cashBalanceAtClose).toBe(1000);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("does not delete or modify anything else — only inserts one closing row", async () => {
    await dailyClosingService.closeDay("user_1");

    // The only repository mutation available to this service is `create`;
    // asserting it was called exactly once is effectively asserting no
    // other write happened, since there's nothing else it could call.
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
