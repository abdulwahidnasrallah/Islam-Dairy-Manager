import { productionRepository } from "./production.repository";
import { productService } from "../products/product.service";
import { milkPurchaseService } from "../milk-purchases/purchase.service";
import { auditService } from "../../services/audit.service";
import type { CreateProductionBatchInput } from "@idm/shared-validation";
import type { ProductionBatch } from "@idm/shared-types";

function toDto(batch: {
  id: string;
  productId: string;
  date: Date;
  quantityProduced: number;
  milkConsumed: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ProductionBatch {
  return {
    id: batch.id,
    productId: batch.productId,
    date: batch.date.toISOString(),
    quantityProduced: batch.quantityProduced,
    milkConsumed: batch.milkConsumed,
    notes: batch.notes,
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  };
}

export const productionService = {
  async list(productId?: string): Promise<ProductionBatch[]> {
    const batches = await productionRepository.findMany(productId);
    return batches.map(toDto);
  },

  async create(input: CreateProductionBatchInput, actorUserId: string): Promise<ProductionBatch> {
    // Confirms the product exists — throws PRODUCT_NOT_FOUND otherwise.
    await productService.getByIdOrThrow(input.productId);

    const created = await productionRepository.createWithMovement(
      {
        product: { connect: { id: input.productId } },
        date: input.date,
        quantityProduced: input.quantityProduced,
        milkConsumed: input.milkConsumed ?? null,
        notes: input.notes ?? null,
      },
      {
        product: { connect: { id: input.productId } },
        type: "IN",
        reason: "PRODUCTION",
        quantity: input.quantityProduced,
        date: input.date,
        notes: "دفعة إنتاج",
      },
    );

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_PRODUCTION_BATCH",
      entityType: "ProductionBatch",
      entityId: created.id,
      newValue: created,
    });

    // Auto-links production cost → product cost: this batch's raw-milk
    // cost (quantity × recent average milk price) becomes the product's
    // new costPrice, so profit reporting reflects actual manufacturing
    // cost instead of staying blank or stale. Best-effort — if there's
    // no milk purchase history yet (avg price unavailable) the product's
    // costPrice is simply left as it was; this never fails the batch.
    if (input.milkConsumed && input.milkConsumed > 0 && input.quantityProduced > 0) {
      const avgMilkPrice = await milkPurchaseService.getRecentAverageMilkPrice();
      if (avgMilkPrice !== null) {
        const estimatedUnitCost = (input.milkConsumed * avgMilkPrice) / input.quantityProduced;
        await productService.update(
          input.productId,
          { costPrice: round2(estimatedUnitCost) },
          actorUserId,
        );
      }
    }

    // NOTE: deducting milkConsumed from a raw-milk inventory happens once
    // raw-material stock tracking exists. MilkPurchase only records what
    // was bought from suppliers, not what remains on hand — tracking that
    // needs a raw-material stock model, intentionally out of scope here.

    return toDto(created);
  },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
