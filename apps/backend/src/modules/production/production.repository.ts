import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

export const productionRepository = {
  findMany(productId?: string) {
    return prisma.productionBatch.findMany({
      where: productId ? { productId } : undefined,
      orderBy: { date: "desc" },
    });
  },

  /**
   * Creates the ProductionBatch AND its matching InventoryMovement (IN,
   * reason PRODUCTION) inside a single transaction, so a batch can never
   * exist without the stock increase it implies, or vice versa.
   */
  createWithMovement(
    batchData: Prisma.ProductionBatchCreateInput,
    movementData: Prisma.InventoryMovementCreateInput,
  ) {
    return prisma.$transaction(async (tx) => {
      const batch = await tx.productionBatch.create({ data: batchData });
      await tx.inventoryMovement.create({ data: movementData });
      return batch;
    });
  },
};
