import { cashRegisterRepository } from "./cash-register.repository";
import { reportsService, resolveDateRange } from "../reports/reports.service";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { CreateCashAdjustmentInput } from "@idm/shared-validation";
import type { CashAdjustment, CashRegisterSummary, ProfitSummary } from "@idm/shared-types";

async function computeBalance(): Promise<{ balance: number; totalIn: number; totalOut: number }> {
  const totals = await cashRegisterRepository.getTotals();

  const totalIn = totals.customerPayments + totals.invoicePaid + totals.cashAdjustmentsIn;
  const totalOut =
    totals.supplierPayments +
    totals.milkPurchasePaid +
    totals.purchaseInvoicePaid +
    totals.expenses +
    totals.cashAdjustmentsOut;

  return { balance: totalIn - totalOut, totalIn, totalOut };
}

export const cashRegisterService = {
  async getSummary(): Promise<CashRegisterSummary> {
    const { balance, totalIn, totalOut } = await computeBalance();
    const movements = await cashRegisterRepository.getRecentMovements(50);

    return {
      balance,
      totalIn,
      totalOut,
      movements: movements.map((m) => ({
        date: m.date.toISOString(),
        type: m.type,
        source: m.source,
        description: m.description,
        amount: m.amount,
      })),
    };
  },

  async createAdjustment(input: CreateCashAdjustmentInput, actorUserId: string): Promise<CashAdjustment> {
    if (input.type === "OUT") {
      const { balance } = await computeBalance();
      if (input.amount > balance) {
        throw new AppError(
          "المبلغ المطلوب سحبه أكبر من الرصيد الحالي في الصندوق",
          422,
          "INSUFFICIENT_CASH_BALANCE",
        );
      }
    }

    const created = await cashRegisterRepository.createAdjustment({
      type: input.type,
      amount: input.amount,
      date: input.date,
      reason: input.reason,
      notes: input.notes ?? null,
    });

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_CASH_ADJUSTMENT",
      entityType: "CashAdjustment",
      entityId: created.id,
      newValue: created,
    });

    return {
      id: created.id,
      type: created.type,
      amount: created.amount,
      date: created.date.toISOString(),
      reason: created.reason,
      notes: created.notes,
      createdAt: created.createdAt.toISOString(),
    };
  },

  /**
   * The current calendar month's profit, delegating to the same
   * COGS-based calculation the Reports module uses (reportsService.
   * getProfitReport) — one profit formula, used everywhere, instead of
   * a second approximation living here.
   */
  async getMonthlyProfitSummary(): Promise<ProfitSummary> {
    const { from, to } = resolveDateRange();
    const report = await reportsService.getProfitReport(from, to);

    return {
      periodLabel: "هذا الشهر",
      totalSalesRevenue: report.totalSalesRevenue,
      totalCOGS: report.totalCOGS,
      totalMilkPurchaseCost: report.totalMilkPurchaseCost,
      totalExpenses: report.totalExpenses,
      estimatedProfit: report.estimatedProfit,
      itemsWithoutCost: report.itemsWithoutCost,
    };
  },
};
