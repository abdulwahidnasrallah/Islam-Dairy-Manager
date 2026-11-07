import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../customers/customer.service", () => ({
  customerService: {
    getByIdOrThrow: vi.fn().mockResolvedValue({ id: "cust_1" }),
  },
}));

const getByIdOrThrowMock = vi.fn(async (id: string) => ({
  id,
  name: id === "prod_1" ? "جبنة بيضاء" : "لبنة",
  isActive: true,
  costPrice: id === "prod_1" ? 6 : null,
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
      INVOICE_PREFIX: "INV",
      INVOICE_FOOTER_NOTE: "",
      DEFAULT_MIN_STOCK_ALERT: 0,
      LOW_STOCK_ALERTS_ENABLED: true,
      DEBT_ALERT_THRESHOLD: 0,
    }),
  },
}));

vi.mock("../../services/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

let invoiceCounter = 0;
const createWithMovementsMock = vi.fn(async (invoiceData: any, itemsData: any[]) => {
  invoiceCounter += 1;
  return {
    id: "invoice_1",
    invoiceNumber: `INV-${String(invoiceCounter).padStart(6, "0")}`,
    customerId: invoiceData.customer.connect.id,
    customer: { name: "بقالة الأمل" },
    date: invoiceData.date,
    totalAmount: invoiceData.totalAmount,
    paidAmount: invoiceData.paidAmount,
    remainingAmount: invoiceData.remainingAmount,
    status: "CONFIRMED",
    notes: invoiceData.notes,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: itemsData.map((item, i) => ({
      id: `item_${i}`,
      invoiceId: "invoice_1",
      product: { name: "جبنة بيضاء" },
      ...item,
    })),
  };
});

const cancelWithMovementsMock = vi.fn();
const findByIdMock = vi.fn();

vi.mock("./sales.repository", () => ({
  salesRepository: {
    createWithMovements: (...args: unknown[]) => createWithMovementsMock(...args),
    cancelWithMovements: (...args: unknown[]) => cancelWithMovementsMock(...args),
    findById: (...args: unknown[]) => findByIdMock(...args),
  },
}));

import { salesService } from "./sales.service";

describe("salesService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invoiceCounter = 0;
    getStockMock.mockResolvedValue(100);
  });

  it("computes totals server-side and creates matching OUT/SALE movements", async () => {
    const result = await salesService.create(
      {
        customerId: "cust_1",
        date: new Date("2026-08-01"),
        items: [
          { productId: "prod_1", quantity: 5, unitPrice: 10 },
          { productId: "prod_1", quantity: 3, unitPrice: 10 },
        ],
        paidAmount: 40,
        notes: null,
      },
      "user_1",
    );

    expect(result.totalAmount).toBe(80);
    expect(result.remainingAmount).toBe(40);
    expect(result.invoiceNumber).toBe("INV-000001");
    expect(result.status).toBe("CONFIRMED");
    expect(createWithMovementsMock).toHaveBeenCalledTimes(1);

    const [, itemsData, , invoicePrefix] = createWithMovementsMock.mock.calls[0];
    expect(itemsData).toHaveLength(2);
    expect(itemsData[0].totalPrice).toBe(50);
    expect(invoicePrefix).toBe("INV");
  });

  it("snapshots the product's current costPrice as unitCost on each item", async () => {
    await salesService.create(
      {
        customerId: "cust_1",
        date: new Date("2026-08-01"),
        items: [{ productId: "prod_1", quantity: 2, unitPrice: 10 }],
        paidAmount: 20,
        notes: null,
      },
      "user_1",
    );

    const [, itemsData] = createWithMovementsMock.mock.calls[0];
    expect(itemsData[0].unitCost).toBe(6);
  });

  it("stores unitCost as null when the product has no costPrice set", async () => {
    await salesService.create(
      {
        customerId: "cust_1",
        date: new Date("2026-08-01"),
        items: [{ productId: "prod_2", quantity: 1, unitPrice: 8 }],
        paidAmount: 8,
        notes: null,
      },
      "user_1",
    );

    const [, itemsData] = createWithMovementsMock.mock.calls[0];
    expect(itemsData[0].unitCost).toBeNull();
  });

  it("rejects a sale when the combined quantity for a product exceeds stock", async () => {
    getStockMock.mockResolvedValue(6);

    await expect(
      salesService.create(
        {
          customerId: "cust_1",
          date: new Date("2026-08-01"),
          items: [
            { productId: "prod_1", quantity: 5, unitPrice: 10 },
            { productId: "prod_1", quantity: 3, unitPrice: 10 },
          ],
          paidAmount: 0,
          notes: null,
        },
        "user_1",
      ),
    ).rejects.toMatchObject({ errorCode: "INSUFFICIENT_STOCK" });

    expect(createWithMovementsMock).not.toHaveBeenCalled();
  });

  it("rejects a paid amount greater than the invoice total", async () => {
    await expect(
      salesService.create(
        {
          customerId: "cust_1",
          date: new Date("2026-08-01"),
          items: [{ productId: "prod_1", quantity: 1, unitPrice: 10 }],
          paidAmount: 50,
          notes: null,
        },
        "user_1",
      ),
    ).rejects.toMatchObject({ errorCode: "OVERPAYMENT" });

    expect(createWithMovementsMock).not.toHaveBeenCalled();
  });
});

describe("salesService.cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function invoiceFixture(status: "CONFIRMED" | "CANCELLED") {
    return {
      id: "invoice_1",
      invoiceNumber: "INV-000001",
      customerId: "cust_1",
      customer: { name: "بقالة الأمل" },
      date: new Date("2026-08-01"),
      totalAmount: 50,
      paidAmount: 50,
      remainingAmount: 0,
      status,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: "item_1",
          invoiceId: "invoice_1",
          productId: "prod_1",
          product: { name: "جبنة بيضاء" },
          quantity: 5,
          unitPrice: 10,
          unitCost: 6,
          totalPrice: 50,
        },
      ],
    };
  }

  it("cancels a confirmed invoice and reverses stock via the repository", async () => {
    findByIdMock.mockResolvedValue(invoiceFixture("CONFIRMED"));
    cancelWithMovementsMock.mockResolvedValue(invoiceFixture("CANCELLED"));

    const result = await salesService.cancel("invoice_1", "user_1");

    expect(result.status).toBe("CANCELLED");
    expect(cancelWithMovementsMock).toHaveBeenCalledWith("invoice_1", expect.any(Date));
  });

  it("rejects cancelling an invoice that is already cancelled", async () => {
    findByIdMock.mockResolvedValue(invoiceFixture("CANCELLED"));

    await expect(salesService.cancel("invoice_1", "user_1")).rejects.toMatchObject({
      errorCode: "INVOICE_ALREADY_CANCELLED",
    });

    expect(cancelWithMovementsMock).not.toHaveBeenCalled();
  });

  it("rejects cancelling an invoice that doesn't exist", async () => {
    findByIdMock.mockResolvedValue(null);

    await expect(salesService.cancel("nope", "user_1")).rejects.toMatchObject({
      errorCode: "INVOICE_NOT_FOUND",
    });
  });
});
