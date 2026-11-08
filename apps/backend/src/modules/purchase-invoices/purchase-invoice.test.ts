import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../suppliers/supplier.service", () => ({
  supplierService: {
    getByIdOrThrow: vi.fn().mockResolvedValue({ id: "sup_1" }),
  },
}));

const getByIdOrThrowMock = vi.fn(async (id: string) => ({
  id,
  name: id === "prod_1" ? "أكياس تعبئة" : "منتج آخر",
  isActive: true,
  costPrice: 4,
}));

vi.mock("../products/product.service", () => ({
  productService: {
    getByIdOrThrow: (...args: unknown[]) => getByIdOrThrowMock(...(args as [string])),
  },
}));

const getStockMock = vi.fn();
vi.mock("../inventory/inventory.repository", () => ({
  inventoryRepository: {
    getStock: (...args: unknown[]) => getStockMock(...args),
  },
}));

vi.mock("../settings/settings.service", () => ({
  settingsService: {
    getAll: vi.fn().mockResolvedValue({
      STORE_NAME_AR: "إسلام للألبان والأجبان",
      STORE_PHONE: "",
      STORE_ADDRESS: "",
      CURRENCY: "USD",
    }),
  },
}));

vi.mock("../../services/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

let purchaseCounter = 0;
const createWithMovementsMock = vi.fn(
  async (purchaseData: any, itemsData: any[], _purchaseDate: Date, prefix: string) => {
    purchaseCounter += 1;
    return {
      id: "purchase_1",
      purchaseNumber: `${prefix}-${String(purchaseCounter).padStart(6, "0")}`,
      supplierId: purchaseData.supplier.connect.id,
      supplier: { name: "مزرعة النور" },
      date: purchaseData.date,
      totalAmount: purchaseData.totalAmount,
      paidAmount: purchaseData.paidAmount,
      remainingAmount: purchaseData.remainingAmount,
      paymentMethod: purchaseData.paymentMethod,
      status: "CONFIRMED",
      notes: purchaseData.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: itemsData.map((item, i) => ({
        id: `item_${i}`,
        purchaseInvoiceId: "purchase_1",
        product: { name: "أكياس تعبئة", unit: "PIECE" },
        ...item,
      })),
    };
  },
);

const cancelWithMovementsMock = vi.fn();
const findByIdMock = vi.fn();
const findByIdempotencyKeyMock = vi.fn();

vi.mock("./purchase-invoice.repository", () => ({
  purchaseInvoiceRepository: {
    createWithMovements: (...args: unknown[]) => createWithMovementsMock(...args),
    cancelWithMovements: (...args: unknown[]) => cancelWithMovementsMock(...args),
    findById: (...args: unknown[]) => findByIdMock(...args),
    findByIdempotencyKey: (...args: unknown[]) => findByIdempotencyKeyMock(...args),
  },
}));

import { purchaseInvoiceService } from "./purchase-invoice.service";

describe("purchaseInvoiceService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    purchaseCounter = 0;
    getStockMock.mockResolvedValue(0);
  });

  it("computes totals server-side, generates a PUR-prefixed number, and records the remaining debt", async () => {
    const result = await purchaseInvoiceService.create(
      {
        supplierId: "sup_1",
        date: new Date("2026-09-01"),
        items: [{ productId: "prod_1", quantity: 10, unitPrice: 5 }],
        paidAmount: 30,
        paymentMethod: "CASH",
        notes: null,
      },
      "user_1",
    );

    expect(result.totalAmount).toBe(50);
    expect(result.paidAmount).toBe(30);
    expect(result.remainingAmount).toBe(20);
    expect(result.purchaseNumber).toBe("PUR-000001");
    expect(result.status).toBe("CONFIRMED");
    expect(createWithMovementsMock).toHaveBeenCalledTimes(1);

    const [, itemsData, , prefix] = createWithMovementsMock.mock.calls[0];
    expect(itemsData[0].totalPrice).toBe(50);
    expect(prefix).toBe("PUR");
  });

  it("sums multiple lines for the same product into one server-computed total", async () => {
    const result = await purchaseInvoiceService.create(
      {
        supplierId: "sup_1",
        date: new Date("2026-09-01"),
        items: [
          { productId: "prod_1", quantity: 4, unitPrice: 2.5 },
          { productId: "prod_1", quantity: 6, unitPrice: 2.5 },
        ],
        paidAmount: 0,
        paymentMethod: "CASH",
        notes: null,
      },
      "user_1",
    );

    expect(result.totalAmount).toBe(25);
    expect(result.remainingAmount).toBe(25);
  });

  it("rejects when the paid amount exceeds the invoice total (overpayment)", async () => {
    await expect(
      purchaseInvoiceService.create(
        {
          supplierId: "sup_1",
          date: new Date("2026-09-01"),
          items: [{ productId: "prod_1", quantity: 1, unitPrice: 10 }],
          paidAmount: 999,
          paymentMethod: "CASH",
          notes: null,
        },
        "user_1",
      ),
    ).rejects.toMatchObject({ errorCode: "OVERPAYMENT" });

    expect(createWithMovementsMock).not.toHaveBeenCalled();
  });
});

