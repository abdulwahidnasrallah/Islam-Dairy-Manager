import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../suppliers/supplier.service", () => ({
  supplierService: {
    getByIdOrThrow: vi.fn().mockResolvedValue({ id: "sup_1" }),
  },
}));

vi.mock("../../services/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("./purchase.repository", () => ({
  milkPurchaseRepository: {
    create: vi.fn(async (data: any) => ({
      id: "purchase_1",
      supplierId: data.supplier.connect.id,
      date: data.date,
      quantity: data.quantity,
      pricePerUnit: data.pricePerUnit,
      totalAmount: data.totalAmount,
      paidAmount: data.paidAmount,
      remainingAmount: data.remainingAmount,
      notes: data.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findMany: vi.fn(),
  },
}));

import { milkPurchaseService } from "./purchase.service";

describe("milkPurchaseService.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates totalAmount as quantity × pricePerUnit and the correct remaining amount", async () => {
    const result = await milkPurchaseService.create(
      {
        supplierId: "sup_1",
        date: new Date("2026-07-01"),
        quantity: 80,
        pricePerUnit: 2.5,
        paidAmount: 100,
        notes: null,
      },
      "user_1",
    );

    expect(result.totalAmount).toBe(200);
    expect(result.paidAmount).toBe(100);
    expect(result.remainingAmount).toBe(100);
  });

  it("rejects a paidAmount greater than the calculated total", async () => {
    await expect(
      milkPurchaseService.create(
        {
          supplierId: "sup_1",
          date: new Date("2026-07-01"),
          quantity: 10,
          pricePerUnit: 2,
          paidAmount: 999,
          notes: null,
        },
        "user_1",
      ),
    ).rejects.toMatchObject({ errorCode: "PAID_EXCEEDS_TOTAL" });
  });
});
