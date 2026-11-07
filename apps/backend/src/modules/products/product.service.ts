import { productRepository } from "./product.repository";
import { inventoryRepository } from "../inventory/inventory.repository";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { CreateProductInput, UpdateProductInput } from "@idm/shared-validation";
import type { Product, ProductWithStock } from "@idm/shared-types";

function toDto(product: {
  id: string;
  name: string;
  unit: string;
  sellingPrice: number;
  costPrice: number | null;
  minStockAlert: number;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Product {
  return {
    id: product.id,
    name: product.name,
    unit: product.unit as Product["unit"],
    sellingPrice: product.sellingPrice,
    costPrice: product.costPrice,
    minStockAlert: product.minStockAlert,
    isActive: product.isActive,
    notes: product.notes,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export const productService = {
  async list(search?: string): Promise<ProductWithStock[]> {
    const products = await productRepository.findMany(search);
    const stockMap = await inventoryRepository.getStockMap(products.map((p) => p.id));

    return products.map((product) => {
      const currentStock = stockMap.get(product.id) ?? 0;
      return {
        ...toDto(product),
        currentStock,
        isLowStock: currentStock <= product.minStockAlert,
      };
    });
  },

  async getById(id: string): Promise<Product> {
    const product = await this.getByIdOrThrow(id);
    return toDto(product);
  },

  async create(input: CreateProductInput, actorUserId: string): Promise<Product> {
    const existing = await productRepository.findByExactName(input.name);
    if (existing) {
      throw new AppError("يوجد منتج آخر بنفس الاسم", 409, "DUPLICATE_PRODUCT");
    }

    const created = await productRepository.create({
      name: input.name,
      unit: input.unit,
      sellingPrice: input.sellingPrice,
      costPrice: input.costPrice ?? null,
      minStockAlert: input.minStockAlert ?? 0,
      isActive: input.isActive ?? true,
      notes: input.notes ?? null,
    });

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_PRODUCT",
      entityType: "Product",
      entityId: created.id,
      newValue: created,
    });

    return toDto(created);
  },

  async update(id: string, input: UpdateProductInput, actorUserId: string): Promise<Product> {
    const before = await this.getByIdOrThrow(id);

    if (input.name) {
      const existing = await productRepository.findByExactName(input.name);
      if (existing && existing.id !== id) {
        throw new AppError("يوجد منتج آخر بنفس الاسم", 409, "DUPLICATE_PRODUCT");
      }
    }

    const updated = await productRepository.update(id, input);

    await auditService.log({
      userId: actorUserId,
      action: "UPDATE_PRODUCT",
      entityType: "Product",
      entityId: id,
      oldValue: toDto(before),
      newValue: toDto(updated),
    });

    return toDto(updated);
  },

  async remove(id: string, actorUserId: string): Promise<void> {
    const before = await this.getByIdOrThrow(id);

    const [movementCount, batchCount] = await productRepository.hasMovementsOrBatches(id);
    if (movementCount > 0 || batchCount > 0) {
      throw new AppError(
        "لا يمكن حذف منتج له حركات مخزون أو دفعات إنتاج مسجلة",
        409,
        "PRODUCT_HAS_TRANSACTIONS",
      );
    }

    await productRepository.delete(id);

    await auditService.log({
      userId: actorUserId,
      action: "DELETE_PRODUCT",
      entityType: "Product",
      entityId: id,
      oldValue: toDto(before),
    });
  },

  async getByIdOrThrow(id: string) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new AppError("المنتج غير موجود", 404, "PRODUCT_NOT_FOUND");
    }
    return product;
  },

  /** Used by other modules (inventory, production) that need just the current stock. */
  async getStock(id: string): Promise<number> {
    await this.getByIdOrThrow(id);
    return inventoryRepository.getStock(id);
  },
};