describe("purchaseInvoiceService.create — idempotency and payment status", () => {
  const input = {
    supplierId: "sup_1",
    date: new Date("2026-09-01"),
    items: [{ productId: "prod_1", quantity: 10, unitPrice: 5 }],
    paidAmount: 0,
    paymentMethod: "CASH" as const,
    notes: null,
    idempotencyKey: "key-12345678",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    purchaseCounter = 0;
    findByIdempotencyKeyMock.mockResolvedValue(null);
  });

  it("re-sending the same key returns the existing invoice: no second invoice, no second stock movement", async () => {
    findByIdempotencyKeyMock.mockResolvedValue({
      id: "purchase_1",
      purchaseNumber: "PUR-000001",
      status: "CONFIRMED",
      supplierId: "sup_1",
      date: new Date("2026-09-01"),
      totalAmount: 50,
      paidAmount: 0,
      remainingAmount: 50,
      paymentMethod: "CASH",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    });

    const result = await purchaseInvoiceService.create(input, "user_1");

    expect(result.purchaseNumber).toBe("PUR-000001");
    expect(createWithMovementsMock).not.toHaveBeenCalled();
  });

  it("stores the up-front payment as initialPaidAmount and the key on the invoice", async () => {
    await purchaseInvoiceService.create({ ...input, paidAmount: 20 }, "user_1");
    const [purchaseData] = createWithMovementsMock.mock.calls[0];
    expect(purchaseData.initialPaidAmount).toBe(20);
    expect(purchaseData.idempotencyKey).toBe("key-12345678");
  });

  it("reports UNPAID / PARTIAL / PAID from paid vs. total", async () => {
    const unpaid = await purchaseInvoiceService.create(input, "user_1");
    expect(unpaid.paymentStatus).toBe("UNPAID");
    const partial = await purchaseInvoiceService.create({ ...input, idempotencyKey: null, paidAmount: 20 }, "user_1");
    expect(partial.paymentStatus).toBe("PARTIAL");
    const paid = await purchaseInvoiceService.create({ ...input, idempotencyKey: null, paidAmount: 50 }, "user_1");
    expect(paid.paymentStatus).toBe("PAID");
  });
});

