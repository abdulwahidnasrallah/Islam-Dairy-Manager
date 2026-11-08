// Runs the REAL purchase-invoice.service.ts, payment.service.ts and accounting.ts
// against in-memory fakes of the database layer.
//   node --import ./tests/scenario/register.mjs --test tests/scenario/purchase-scenarios.test.mjs
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { db, resetDb, stockOf, balanceOf } from "./fakes.mjs";
import { purchaseInvoiceService } from "../../apps/backend/src/modules/purchase-invoices/purchase-invoice.service.ts";
import { supplierPaymentService } from "../../apps/backend/src/modules/supplier-payments/payment.service.ts";
import { buildSupplierStatement } from "../../packages/shared-utils/src/accounting.ts";

const S = "sup_1", P = "prod_1";
const newInvoice = (over = {}) => purchaseInvoiceService.create({ supplierId: S, date: new Date("2026-09-01"), items: [{ productId: P, quantity: 10, unitPrice: 5 }], paidAmount: 20, paymentMethod: "CASH", notes: null, idempotencyKey: null, ...over }, "u1");
const pay = (invoiceId, amount, over = {}) => supplierPaymentService.create({ supplierId: S, amount, date: new Date("2026-09-05"), method: "CASH", notes: null, purchaseInvoiceId: invoiceId, idempotencyKey: null, ...over }, "u1");
const rejects = (p, code) => assert.rejects(p, (e) => e.errorCode === code);

beforeEach(() => resetDb());

test("create: server-side total, PUR number, stock added, debt = remaining", async () => {
  const inv = await newInvoice();
  assert.equal(inv.purchaseNumber, "PUR-000001");
  assert.equal(inv.totalAmount, 50);
  assert.equal(inv.remainingAmount, 30);
  assert.equal(inv.paymentStatus, "PARTIAL");
  assert.equal(stockOf(P), 10);
  assert.equal(balanceOf(S), 30);
  assert.equal(db.audit.at(-1).action, "CREATE_PURCHASE_INVOICE");
});

test("two later payments change paid/remaining/status of the SAME invoice; each counted once", async () => {
  const inv = await newInvoice();
  await pay(inv.id, 10);
  let cur = await purchaseInvoiceService.getDetail(inv.id);
  assert.deepEqual([cur.paidAmount, cur.remainingAmount, cur.paymentStatus], [30, 20, "PARTIAL"]);
  assert.equal(balanceOf(S), 20, "balance must drop by 10, not 20 (no double count)");
  await pay(inv.id, 20);
  cur = await purchaseInvoiceService.getDetail(inv.id);
  assert.deepEqual([cur.paidAmount, cur.remainingAmount, cur.paymentStatus], [50, 0, "PAID"]);
  assert.equal(balanceOf(S), 0);
  assert.equal(cur.initialPaidAmount, 20, "up-front payment is never altered by later payments");
  assert.equal(cur.payments.length, 2);
  assert.equal(stockOf(P), 10, "payments never touch stock");
});

test("unpaid invoice becomes PAID after one full payment", async () => {
  const inv = await newInvoice({ paidAmount: 0 });
  assert.equal(inv.paymentStatus, "UNPAID");
  await pay(inv.id, 50);
  assert.equal((await purchaseInvoiceService.getDetail(inv.id)).paymentStatus, "PAID");
});

test("overpaying an invoice is rejected and changes nothing", async () => {
  const inv = await newInvoice();
  await rejects(pay(inv.id, 30.01), "PAYMENT_EXCEEDS_INVOICE_REMAINING");
  assert.equal(db.payments.length, 0);
  assert.equal(balanceOf(S), 30);
});

test("payment against another supplier's invoice is rejected", async () => {
  const inv = await newInvoice();
  await rejects(supplierPaymentService.create({ supplierId: "other", amount: 5, date: new Date(), method: "CASH", notes: null, purchaseInvoiceId: inv.id, idempotencyKey: null }, "u1"), "INVOICE_SUPPLIER_MISMATCH");
});

test("idempotent invoice: the same key twice -> ONE invoice, stock added ONCE", async () => {
  const a = await newInvoice({ idempotencyKey: "key-aaaaaaaa" });
  const b = await newInvoice({ idempotencyKey: "key-aaaaaaaa" });
  assert.equal(a.id, b.id);
  assert.equal(db.invoices.length, 1);
  assert.equal(stockOf(P), 10);
  assert.equal(balanceOf(S), 30);
});

test("idempotent invoice under a concurrent double submit -> still ONE invoice and ONE stock movement", async () => {
  const [a, b] = await Promise.all([newInvoice({ idempotencyKey: "key-bbbbbbbb" }), newInvoice({ idempotencyKey: "key-bbbbbbbb" })]);
  assert.equal(a.id, b.id);
  assert.equal(db.invoices.length, 1);
  assert.equal(db.movements.length, 1);
});

