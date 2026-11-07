import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Only this file talks to Prisma for products. Services never import
 * `prisma` directly — this keeps the Controller → Service → Repository
 * layering real, not just a folder convention.
 */
export const productRepository = {
  findMany(search?: string) {
    return prisma.product.findMany({
      where: search ? { name: { contains: search } } : undefined,
      orderBy: { createdAt: "desc" },
    });
  },

  findById(id: string) {
    return prisma.product.findUnique({ where: { id } });
  },

  findByExactName(name: string) {
    return prisma.product.findFirst({ where: { name } });
  },

  create(data: Prisma.ProductCreateInput) {
    return prisma.product.create({ data });
  },

  update(id: string, data: Prisma.ProductUpdateInput) {
    return prisma.product.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.product.delete({ where: { id } });
  },

  /** Used before allowing delete: a product with any history must not be removed. */
  hasMovementsOrBatches(productId: string) {
    return prisma.$transaction([
      prisma.inventoryMovement.count({ where: { productId } }),
      prisma.productionBatch.count({ where: { productId } }),
    ]);
  },
};
