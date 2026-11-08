/**
 * Pure supplier-accounting helpers (no dependencies) shared by the backend and
 * the frontend, so the number a supplier statement shows and the number the
 * supplier balance query returns come from ONE set of rules.
 *
 * Money rules used everywhere:
 *  - A CONFIRMED purchase invoice adds its total to what the store owes.
 *  - What was paid on it is `initialPaidAmount` (paid on creation) plus every
 *    payment linked to it; both together equal the invoice's `paidAmount`.
 *  - A CANCELLED invoice — and any payment linked to it — counts for nothing.
 *  - A payment with no invoice is a general payment against the balance.
 *  - Milk purchases (MilkPurchase) have no status and no linked payments:
 *    total owed = totalAmount, paid at delivery = paidAmount.
 */

/** Money is stored as Float; rounding to 2 decimals stops 0.1 + 0.2 drifting. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type PurchasePaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

/** Derived (never stored) so it can never disagree with paid / remaining. */
export function getPurchasePaymentStatus(totalAmount: number, paidAmount: number): PurchasePaymentStatus {
  const remaining = roundMoney(totalAmount - paidAmount);
  if (remaining <= 0) return "PAID";
  if (paidAmount <= 0) return "UNPAID";
  return "PARTIAL";
}

export interface StatementMilkPurchase {
  id: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
}
export interface StatementPurchaseInvoice {
  id: string;
  purchaseNumber: string;
  date: string;
  totalAmount: number;
  initialPaidAmount: number;
  status: string;
}
export interface StatementPayment {
  id: string;
  date: string;
  amount: number;
  purchaseInvoiceId: string | null;
}

export interface SupplierStatementEntry {
  id: string;
  date: string;
  kind: "MILK_PURCHASE" | "PURCHASE_INVOICE" | "PAYMENT";
  reference: string;
  /** Increases what the store owes the supplier. */
  debit: number;
  /** Decreases it. */
  credit: number;
  /** Running balance owed to the supplier after this entry. */
  balance: number;
}

export interface SupplierStatement {
  entries: SupplierStatementEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

const KIND_ORDER = { MILK_PURCHASE: 0, PURCHASE_INVOICE: 1, PAYMENT: 2 } as const;

export function buildSupplierStatement(input: {
  milkPurchases: StatementMilkPurchase[];
  purchaseInvoices: StatementPurchaseInvoice[];
  payments: StatementPayment[];
}): SupplierStatement {
  const confirmedInvoiceIds = new Set(
    input.purchaseInvoices.filter((i) => i.status === "CONFIRMED").map((i) => i.id),
  );

  type Raw = Omit<SupplierStatementEntry, "balance">;
  const raw: Raw[] = [];

  for (const m of input.milkPurchases) {
    raw.push({
      id: `milk:${m.id}`,
      date: m.date,
      kind: "MILK_PURCHASE",
      reference: "شراء حليب",
      debit: roundMoney(m.totalAmount),
      credit: roundMoney(m.paidAmount),
    });
  }
  for (const i of input.purchaseInvoices) {
    if (i.status !== "CONFIRMED") continue; // cancelled: never part of the account
    raw.push({
      id: `invoice:${i.id}`,
      date: i.date,
      kind: "PURCHASE_INVOICE",
      reference: i.purchaseNumber,
      debit: roundMoney(i.totalAmount),
      credit: roundMoney(i.initialPaidAmount),
    });
  }
  for (const p of input.payments) {
    // A payment linked to a cancelled (or unknown) invoice is excluded, exactly
    // like the balance query does.
    if (p.purchaseInvoiceId !== null && !confirmedInvoiceIds.has(p.purchaseInvoiceId)) continue;
    raw.push({
      id: `payment:${p.id}`,
      date: p.date,
      kind: "PAYMENT",
      reference: p.purchaseInvoiceId ? "دفعة على فاتورة" : "دفعة",
      debit: 0,
      credit: roundMoney(p.amount),
    });
  }

  raw.sort((a, b) => {
    const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (byDate !== 0) return byDate;
    const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return byKind !== 0 ? byKind : a.id.localeCompare(b.id);
  });

  let balance = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const entries = raw.map((e) => {
    balance = roundMoney(balance + e.debit - e.credit);
    totalDebit = roundMoney(totalDebit + e.debit);
    totalCredit = roundMoney(totalCredit + e.credit);
    return { ...e, balance };
  });

  return { entries, totalDebit, totalCredit, closingBalance: balance };
}