test("idempotent payment: the same key twice (even concurrently) -> ONE payment", async () => {
  const inv = await newInvoice();
  const [a, b] = await Promise.all([pay(inv.id, 10, { idempotencyKey: "pay-key-0001" }), pay(inv.id, 10, { idempotencyKey: "pay-key-0001" })]);
  assert.equal(a.id, b.id);
  assert.equal(db.payments.length, 1);
  assert.equal((await purchaseInvoiceService.getDetail(inv.id)).paidAmount, 30);
});

test("two different payments racing on stale data: one wins, the other gets a conflict — never over-applied", async () => {
  const inv = await newInvoice(); // remaining 30
  const results = await Promise.allSettled([pay(inv.id, 20), pay(inv.id, 20)]);
  const ok = results.filter((r) => r.status === "fulfilled");
  const bad = results.filter((r) => r.status === "rejected");
  assert.equal(ok.length, 1);
  assert.equal(bad.length, 1);
  assert.equal(bad[0].reason.errorCode, "PURCHASE_INVOICE_CHANGED");
  const cur = await purchaseInvoiceService.getDetail(inv.id);
  assert.deepEqual([cur.paidAmount, cur.remainingAmount], [40, 10]);
  assert.equal(db.payments.length, 1);
});

test("cancel: stock reversed, invoice and its payments leave the balance, second cancel rejected", async () => {
  const inv = await newInvoice();
  await pay(inv.id, 10);
  await purchaseInvoiceService.cancel(inv.id, "u1");
  assert.equal(stockOf(P), 0, "stock back to what it was before the purchase");
  assert.equal(db.movements.filter((m) => m.reason === "PURCHASE_CANCELLED").length, 1);
  assert.equal(balanceOf(S), 0, "cancelled invoice (and its linked payment) no longer counts");
  assert.equal((await purchaseInvoiceService.getDetail(inv.id)).status, "CANCELLED");
  await rejects(purchaseInvoiceService.cancel(inv.id, "u1"), "PURCHASE_INVOICE_ALREADY_CANCELLED");
  assert.equal(stockOf(P), 0, "second cancel must not reverse stock again");
  await rejects(pay(inv.id, 5), "PURCHASE_INVOICE_CANCELLED");
  assert.equal(db.audit.some((a) => a.action === "CANCEL_PURCHASE_INVOICE"), true);
});

test("cancel is refused when the purchased goods were already sold/used", async () => {
  const inv = await newInvoice();
  db.movements.push({ productId: P, type: "OUT", reason: "SALE", quantity: 4 }); // 6 left, 10 bought
  await rejects(purchaseInvoiceService.cancel(inv.id, "u1"), "INSUFFICIENT_STOCK_TO_CANCEL");
  assert.equal((await purchaseInvoiceService.getDetail(inv.id)).status, "CONFIRMED");
  assert.equal(stockOf(P), 6);
});

test("supplier statement matches the balance (milk + invoices + linked and general payments + cancelled invoice)", async () => {
  db.milk.push({ id: "m1", supplierId: S, date: new Date("2026-08-30"), totalAmount: 100, paidAmount: 40 });
  const a = await newInvoice();                       // 50 owed, 20 paid up front
  await pay(a.id, 10);                                // linked payment
  const b = await newInvoice({ paidAmount: 0 });      // 50 owed, later cancelled
  await pay(b.id, 15);
  await purchaseInvoiceService.cancel(b.id, "u1");
  await supplierPaymentService.create({ supplierId: S, amount: 5, date: new Date("2026-09-09"), method: "CASH", notes: null, purchaseInvoiceId: null, idempotencyKey: null }, "u1");
  const st = buildSupplierStatement({
    milkPurchases: db.milk.map((m) => ({ ...m, date: m.date.toISOString() })),
    purchaseInvoices: db.invoices.map((i) => ({ id: i.id, purchaseNumber: i.purchaseNumber, date: i.date.toISOString(), totalAmount: i.totalAmount, initialPaidAmount: i.initialPaidAmount, status: i.status })),
    payments: db.payments.map((p) => ({ id: p.id, date: p.date.toISOString(), amount: p.amount, purchaseInvoiceId: p.purchaseInvoiceId })),
  });
  // owed: 100 + 50 = 150; paid: 40 + 20 + 10 + 5 = 75  -> 75
  assert.equal(st.closingBalance, 75);
  assert.equal(balanceOf(S), 75, "statement closing balance == supplier balance query");
});
