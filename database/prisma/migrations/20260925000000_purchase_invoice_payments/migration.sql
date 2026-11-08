-- Purchase-invoice payments + idempotency.
-- Purely additive (ADD COLUMN / CREATE INDEX): safe on a database that already
-- holds data — no table is rebuilt and no row is deleted.

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN "initialPaidAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseInvoice" ADD COLUMN "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN "purchaseInvoiceId" TEXT REFERENCES "PurchaseInvoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierPayment" ADD COLUMN "idempotencyKey" TEXT;

-- Backfill: for every invoice that already exists, everything paid so far was
-- paid at creation time (linked payments did not exist before this migration).
UPDATE "PurchaseInvoice" SET "initialPaidAmount" = "paidAmount";

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_idempotencyKey_key" ON "PurchaseInvoice"("idempotencyKey");
CREATE UNIQUE INDEX "SupplierPayment_idempotencyKey_key" ON "SupplierPayment"("idempotencyKey");
CREATE INDEX "SupplierPayment_purchaseInvoiceId_idx" ON "SupplierPayment"("purchaseInvoiceId");
