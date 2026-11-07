import { describe, it, expect, vi, beforeEach } from "vitest";

const inventoryListStockMock = vi.fn().mockResolvedValue([{ id: "p1" }]);
vi.mock("../inventory/inventory.service", () => ({
  inventoryService: { listStock: () => inventoryListStockMock() },
}));

const productListMock = vi.fn().mockResolvedValue([{ id: "p1", name: "جبنة بيضاء" }]);
vi.mock("../products/product.service", () => ({
  productService: { list: (q?: string) => productListMock(q) },
}));

const customerListMock = vi.fn().mockResolvedValue([{ id: "c1", name: "بقالة الأمل" }]);
vi.mock("../customers/customer.service", () => ({
  customerService: { list: (q?: string) => customerListMock(q) },
}));

const supplierListMock = vi.fn().mockResolvedValue([{ id: "s1", name: "مزرعة النور" }]);
vi.mock("../suppliers/supplier.service", () => ({
  supplierService: { list: (q?: string) => supplierListMock(q) },
}));

const getTopDebtCustomersMock = vi.fn().mockResolvedValue([]);
const getSalesReportMock = vi.fn().mockResolvedValue({ invoiceCount: 3 });
const getPurchasesReportMock = vi.fn().mockResolvedValue({ purchaseCount: 2 });
const getProfitReportMock = vi.fn().mockResolvedValue({ estimatedProfit: 100 });
vi.mock("../reports/reports.service", () => ({
  reportsService: {
    getTopDebtCustomers: (limit?: number) => getTopDebtCustomersMock(limit),
    getSalesReport: (from: Date, to: Date) => getSalesReportMock(from, to),
    getPurchasesReport: (from: Date, to: Date) => getPurchasesReportMock(from, to),
    getProfitReport: (from: Date, to: Date) => getProfitReportMock(from, to),
  },
  resolveDateRange: (from?: string, to?: string) => ({
    from: from ? new Date(from) : new Date("2026-08-01"),
    to: to ? new Date(to) : new Date("2026-08-31"),
  }),
}));

const getCashSummaryMock = vi.fn().mockResolvedValue({ balance: 500 });
vi.mock("../cash-register/cash-register.service", () => ({
  cashRegisterService: { getSummary: () => getCashSummaryMock() },
}));

import { executeAssistantTool } from "./assistant.tools";

describe("executeAssistantTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches get_inventory_status to inventoryService.listStock", async () => {
    const result = await executeAssistantTool("get_inventory_status", {});
    expect(inventoryListStockMock).toHaveBeenCalled();
    expect(result).toEqual([{ id: "p1" }]);
  });

  it("dispatches search_products with the query", async () => {
    await executeAssistantTool("search_products", { query: "جبنة" });
    expect(productListMock).toHaveBeenCalledWith("جبنة");
  });

  it("dispatches search_customers with the query", async () => {
    await executeAssistantTool("search_customers", { query: "بقالة" });
    expect(customerListMock).toHaveBeenCalledWith("بقالة");
  });

  it("dispatches search_suppliers with the query", async () => {
    await executeAssistantTool("search_suppliers", { query: "مزرعة" });
    expect(supplierListMock).toHaveBeenCalledWith("مزرعة");
  });

  it("dispatches get_top_debt_customers with a default limit of 5", async () => {
    await executeAssistantTool("get_top_debt_customers", {});
    expect(getTopDebtCustomersMock).toHaveBeenCalledWith(5);
  });

  it("dispatches get_sales_report through resolveDateRange", async () => {
    const result = await executeAssistantTool("get_sales_report", { from: "2026-01-01", to: "2026-01-31" });
    expect(getSalesReportMock).toHaveBeenCalled();
    expect(result).toEqual({ invoiceCount: 3 });
  });

  it("dispatches get_cash_balance to cashRegisterService.getSummary", async () => {
    const result = await executeAssistantTool("get_cash_balance", {});
    expect(getCashSummaryMock).toHaveBeenCalled();
    expect(result).toEqual({ balance: 500 });
  });

  it("throws for an unknown tool name", async () => {
    await expect(executeAssistantTool("not_a_real_tool", {})).rejects.toThrow(
      "Unknown assistant tool",
    );
  });
});
