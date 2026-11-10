-- Restore the idempotency key removed when SupplierPayment was rebuilt
-- by the 20261104000000_link_supplier_payments migration.
ALTER TABLE "SupplierPayment" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "SupplierPayment_idempotencyKey_key" ON "SupplierPayment"("idempotencyKey");
