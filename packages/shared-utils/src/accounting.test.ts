import { describe, it, expect } from "vitest";
import { buildSupplierStatement, getPurchasePaymentStatus, roundMoney } from "./accounting";

describe("roundMoney", () => {
  it("removes floating point drift", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(0.1 * 3)).toBe(0.3);
  });
});

describe("getPurchasePaymentStatus", () => {
  it("is UNPAID when nothing was paid", () => expect(getPurchasePaymentStatus(100, 0)).toBe("UNPAID"));
  it("is PARTIAL after a partial payment", () => expect(getPurchasePaymentStatus(100, 40)).toBe("PARTIAL"));
  it("is PAID once fully settled", () => expect(getPurchasePaymentStatus(100, 100)).toBe("PAID"));
  it("is PAID despite float drift (0.1+0.2 vs 0.3)", () =>
    expect(getPurchasePaymentStatus(0.3, 0.1 + 0.2)).toBe("PAID"));
});

describe("buildSupplierStatement", () => {
  const milk = [{ id: "m1", date: "2026-09-01", totalAmount: 100, paidAmount: 40 }];
  const invoices = [
    { id: "i1", purchaseNumber: "PUR-000001", date: "2026-09-02", totalAmount: 200, initialPaidAmount: 50, status: "CONFIRMED" },
    { id: "i2", purchaseNumber: "PUR-000002", date: "2026-09-03", totalAmount: 500, initialPaidAmount: 500, status: "CANCELLED" },
  ];

  it("counts milk + confirmed invoice, ignores the cancelled invoice entirely", () => {
    const s = buildSupplierStatement({ milkPurchases: milk, purchaseInvoices: invoices, payments: [] });
    expect(s.entries.map((e) => e.reference)).toEqual(["شراء حليب", "PUR-000001"]);
    // owed 100 + 200, paid 40 + 50  => 210
    expect(s.closingBalance).toBe(210);
  });

  it("counts a linked payment once (initial paid + linked payments = invoice paidAmount)", () => {
    const s = buildSupplierStatement({
      milkPurchases: [],
      purchaseInvoices: [invoices[0]],
      payments: [
        { id: "p1", date: "2026-09-04", amount: 60, purchaseInvoiceId: "i1" },
        { id: "p2", date: "2026-09-05", amount: 90, purchaseInvoiceId: "i1" },
      ],
    });
    expect(s.closingBalance).toBe(0); // 200 - 50 - 60 - 90
    expect(s.totalCredit).toBe(200);
  });

  it("ignores payments linked to a cancelled invoice, keeps general payments", () => {
    const s = buildSupplierStatement({
      milkPurchases: milk,
      purchaseInvoices: invoices,
      payments: [
        { id: "p1", date: "2026-09-04", amount: 300, purchaseInvoiceId: "i2" },
        { id: "p2", date: "2026-09-05", amount: 10, purchaseInvoiceId: null },
      ],
    });
    expect(s.closingBalance).toBe(200); // 210 - 10
  });

  it("running balance is chronological and ends at the closing balance", () => {
    const s = buildSupplierStatement({
      milkPurchases: milk,
      purchaseInvoices: [invoices[0]],
      payments: [{ id: "p1", date: "2026-09-10", amount: 20, purchaseInvoiceId: null }],
    });
    expect(s.entries.map((e) => e.balance)).toEqual([60, 210, 190]);
    expect(s.entries[s.entries.length - 1].balance).toBe(s.closingBalance);
  });
});
