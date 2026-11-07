import { dailyClosingRepository } from "./daily-closing.repository";
import { reportsService } from "../reports/reports.service";
import { cashRegisterService } from "../cash-register/cash-register.service";
import { auditService } from "../../services/audit.service";
import type { DailyClosing } from "@idm/shared-types";

function toDto(row: {
  id: string;
  businessDate: Date;
  closedAt: Date;
  closedByUserId: string | null;
  totalSales: number;
  totalProfit: number;
  cashBalanceAtClose: number;
  notes: string | null;
}): DailyClosing {
  return {
    id: row.id,
    businessDate: row.businessDate.toISOString(),
    closedAt: row.closedAt.toISOString(),
    closedByUserId: row.closedByUserId,
    totalSales: row.totalSales,
    totalProfit: row.totalProfit,
    cashBalanceAtClose: row.cashBalanceAtClose,
    notes: row.notes,
  };
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export const dailyClosingService = {
  /**
   * "Today" on the dashboard starts at midnight, UNLESS the day has
   * already been explicitly closed once today — in which case "today"
   * restarts from that closing's timestamp. This is the entire
   * mechanism behind "بدء يوم جديد": no transactional data is ever
   * touched, only where the *query boundary* for "today" begins.
   */
  async getTodayBoundary(): Promise<Date> {
    const todayStart = startOfToday();
    const latestToday = await dailyClosingRepository.findLatestSince(todayStart);
    return latestToday ? latestToday.closedAt : todayStart;
  },

  async getStatus(): Promise<{ isClosedToday: boolean; todaySince: string }> {
    const boundary = await this.getTodayBoundary();
    const todayStart = startOfToday();
    return {
      isClosedToday: boundary.getTime() > todayStart.getTime(),
      todaySince: boundary.toISOString(),
    };
  },

  async list(limit = 30): Promise<DailyClosing[]> {
    const rows = await dailyClosingRepository.list(limit);
    return rows.map(toDto);
  },

  /**
   * Snapshots today's sales/profit/cash-balance into a DailyClosing row
   * and returns it. Nothing else happens — no sales, inventory, or
   * debts are deleted or modified. The next call to getTodayBoundary()
   * will start returning `now` as the new boundary, which is what makes
   * the dashboard's "today" numbers appear reset without anything
   * having actually been deleted.
   */
  async closeDay(actorUserId: string): Promise<DailyClosing> {
    const boundary = await this.getTodayBoundary();
    const now = new Date();

    const [salesReport, profitReport, cashSummary] = await Promise.all([
      reportsService.getSalesReport(boundary, now),
      reportsService.getProfitReport(boundary, now),
      cashRegisterService.getSummary(),
    ]);

    const created = await dailyClosingRepository.create({
      businessDate: startOfToday(),
      closedByUser: { connect: { id: actorUserId } },
      totalSales: salesReport.totalRevenue,
      totalProfit: profitReport.estimatedProfit,
      cashBalanceAtClose: cashSummary.balance,
    });

    await auditService.log({
      userId: actorUserId,
      action: "CLOSE_DAY",
      entityType: "DailyClosing",
      entityId: created.id,
      newValue: created,
    });

    return toDto(created);
  },
};
