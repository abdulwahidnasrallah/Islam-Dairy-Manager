import { milkPurchaseRepository } from "./purchase.repository";
import { supplierService } from "../suppliers/supplier.service";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { CreateMilkPurchaseInput } from "@idm/shared-validation";
import type { MilkPurchase } from "@idm/shared-types";

function toDto(purchase: {
  id: string;
  supplierId: string;
  date: Date;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MilkPurchase {
  return {
    id: purchase.id,
    supplierId: purchase.supplierId,
    date: purchase.date.toISOString(),
    quantity: purchase.quantity,
    pricePerUnit: purchase.pricePerUnit,
    totalAmount: purchase.totalAmount,
    paidAmount: purchase.paidAmount,
    remainingAmount: purchase.remainingAmount,
    notes: purchase.notes,
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
  };
}

export const milkPurchaseService = {
  async list(supplierId?: string): Promise<MilkPurchase[]> {
    const purchases = await milkPurchaseRepository.findMany(supplierId);
    return purchases.map(toDto);
  },

  async create(input: CreateMilkPurchaseInput, actorUserId: string): Promise<MilkPurchase> {
    // Confirms the supplier exists — throws SUPPLIER_NOT_FOUND otherwise.
    await supplierService.getByIdOrThrow(input.supplierId);

    // Business rule: total is ALWAYS calculated server-side.
    // Quantity × Price per unit = purchase value.
    const totalAmount = round2(input.quantity * input.pricePerUnit);
    const paidAmount = round2(input.paidAmount ?? 0);

    if (paidAmount > totalAmount) {
      throw new AppError(
        "المبلغ المدفوع لا يمكن أن يتجاوز القيمة الإجمالية",
        422,
        "PAID_EXCEEDS_TOTAL",
      );
    }

    const remainingAmount = round2(totalAmount - paidAmount);

    const created = await milkPurchaseRepository.create({
      supplier: { connect: { id: input.supplierId } },
      date: input.date,
      quantity: input.quantity,
      pricePerUnit: input.pricePerUnit,
      totalAmount,
      paidAmount,
      remainingAmount,
      notes: input.notes ?? null,
    });

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_MILK_PURCHASE",
      entityType: "MilkPurchase",
      entityId: created.id,
      newValue: created,
    });

    // Cash Register derives its totals directly from MilkPurchase.paidAmount
    // (see cash-register.repository.ts) — nothing further to update here.
    // Raw milk itself is intentionally not tracked as inventory stock; see
    // production.service.ts for how it factors into product cost instead.

    return toDto(created);
  },

  /** Used by the production module to estimate a manufactured product's cost. */
  async getRecentAverageMilkPrice(): Promise<number | null> {
    return milkPurchaseRepository.getRecentAveragePricePerUnit();
  },
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
