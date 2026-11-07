import { describe, it, expect, vi, beforeEach } from "vitest";

const searchCustomersMock = vi.fn().mockResolvedValue([]);
const searchSuppliersMock = vi.fn().mockResolvedValue([]);
const searchProductsMock = vi.fn().mockResolvedValue([]);
const searchInvoicesMock = vi.fn().mockResolvedValue([]);
const searchMilkPurchasesMock = vi.fn().mockResolvedValue([]);
const searchPurchaseInvoicesMock = vi.fn().mockResolvedValue([]);

vi.mock("./search.repository", () => ({
  searchRepository: {
    searchCustomers: (...args: unknown[]) => searchCustomersMock(...args),
    searchSuppliers: (...args: unknown[]) => searchSuppliersMock(...args),
    searchProducts: (...args: unknown[]) => searchProductsMock(...args),
    searchInvoices: (...args: unknown[]) => searchInvoicesMock(...args),
    searchMilkPurchases: (...args: unknown[]) => searchMilkPurchasesMock(...args),
    searchPurchaseInvoices: (...args: unknown[]) => searchPurchaseInvoicesMock(...args),
  },
}));

import { searchService } from "./search.service";

describe("searchService.search", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns no results and skips all repository calls for a query shorter than 2 characters", async () => {
    const results = await searchService.search("a");

    expect(results).toEqual([]);
    expect(searchCustomersMock).not.toHaveBeenCalled();
  });

  it("maps each source into a clickable, categorized result", async () => {
    searchCustomersMock.mockResolvedValue([{ id: "c1", name: "بقالة الأمل", phone: "0991234567" }]);
    searchInvoicesMock.mockResolvedValue([
      {
        id: "inv1",
        invoiceNumber: "INV-000001",
        totalAmount: 80,
        customer: { name: "بقالة الأمل" },
      },
    ]);

    const results = await searchService.search("بقالة");

    const customerResult = results.find((r) => r.type === "customer");
    expect(customerResult?.title).toBe("بقالة الأمل");
    expect(customerResult?.link).toBe("/customers/c1");

    const invoiceResult = results.find((r) => r.type === "invoice");
    expect(invoiceResult?.title).toBe("INV-000001");
    expect(invoiceResult?.link).toBe("/sales/inv1");
  });

  it("maps a purchase invoice result to its own view page", async () => {
    searchPurchaseInvoicesMock.mockResolvedValue([
      {
        id: "pi1",
        purchaseNumber: "PUR-000001",
        totalAmount: 200,
        supplier: { name: "مزرعة النور" },
      },
    ]);

    const results = await searchService.search("مزرعة");

    const purchaseInvoiceResult = results.find((r) => r.type === "purchase_invoice");
    expect(purchaseInvoiceResult?.title).toBe("PUR-000001");
    expect(purchaseInvoiceResult?.link).toBe("/purchase-invoices/pi1");
  });
});