describe("purchaseInvoiceService.cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reverses stock and flips status to CANCELLED when enough stock remains", async () => {
    findByIdMock.mockResolvedValue({
      id: "purchase_1",
      purchaseNumber: "PUR-000001",
      status: "CONFIRMED",
      supplierId: "sup_1",
      supplier: { name: "مزرعة النور" },
      date: new Date("2026-09-01"),
      totalAmount: 50,
      paidAmount: 30,
      remainingAmount: 20,
      paymentMethod: "CASH",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: "item_0",
          purchaseInvoiceId: "purchase_1",
          productId: "prod_1",
          product: { name: "أكياس تعبئة", unit: "PIECE" },
          quantity: 10,
          unitPrice: 5,
          totalPrice: 50,
        },
      ],
    });
    getStockMock.mockResolvedValue(15); // enough left to reverse 10
    cancelWithMovementsMock.mockResolvedValue({
      id: "purchase_1",
      purchaseNumber: "PUR-000001",
      status: "CANCELLED",
      supplierId: "sup_1",
      supplier: { name: "مزرعة النور" },
      date: new Date("2026-09-01"),
      totalAmount: 50,
      paidAmount: 30,
      remainingAmount: 20,
      paymentMethod: "CASH",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: "item_0",
          purchaseInvoiceId: "purchase_1",
          productId: "prod_1",
          product: { name: "أكياس تعبئة", unit: "PIECE" },
          quantity: 10,
          unitPrice: 5,
          totalPrice: 50,
        },
      ],
    });

    const result = await purchaseInvoiceService.cancel("purchase_1", "user_1");

    expect(result.status).toBe("CANCELLED");
    expect(cancelWithMovementsMock).toHaveBeenCalledTimes(1);
  });

  it("rejects cancellation when the purchased stock has already been partially sold/consumed", async () => {
    findByIdMock.mockResolvedValue({
      id: "purchase_1",
      purchaseNumber: "PUR-000001",
      status: "CONFIRMED",
      supplierId: "sup_1",
      supplier: { name: "مزرعة النور" },
      date: new Date("2026-09-01"),
      totalAmount: 50,
      paidAmount: 0,
      remainingAmount: 50,
      paymentMethod: "CASH",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: "item_0",
          purchaseInvoiceId: "purchase_1",
          productId: "prod_1",
          product: { name: "أكياس تعبئة", unit: "PIECE" },
          quantity: 10,
          unitPrice: 5,
          totalPrice: 50,
        },
      ],
    });
    getStockMock.mockResolvedValue(3); // only 3 left — can't reverse 10

    await expect(purchaseInvoiceService.cancel("purchase_1", "user_1")).rejects.toMatchObject({
      errorCode: "INSUFFICIENT_STOCK_TO_CANCEL",
    });
    expect(cancelWithMovementsMock).not.toHaveBeenCalled();
  });

  it("rejects cancelling an already-cancelled invoice", async () => {
    findByIdMock.mockResolvedValue({
      id: "purchase_1",
      purchaseNumber: "PUR-000001",
      status: "CANCELLED",
      supplierId: "sup_1",
      supplier: { name: "مزرعة النور" },
      date: new Date("2026-09-01"),
      totalAmount: 50,
      paidAmount: 0,
      remainingAmount: 50,
      paymentMethod: "CASH",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    });

    await expect(purchaseInvoiceService.cancel("purchase_1", "user_1")).rejects.toMatchObject({
      errorCode: "PURCHASE_INVOICE_ALREADY_CANCELLED",
    });
    expect(cancelWithMovementsMock).not.toHaveBeenCalled();
  });

  it("surfaces a conflict if cancelWithMovements loses a race and finds the invoice already flipped", async () => {
    findByIdMock.mockResolvedValue({
      id: "purchase_1",
      purchaseNumber: "PUR-000001",
      status: "CONFIRMED",
      supplierId: "sup_1",
      supplier: { name: "مزرعة النور" },
      date: new Date("2026-09-01"),
      totalAmount: 50,
      paidAmount: 0,
      remainingAmount: 50,
      paymentMethod: "CASH",
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: "item_0",
          purchaseInvoiceId: "purchase_1",
          productId: "prod_1",
          product: { name: "أكياس تعبئة", unit: "PIECE" },
          quantity: 10,
          unitPrice: 5,
          totalPrice: 50,
        },
      ],
    });
    getStockMock.mockResolvedValue(50);
    cancelWithMovementsMock.mockResolvedValue(null);

    await expect(purchaseInvoiceService.cancel("purchase_1", "user_1")).rejects.toMatchObject({
      errorCode: "PURCHASE_INVOICE_ALREADY_CANCELLED",
    });
  });
});
