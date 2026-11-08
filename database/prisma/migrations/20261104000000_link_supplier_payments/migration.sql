ALTER TABLE "PurchaseInvoice" ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID';

UPDATE "PurchaseInvoice"
SET "paymentStatus" = CASE
  WHEN "paidAmount" >= "totalAmount" THEN 'PAID'
  WHEN "paidAmount" > 0 THEN 'PARTIALLY_PAID'
  ELSE 'UNPAID'
END;

PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SupplierPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "supplierId" TEXT NOT NULL,
  "purchaseInvoiceId" TEXT,
  "amount" REAL NOT NULL,
  "date" DATETIME NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'CASH',
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SupplierPayment_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SupplierPayment" ("id", "supplierId", "purchaseInvoiceId", "amount", "date", "method", "notes", "createdAt")
SELECT "id", "supplierId", "purchaseInvoiceId", "amount", "date", "method", "notes", "createdAt" FROM "SupplierPayment";
DROP TABLE "SupplierPayment";
ALTER TABLE "new_SupplierPayment" RENAME TO "SupplierPayment";
CREATE INDEX "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");
CREATE INDEX "SupplierPayment_purchaseInvoiceId_idx" ON "SupplierPayment"("purchaseInvoiceId");
CREATE INDEX "SupplierPayment_date_idx" ON "SupplierPayment"("date");
PRAGMA foreign_keys=ON;