import { inventoryRepository } from "./inventory.repository";
import { productRepository } from "../products/product.repository";
import { productService } from "../products/product.service";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { CreateInventoryAdjustmentInput } from "@idm/shared-validation";
import type { InventoryMovement, ProductWithStock } from "@idm/shared-types";

function toDto(movement: {
  id: string;
  productId: string;
  type: string;
  reason: string;
  quantity: number;
  date: Date;
  notes: string | null;
  createdAt: Date;
}): InventoryMovement {
  return {
    id: movement.id,
    productId: movement.productId,
    type: movement.type as InventoryMovement["type"],
    reason: movement.reason as InventoryMovement["reason"],
    quantity: movement.quantity,
    date: movement.date.toISOString(),
    notes: movement.notes,
    createdAt: movement.createdAt.toISOString(),
  };
}

export const inventoryService = {
  /** Products with their current derived stock — the main inventory screen. */
  async listStock(): Promise<ProductWithStock[]> {
    const products = await productRepository.findMany();
    const stockMap = await inventoryRepository.getStockMap(products.map((p) => p.id));

    return products.map((product) => {
      const currentStock = stockMap.get(product.id) ?? 0;
      return {
        id: product.id,
        name: product.name,
        unit: product.unit as ProductWithStock["unit"],
        sellingPrice: product.sellingPrice,
        costPrice: product.costPrice,
        minStockAlert: product.minStockAlert,
        isActive: product.isActive,
        notes: product.notes,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
        currentStock,
        isLowStock: currentStock <= product.minStockAlert,
      };
    });
  },

  async listMovements(productId?: string): Promise<InventoryMovement[]> {
    const movements = await inventoryRepository.findMovements(productId);
    return movements.map(toDto);
  },

  /** Manual stock adjustment (correction, damage, return, ...). */
  async adjust(input: CreateInventoryAdjustmentInput, actorUserId: string): Promise<InventoryMovement> {
    await productService.getByIdOrThrow(input.productId);

    if (input.type === "OUT") {
      const currentStock = await inventoryRepository.getStock(input.productId);
      if (input.quantity > currentStock) {
        throw new AppError(
          "الكمية المطلوب إخراجها أكبر من المخزون المتوفر",
          422,
          "INSUFFICIENT_STOCK",
        );
      }
    }

    const created = await inventoryRepository.create({
      product: { connect: { id: input.productId } },
      type: input.type,
      reason: input.reason,
      quantity: input.quantity,
      date: input.date,
      notes: input.notes ?? null,
    });

    await auditService.log({
      userId: actorUserId,
      action: "ADJUST_INVENTORY",
      entityType: "InventoryMovement",
      entityId: created.id,
      newValue: created,
    });

    return toDto(created);
  },
};
