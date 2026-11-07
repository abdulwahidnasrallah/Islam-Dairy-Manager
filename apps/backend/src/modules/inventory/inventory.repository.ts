import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Only this file talks to Prisma for InventoryMovement. Exposed to the
 * products module too (read-only stock aggregation) so a product's
 * current stock is always computed the same way everywhere — never
 * duplicated as a stored, driftable field.
 */
export const inventoryRepository = {
  findMovements(productId?: string) {
    return prisma.inventoryMovement.findMany({
      where: productId ? { productId } : undefined,
      orderBy: { date: "desc" },
    });
  },

  create(data: Prisma.InventoryMovementCreateInput) {
    return prisma.inventoryMovement.create({ data });
  },

  /** Current stock = sum(IN) − sum(OUT), derived on demand. */
  async getStock(productId: string): Promise<number> {
    const [inAgg, outAgg] = await Promise.all([
      prisma.inventoryMovement.aggregate({
        where: { productId, type: "IN" },
        _sum: { quantity: true },
      }),
      prisma.inventoryMovement.aggregate({
        where: { productId, type: "OUT" },
        _sum: { quantity: true },
      }),
    ]);

    return (inAgg._sum.quantity ?? 0) - (outAgg._sum.quantity ?? 0);
  },

  /** Batch version of getStock, used by the products/inventory list pages. */
  async getStockMap(productIds: string[]): Promise<Map<string, number>> {
    if (productIds.length === 0) return new Map();

    const grouped = await prisma.inventoryMovement.groupBy({
      by: ["productId", "type"],
      where: { productId: { in: productIds } },
      _sum: { quantity: true },
    });

    const stockMap = new Map<string, number>();
    for (const id of productIds) stockMap.set(id, 0);

    for (const row of grouped) {
      const current = stockMap.get(row.productId) ?? 0;
      const value = row._sum.quantity ?? 0;
      stockMap.set(row.productId, row.type === "IN" ? current + value : current - value);
    }

    return stockMap;
  },
};
