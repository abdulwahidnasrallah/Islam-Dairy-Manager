import { describe, it, expect, vi, beforeEach } from "vitest";

const getByIdOrThrowMock = vi.fn().mockResolvedValue({ id: "prod_1" });
const updateProductMock = vi.fn().mockResolvedValue({ id: "prod_1", costPrice: 1 });
vi.mock("../products/product.service", () => ({
  productService: {
    getByIdOrThrow: (...args: unknown[]) => getByIdOrThrowMock(...args),
    update: (...args: unknown[]) => updateProductMock(...args),
  },
}));

const getRecentAverageMilkPriceMock = vi.fn();
vi.mock("../milk-purchases/purchase.service", () => ({
  milkPurchaseService: {
    getRecentAverageMilkPrice: () => getRecentAverageMilkPriceMock(),
  },
}));

vi.mock("../../services/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

const createWithMovementMock = vi.fn(async (batchData: any) => ({
  id: "batch_1",
  productId: batchData.product.connect.id,
  date: batchData.date,
  quantityProduced: batchData.quantityProduced,
  milkConsumed: batchData.milkConsumed,
  notes: batchData.notes,
  createdAt: new Date(),
  updatedAt: new Date(),
}));

vi.mock("./production.repository", () => ({
  productionRepository: {
    createWithMovement: (...args: unknown[]) => createWithMovementMock(...args),
  },
}));

import { productionService } from "./production.service";

describe("productionService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecentAverageMilkPriceMock.mockResolvedValue(1); // 1 currency unit per liter
  });

  it("creates a batch and passes a matching IN/PRODUCTION movement in the same call", async () => {
    const result = await productionService.create(
      {
        productId: "prod_1",
        date: new Date("2026-07-01"),
        quantityProduced: 40,
        milkConsumed: 400,
        notes: null,
      },
      "user_1",
    );

    expect(result.quantityProduced).toBe(40);
    expect(createWithMovementMock).toHaveBeenCalledTimes(1);

    const [batchData, movementData] = createWithMovementMock.mock.calls[0];
    expect(batchData.quantityProduced).toBe(40);
    expect(movementData.type).toBe("IN");
    expect(movementData.reason).toBe("PRODUCTION");
    expect(movementData.quantity).toBe(40);
  });

  it("auto-updates the product's costPrice from milkConsumed × average milk price ÷ quantityProduced", async () => {
    getRecentAverageMilkPriceMock.mockResolvedValue(2); // 2 currency units per liter

    await productionService.create(
      {
        productId: "prod_1",
        date: new Date("2026-07-01"),
        quantityProduced: 20, // kg produced
        milkConsumed: 100, // liters consumed
        notes: null,
      },
      "user_1",
    );

    // cost = (100 liters * 2/liter) / 20 kg = 10 per kg
    expect(updateProductMock).toHaveBeenCalledWith("prod_1", { costPrice: 10 }, "user_1");
  });

  it("does not touch costPrice when no milk purchase history exists yet", async () => {
    getRecentAverageMilkPriceMock.mockResolvedValue(null);

    await productionService.create(
      {
        productId: "prod_1",
        date: new Date("2026-07-01"),
        quantityProduced: 20,
        milkConsumed: 100,
        notes: null,
      },
      "user_1",
    );

    expect(updateProductMock).not.toHaveBeenCalled();
  });

  it("does not touch costPrice when milkConsumed wasn't recorded for the batch", async () => {
    await productionService.create(
      {
        productId: "prod_1",
        date: new Date("2026-07-01"),
        quantityProduced: 20,
        milkConsumed: null,
        notes: null,
      },
      "user_1",
    );

    expect(updateProductMock).not.toHaveBeenCalled();
    expect(getRecentAverageMilkPriceMock).not.toHaveBeenCalled();
  });
});
