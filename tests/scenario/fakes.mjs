// In-memory stand-ins for the database layer. They implement the SAME rules the
// real repositories implement (transactional create + stock movement, conditional
// updateMany for cancel and for linked payments, unique idempotency keys), so the
// REAL service code runs end to end against them.
export const db = { invoices: [], payments: [], movements: [], counter: 0, audit: [], milk: [], seq: 0 };
export const resetDb = () => Object.assign(db, { invoices: [], payments: [], movements: [], counter: 0, audit: [], milk: [], seq: 0 });
const uid = (p) => `${p}_${++db.seq}`;
const uniqueErr = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
const withRel = (inv) => ({ ...inv, supplier: { name: "مزرعة النور" }, payments: db.payments.filter((p) => p.purchaseInvoiceId === inv.id).sort((a, b) => a.date - b.date), items: inv.items.map((i) => ({ ...i, product: { name: "أكياس", unit: "PIECE" } })) });
export const stockOf = (productId) => db.movements.filter((m) => m.productId === productId).reduce((s, m) => s + (m.type === "IN" ? m.quantity : -m.quantity), 0);

export const purchaseInvoiceRepositoryImpl = {
  findMany: () => db.invoices.map(withRel),
  findById: async (id) => { const i = db.invoices.find((x) => x.id === id); return i ? withRel(i) : null; },
  findByIdempotencyKey: async (k) => { const i = db.invoices.find((x) => x.idempotencyKey === k); return i ? withRel(i) : null; },
  async createWithMovements(data, items, date, prefix) {
    // atomic: either everything is written or nothing
    const snapshot = JSON.stringify([db.invoices.length, db.movements.length, db.counter]);
    try {
      db.counter += 1;
      if (data.idempotencyKey && db.invoices.some((x) => x.idempotencyKey === data.idempotencyKey)) throw uniqueErr();
      const inv = { id: uid("inv"), purchaseNumber: `${prefix}-${String(db.counter).padStart(6, "0")}`, supplierId: data.supplier.connect.id, date: data.date, totalAmount: data.totalAmount, paidAmount: data.paidAmount, initialPaidAmount: data.initialPaidAmount, remainingAmount: data.remainingAmount, paymentMethod: data.paymentMethod, status: "CONFIRMED", notes: data.notes, idempotencyKey: data.idempotencyKey ?? null, createdAt: new Date(), updatedAt: new Date(), items: items.map((i) => ({ id: uid("it"), ...i })) };
      db.invoices.push(inv);
      for (const i of items) db.movements.push({ productId: i.productId, type: "IN", reason: "PURCHASE", quantity: i.quantity, invoice: inv.purchaseNumber });
      return withRel(inv);
    } catch (e) {
      const [n, m, c] = JSON.parse(snapshot);
      db.invoices.length = n; db.movements.length = m; db.counter = c; // rollback
      throw e;
    }
  },
  async cancelWithMovements(id, at) {
    const inv = db.invoices.find((x) => x.id === id);
    if (!inv || inv.status !== "CONFIRMED") return null; // conditional updateMany WHERE status='CONFIRMED'
    inv.status = "CANCELLED";
    for (const i of inv.items) db.movements.push({ productId: i.productId, type: "OUT", reason: "PURCHASE_CANCELLED", quantity: i.quantity, invoice: inv.purchaseNumber });
    return withRel(inv);
  },
};
export const invoiceRepoModule = { purchaseInvoiceRepository: purchaseInvoiceRepositoryImpl };

export const paymentRepoModule = {
  supplierPaymentRepository: {
    findMany: async () => db.payments,
    findByIdempotencyKey: async (k) => db.payments.find((p) => p.idempotencyKey === k) ?? null,
    async create(data) {
      if (data.idempotencyKey && db.payments.some((p) => p.idempotencyKey === data.idempotencyKey)) throw uniqueErr();
      const p = { id: uid("pay"), supplierId: data.supplier.connect.id, amount: data.amount, date: data.date, method: data.method, notes: data.notes, purchaseInvoiceId: null, idempotencyKey: data.idempotencyKey ?? null, createdAt: new Date() };
      db.payments.push(p); return p;
    },
    async createLinked(data, invoiceId, expectedPaid, newPaid, newRemaining) {
      const inv = db.invoices.find((x) => x.id === invoiceId);
      // conditional updateMany: WHERE id AND status='CONFIRMED' AND paidAmount = expected
      if (!inv || inv.status !== "CONFIRMED" || inv.paidAmount !== expectedPaid) return null;
      if (data.idempotencyKey && db.payments.some((p) => p.idempotencyKey === data.idempotencyKey)) throw uniqueErr();
      inv.paidAmount = newPaid; inv.remainingAmount = newRemaining;
      const p = { id: uid("pay"), supplierId: data.supplier.connect.id, amount: data.amount, date: data.date, method: data.method, notes: data.notes, purchaseInvoiceId: invoiceId, idempotencyKey: data.idempotencyKey ?? null, createdAt: new Date() };
      db.payments.push(p); return p;
    },
  },
};

// Balance owed to the supplier, computed with the repository's rules: milk + CONFIRMED invoices
// minus what was paid at purchase minus UNLINKED payments only (linked ones live in invoice.paidAmount).
export const balanceOf = (supplierId) => {
  const milk = db.milk.filter((m) => m.supplierId === supplierId);
  const inv = db.invoices.filter((i) => i.supplierId === supplierId && i.status === "CONFIRMED");
  const general = db.payments.filter((p) => p.supplierId === supplierId && p.purchaseInvoiceId === null);
  const owed = milk.reduce((s, m) => s + m.totalAmount, 0) + inv.reduce((s, i) => s + i.totalAmount, 0);
  const paid = milk.reduce((s, m) => s + m.paidAmount, 0) + inv.reduce((s, i) => s + i.paidAmount, 0) + general.reduce((s, p) => s + p.amount, 0);
  return Math.round((owed - paid) * 100) / 100;
};
export const supplierServiceModule = { supplierService: { getByIdOrThrow: async (id) => ({ id }), getBalance: async (id) => balanceOf(id) } };
export const auditModule = { auditService: { log: async (e) => { db.audit.push(e); } } };
export const productServiceModule = { productService: { getByIdOrThrow: async (id) => ({ id, name: "أكياس", isActive: true }) } };
export const inventoryRepoModule = { inventoryRepository: { getStock: async (id) => stockOf(id) } };
export const settingsModule = { settingsService: { getAll: async () => ({ STORE_NAME_AR: "المتجر", STORE_PHONE: "", STORE_ADDRESS: "", CURRENCY: "USD" }) } };
