import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

export const milkPurchaseRepository = {
  findMany(supplierId?: string) {
    return prisma.milkPurchase.findMany({
      where: supplierId ? { supplierId } : undefined,
      orderBy: { date: "desc" },
    });
  },

  findById(id: string) {
    return prisma.milkPurchase.findUnique({ where: { id } });
  },

  create(data: Prisma.MilkPurchaseCreateInput) {
    return prisma.milkPurchase.create({ data });
  },

  /**
   * Quantity-weighted average price per unit across the most recent
   * purchases (not a simple average of pricePerUnit values, which
   * would let a single tiny purchase skew the number). Used by the
   * production module to estimate a product's manufacturing cost.
   */
  async getRecentAveragePricePerUnit(sampleSize = 20): Promise<number | null> {
    const recent = await prisma.milkPurchase.findMany({
      orderBy: { date: "desc" },
      take: sampleSize,
      select: { quantity: true, totalAmount: true },
    });

    if (recent.length === 0) return null;

    const totalQuantity = recent.reduce((sum, p) => sum + p.quantity, 0);
    const totalAmount = recent.reduce((sum, p) => sum + p.totalAmount, 0);

    return totalQuantity > 0 ? totalAmount / totalQuantity : null;
  },
};
