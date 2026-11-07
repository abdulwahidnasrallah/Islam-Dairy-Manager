import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../products/product.service", () => ({
  productService: {
    getByIdOrThrow: vi.fn().mockResolvedValue({ id: "prod_1" }),
  },
}));

vi.mock("../../services/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

const getStockMock = vi.fn();
const createMock = vi.fn(async (data: any) => ({
  id: "movement_1",
  productId: data.product.connect.id,
  type: data.type,
  reason: data.reason,
  quantity: data.quantity,
  date: data.date,
  notes: data.notes,
  createdAt: new Date(),
}));

vi.mock("./inventory.repository", () => ({
  inventoryRepository: {
    getStock: (...args: unknown[]) => getStockMock(...args),
    create: (...args: unknown[]) => createMock(...args),
  },
}));

import { inventoryService } from "./inventory.service";

describe("inventoryService.adjust", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an OUT adjustment up to the current stock", async () => {
    getStockMock.mockResolvedValue(50);

    const result = await inventoryService.adjust(
      {
        productId: "prod_1",
        type: "OUT",
        quantity: 50,
        date: new Date("2026-07-01"),
        reason: "ADJUSTMENT",
        notes: null,
      },
      "user_1",
    );

    expect(result.quantity).toBe(50);
    expect(createMock).toHaveBeenCalled();
  });

  it("rejects an OUT adjustment greater than the current stock", async () => {
    getStockMock.mockResolvedValue(10);

    await expect(
      inventoryService.adjust(
        {
          productId: "prod_1",
          type: "OUT",
          quantity: 20,
          date: new Date("2026-07-01"),
          reason: "DAMAGE",
          notes: null,
        },
        "user_1",
      ),
    ).rejects.toMatchObject({ errorCode: "INSUFFICIENT_STOCK" });

    expect(createMock).not.toHaveBeenCalled();
  });

  it("does not check current stock for an IN adjustment", async () => {
    const result = await inventoryService.adjust(
      {
        productId: "prod_1",
        type: "IN",
        quantity: 30,
        date: new Date("2026-07-01"),
        reason: "RETURN",
        notes: null,
      },
      "user_1",
    );

    expect(result.type).toBe("IN");
    expect(getStockMock).not.toHaveBeenCalled();
  });
});
