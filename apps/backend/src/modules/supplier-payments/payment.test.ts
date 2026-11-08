import { describe, it, expect, vi, beforeEach } from "vitest";

const getBalanceMock = vi.fn();
vi.mock("../suppliers/supplier.service", () => ({
  supplierService: { getBalance: (...a: unknown[]) => getBalanceMock(...a) },
}));

vi.mock("../../services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

const findInvoiceMock = vi.fn();
vi.mock("../purchase-invoices/purchase-invoice.repository", () => ({
  purchaseInvoiceRepository: { findById: (...a: unknown[]) => findInvoiceMock(...a) },
}));

const findByKeyMock = vi.fn();
const createMock = vi.fn();
const createLinkedMock = vi.fn();
vi.mock("./payment.repository", () => ({
  supplierPaymentRepository: {
    findByIdempotencyKey: (...a: unknown[]) => findByKeyMock(...a),
    create: (...a: unknown[]) => createMock(...a),
    createLinked: (...a: unknown[]) => createLinkedMock(...a),
  },
}));

import { supplierPaymentService } from "./payment.service";

const paymentRow = (over: Record<string, unknown> = {}) => ({
  id: "pay1",
  supplierId: "sup_1",
  amount: 60,
  date: new Date("2026-09-04"),
  method: "CASH",
  notes: null,
  purchaseInvoiceId: "inv_1",
  createdAt: new Date(),
  ...over,
});

const invoiceRow = (over: Record<string, unknown> = {}) => ({
  id: "inv_1",
  purchaseNumber: "PUR-000001",
  supplierId: "sup_1",
  status: "CONFIRMED",
  totalAmount: 200,
  paidAmount: 50,
  remainingAmount: 150,
  ...over,
});

const baseInput = {
  supplierId: "sup_1",
  amount: 60,
  date: new Date("2026-09-04"),
  method: "CASH" as const,
  notes: null,
  purchaseInvoiceId: "inv_1",
  idempotencyKey: null,
};

describe("supplierPaymentService.create — payment on a purchase invoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBalanceMock.mockResolvedValue(1000);
    findInvoiceMock.mockResolvedValue(invoiceRow());
    createLinkedMock.mockResolvedValue(paymentRow());
  });

  it("raises paidAmount and lowers remainingAmount of the SAME invoice (50+60 paid, 90 left)", async () => {
    const dto = await supplierPaymentService.create(baseInput, "user_1");

    expect(dto.purchaseInvoiceId).toBe("inv_1");
    const [, invoiceId, expectedPaid, newPaid, newRemaining] = createLinkedMock.mock.calls[0];
    expect(invoiceId).toBe("inv_1");
    expect(expectedPaid).toBe(50); // optimistic-concurrency guard
    expect(newPaid).toBe(110);
    expect(newRemaining).toBe(90);
    expect(createMock).not.toHaveBeenCalled(); // never also written as a general payment
  });

  it("a second payment that settles the invoice leaves remaining = 0", async () => {
    findInvoiceMock.mockResolvedValue(invoiceRow({ paidAmount: 110, remainingAmount: 90 }));
    await supplierPaymentService.create({ ...baseInput, amount: 90 }, "user_1");
    const [, , , newPaid, newRemaining] = createLinkedMock.mock.calls[0];
    expect(newPaid).toBe(200);
    expect(newRemaining).toBe(0);
  });

  it("rejects paying more than the invoice remainder", async () => {
    await expect(
      supplierPaymentService.create({ ...baseInput, amount: 151 }, "user_1"),
    ).rejects.toMatchObject({ errorCode: "PAYMENT_EXCEEDS_INVOICE_REMAINING" });
    expect(createLinkedMock).not.toHaveBeenCalled();
  });

  it("rejects a payment on a cancelled invoice", async () => {
    findInvoiceMock.mockResolvedValue(invoiceRow({ status: "CANCELLED" }));
    await expect(supplierPaymentService.create(baseInput, "user_1")).rejects.toMatchObject({
      errorCode: "PURCHASE_INVOICE_CANCELLED",
    });
  });

  it("rejects an invoice that belongs to another supplier", async () => {
    findInvoiceMock.mockResolvedValue(invoiceRow({ supplierId: "other" }));
    await expect(supplierPaymentService.create(baseInput, "user_1")).rejects.toMatchObject({
      errorCode: "INVOICE_SUPPLIER_MISMATCH",
    });
  });

  it("reports a conflict when the invoice changed between read and write (no payment saved)", async () => {
    createLinkedMock.mockResolvedValue(null);
    await expect(supplierPaymentService.create(baseInput, "user_1")).rejects.toMatchObject({
      errorCode: "PURCHASE_INVOICE_CHANGED",
    });
  });
});

describe("supplierPaymentService.create — general payment and idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBalanceMock.mockResolvedValue(100);
    createMock.mockResolvedValue(paymentRow({ purchaseInvoiceId: null, amount: 30 }));
  });

  it("a general payment does not touch any invoice", async () => {
    await supplierPaymentService.create({ ...baseInput, purchaseInvoiceId: null, amount: 30 }, "user_1");
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createLinkedMock).not.toHaveBeenCalled();
  });

  it("rejects a general payment larger than the supplier balance", async () => {
    await expect(
      supplierPaymentService.create({ ...baseInput, purchaseInvoiceId: null, amount: 101 }, "user_1"),
    ).rejects.toMatchObject({ errorCode: "PAYMENT_EXCEEDS_BALANCE" });
  });

  it("re-sending the same idempotencyKey returns the existing payment and writes nothing", async () => {
    findByKeyMock.mockResolvedValue(paymentRow({ id: "existing" }));
    const dto = await supplierPaymentService.create({ ...baseInput, idempotencyKey: "key-12345678" }, "user_1");
    expect(dto.id).toBe("existing");
    expect(createMock).not.toHaveBeenCalled();
    expect(createLinkedMock).not.toHaveBeenCalled();
  });

  it("recovers from a concurrent duplicate (unique violation) by returning the winner", async () => {
    findByKeyMock.mockResolvedValueOnce(null).mockResolvedValueOnce(paymentRow({ id: "winner", purchaseInvoiceId: null }));
    createMock.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const dto = await supplierPaymentService.create(
      { ...baseInput, purchaseInvoiceId: null, amount: 30, idempotencyKey: "key-12345678" },
      "user_1",
    );
    expect(dto.id).toBe("winner");
  });
});
