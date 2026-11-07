import { beforeEach, describe, expect, it, vi } from "vitest";

const createForInvoiceMock = vi.fn();
const createGeneralMock = vi.fn();
const getByIdOrThrowMock = vi.fn();
const auditLogMock = vi.fn();

vi.mock("./payment.repository", () => ({
  supplierPaymentRepository: {
    findMany: vi.fn(),
    createForInvoice: (...args: unknown[]) => createForInvoiceMock(...args),
    createGeneral: (...args: unknown[]) => createGeneralMock(...args),
  },
}));

vi.mock("../suppliers/supplier.service", () => ({
  supplierService: { getByIdOrThrow: (...args: unknown[]) => getByIdOrThrowMock(...args) },
}));

vi.mock("../../services/audit.service", () => ({
  auditService: { log: (...args: unknown[]) => auditLogMock(...args) },
}));

import { supplierPaymentService } from "./payment.service";

describe("supplierPaymentService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getByIdOrThrowMock.mockResolvedValue({ id: "supplier_1" });
    auditLogMock.mockResolvedValue(undefined);
  });

  it("allocates a later payment to the invoice and preserves the invoice link", async () => {
    createForInvoiceMock.mockResolvedValue({
      kind: "created",
      payment: {
        id: "payment_2",
        supplierId: "supplier_1",
        purchaseInvoiceId: "invoice_1",
        amount: 40,
        date: new Date("2026-11-04"),
        method: "CASH",
        notes: null,
        createdAt: new Date("2026-11-04"),
      },
    });

    const result = await supplierPaymentService.create(
      {
        supplierId: "supplier_1",
        purchaseInvoiceId: "invoice_1",
        amount: 40,
        date: new Date("2026-11-04"),
        method: "CASH",
        notes: null,
      },
      "user_1",
    );

    expect(result.purchaseInvoiceId).toBe("invoice_1");
    expect(result.amount).toBe(40);
    expect(createForInvoiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseInvoice: { connect: { id: "invoice_1" } } }),
      "invoice_1",
    );
    expect(auditLogMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an invoice payment that exceeds the remaining amount", async () => {
    createForInvoiceMock.mockResolvedValue({ kind: "overpayment", balance: 30 });

    await expect(
      supplierPaymentService.create(
        {
          supplierId: "supplier_1",
          purchaseInvoiceId: "invoice_1",
          amount: 31,
          date: new Date("2026-11-04"),
          method: "CASH",
        },
        "user_1",
      ),
    ).rejects.toMatchObject({ errorCode: "PAYMENT_EXCEEDS_INVOICE_BALANCE" });
    expect(auditLogMock).not.toHaveBeenCalled();
  });
});
