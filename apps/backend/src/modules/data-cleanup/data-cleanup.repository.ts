import { prisma } from "../../config/prisma";

/**
 * Deletes every row of operational/business data in a single
 * transaction, in the exact order foreign key constraints require
 * (children before the parents they reference). Never touches User,
 * Role, Permission, RolePermission, Session, AuditLog, or
 * ApplicationSettings — those are intentionally out of scope (see
 * data-cleanup.service.ts for the full rationale). Never touches the
 * schema, migrations, or the database file itself — this is pure
 * row-level DELETE, nothing else.
 *
 * Order (each line becomes safe to delete only once every table
 * above it that references it has already been cleared):
 *   1. InvoiceItem          (references Invoice, Product)
 *   2. PurchaseInvoiceItem  (references PurchaseInvoice, Product)
 *   3. AssistantMessage     (references AssistantConversation)
 *   4. Invoice              (references Customer)
 *   5. PurchaseInvoice      (references Supplier)
 *   6. InventoryMovement    (references Product)
 *   7. ProductionBatch      (references Product)
 *   8. MilkPurchase         (references Supplier)
 *   9. SupplierPayment      (references Supplier)
 *  10. CustomerPayment      (references Customer)
 *  11. AssistantConversation(references User — User itself is kept)
 *  12. DailyClosing         (references User — User itself is kept)
 *  13. CashAdjustment       (no relations)
 *  14. Expense              (no relations)
 *  15. Counter              (no relations — clears the invoice AND
 *                            purchase-invoice number sequences so
 *                            numbering restarts from 1 again)
 *  16. Customer             (safe now: Invoice, CustomerPayment gone)
 *  17. Supplier             (safe now: MilkPurchase, SupplierPayment,
 *                            PurchaseInvoice all gone)
 *  18. Product              (safe now: InvoiceItem, PurchaseInvoiceItem,
 *                            InventoryMovement, ProductionBatch all gone)
 */
const DELETE_ORDER = [
  "InvoiceItem",
  "PurchaseInvoiceItem",
  "AssistantMessage",
  "Invoice",
  "PurchaseInvoice",
  "InventoryMovement",
  "ProductionBatch",
  "MilkPurchase",
  "SupplierPayment",
  "CustomerPayment",
  "AssistantConversation",
  "DailyClosing",
  "CashAdjustment",
  "Expense",
  "Counter",
  "Customer",
  "Supplier",
  "Product",
] as const;

export const dataCleanupRepository = {
  async deleteAllOperationalData(): Promise<Record<string, number>> {
    const results = await prisma.$transaction([
      prisma.invoiceItem.deleteMany(),
      prisma.purchaseInvoiceItem.deleteMany(),
      prisma.assistantMessage.deleteMany(),
      prisma.invoice.deleteMany(),
      prisma.purchaseInvoice.deleteMany(),
      prisma.inventoryMovement.deleteMany(),
      prisma.productionBatch.deleteMany(),
      prisma.milkPurchase.deleteMany(),
      prisma.supplierPayment.deleteMany(),
      prisma.customerPayment.deleteMany(),
      prisma.assistantConversation.deleteMany(),
      prisma.dailyClosing.deleteMany(),
      prisma.cashAdjustment.deleteMany(),
      prisma.expense.deleteMany(),
      prisma.counter.deleteMany(),
      prisma.customer.deleteMany(),
      prisma.supplier.deleteMany(),
      prisma.product.deleteMany(),
    ]);

    const counts: Record<string, number> = {};
    DELETE_ORDER.forEach((tableName, index) => {
      counts[tableName] = results[index].count;
    });
    return counts;
  },
};
