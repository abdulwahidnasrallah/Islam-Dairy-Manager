import { describe, it, expect, vi, beforeEach } from "vitest";

// Each mocked deleteMany returns a distinct sentinel object so we can
// verify $transaction receives them in the exact order the repository
// promises — this is the test that actually protects against a
// reordering that would violate a foreign key constraint.
function sentinel(tableName: string, count: number) {
  return { __table: tableName, count };
}

const deleteManyMocks = {
  invoiceItem: vi.fn(() => sentinel("InvoiceItem", 1)),
  purchaseInvoiceItem: vi.fn(() => sentinel("PurchaseInvoiceItem", 2)),
  assistantMessage: vi.fn(() => sentinel("AssistantMessage", 3)),
  invoice: vi.fn(() => sentinel("Invoice", 4)),
  supplierPayment: vi.fn(() => sentinel("SupplierPayment", 5)),
  purchaseInvoice: vi.fn(() => sentinel("PurchaseInvoice", 6)),
  inventoryMovement: vi.fn(() => sentinel("InventoryMovement", 7)),
  productionBatch: vi.fn(() => sentinel("ProductionBatch", 8)),
  milkPurchase: vi.fn(() => sentinel("MilkPurchase", 9)),
  customerPayment: vi.fn(() => sentinel("CustomerPayment", 10)),
  assistantConversation: vi.fn(() => sentinel("AssistantConversation", 11)),
  dailyClosing: vi.fn(() => sentinel("DailyClosing", 12)),
  cashAdjustment: vi.fn(() => sentinel("CashAdjustment", 13)),
  expense: vi.fn(() => sentinel("Expense", 14)),
  counter: vi.fn(() => sentinel("Counter", 15)),
  customer: vi.fn(() => sentinel("Customer", 16)),
  supplier: vi.fn(() => sentinel("Supplier", 17)),
  product: vi.fn(() => sentinel("Product", 18)),
};

const transactionMock = vi.fn(async (ops: unknown[]) => ops);

vi.mock("../../config/prisma", () => ({
  prisma: {
    $transaction: (ops: unknown[]) => transactionMock(ops),
    invoiceItem: { deleteMany: deleteManyMocks.invoiceItem },
    purchaseInvoiceItem: { deleteMany: deleteManyMocks.purchaseInvoiceItem },
    assistantMessage: { deleteMany: deleteManyMocks.assistantMessage },
    invoice: { deleteMany: deleteManyMocks.invoice },
    purchaseInvoice: { deleteMany: deleteManyMocks.purchaseInvoice },
    inventoryMovement: { deleteMany: deleteManyMocks.inventoryMovement },
    productionBatch: { deleteMany: deleteManyMocks.productionBatch },
    milkPurchase: { deleteMany: deleteManyMocks.milkPurchase },
    supplierPayment: { deleteMany: deleteManyMocks.supplierPayment },
    customerPayment: { deleteMany: deleteManyMocks.customerPayment },
    assistantConversation: { deleteMany: deleteManyMocks.assistantConversation },
    dailyClosing: { deleteMany: deleteManyMocks.dailyClosing },
    cashAdjustment: { deleteMany: deleteManyMocks.cashAdjustment },
    expense: { deleteMany: deleteManyMocks.expense },
    counter: { deleteMany: deleteManyMocks.counter },
    customer: { deleteMany: deleteManyMocks.customer },
    supplier: { deleteMany: deleteManyMocks.supplier },
    product: { deleteMany: deleteManyMocks.product },
  },
}));

import { dataCleanupRepository } from "./data-cleanup.repository";

describe("dataCleanupRepository.deleteAllOperationalData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes every table referencing Product/Customer/Supplier/Invoice/AssistantConversation BEFORE that table itself", async () => {
    await dataCleanupRepository.deleteAllOperationalData();

    const opsPassedToTransaction = transactionMock.mock.calls[0][0] as Array<{ __table: string }>;
    const order = opsPassedToTransaction.map((op) => op.__table);

    function mustComeBefore(child: string, parent: string) {
      expect(order.indexOf(child)).toBeGreaterThanOrEqual(0);
      expect(order.indexOf(parent)).toBeGreaterThanOrEqual(0);
      expect(order.indexOf(child)).toBeLessThan(order.indexOf(parent));
    }

    // Everything that references Product must be gone before Product.
    mustComeBefore("InvoiceItem", "Product");
    mustComeBefore("InventoryMovement", "Product");
    mustComeBefore("ProductionBatch", "Product");

    // Everything that references Customer must be gone before Customer.
    mustComeBefore("Invoice", "Customer");
    mustComeBefore("CustomerPayment", "Customer");

    // Everything that references Supplier must be gone before Supplier.
    mustComeBefore("MilkPurchase", "Supplier");
    mustComeBefore("SupplierPayment", "Supplier");
    mustComeBefore("PurchaseInvoice", "Supplier");

    // SupplierPayment.purchaseInvoiceId references PurchaseInvoice, so payments must go first.
    mustComeBefore("SupplierPayment", "PurchaseInvoice");

    // InvoiceItem references Invoice, so it must go first.
    mustComeBefore("InvoiceItem", "Invoice");

    // PurchaseInvoiceItem references PurchaseInvoice AND Product, so it must go first for both.
    mustComeBefore("PurchaseInvoiceItem", "PurchaseInvoice");
    mustComeBefore("PurchaseInvoiceItem", "Product");

    // AssistantMessage references AssistantConversation.
    mustComeBefore("AssistantMessage", "AssistantConversation");

    expect(order).toHaveLength(18);
  });

  it("maps each deleteMany result count back to the correct table name", async () => {
    const counts = await dataCleanupRepository.deleteAllOperationalData();

    expect(counts.InvoiceItem).toBe(1);
    expect(counts.PurchaseInvoiceItem).toBe(2);
    expect(counts.SupplierPayment).toBe(5);
    expect(counts.PurchaseInvoice).toBe(6);
    expect(counts.Product).toBe(18);
    expect(counts.Customer).toBe(16);
    expect(counts.Supplier).toBe(17);
    expect(Object.keys(counts)).toHaveLength(18);
  });

  it("never issues a delete for User, Role, Permission, RolePermission, Session, AuditLog, or ApplicationSettings", async () => {
    // The mocked Prisma client above deliberately has NO `user`, `role`,
    // `permission`, `rolePermission`, `session`, `auditLog`, or
    // `applicationSettings` properties — only the 16 operational
    // tables. If the repository ever called e.g. `prisma.user.deleteMany()`,
    // that would throw synchronously ("Cannot read properties of
    // undefined") while building the $transaction array, and this
    // `await` would reject. Successfully resolving is the proof that
    // none of the protected tables were touched.
    // (The mocked client also has no `purchaseInvoice` or
    // `purchaseInvoiceItem` beyond what's declared above, so this
    // doubles as proof no OTHER stray table name was introduced.)
    await expect(dataCleanupRepository.deleteAllOperationalData()).resolves.toBeDefined();
  });
});
