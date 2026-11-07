import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { toCsv } from "../../utils/csv";
import { reportsService, resolveDateRange } from "./reports.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

function getRangeParams(req: AuthenticatedRequest) {
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  return { from, to };
}

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

export const reportsController = {
  async getSummary(req: AuthenticatedRequest, res: Response) {
    const { from, to } = getRangeParams(req);
    const summary = await reportsService.getSummary(from, to);
    sendSuccess(res, summary);
  },

  async exportSalesCsv(req: AuthenticatedRequest, res: Response) {
    const { from, to } = getRangeParams(req);
    const { from: fromDate, to: toDate } = resolveDateRange(from, to);
    const report = await reportsService.getSalesReport(fromDate, toDate);

    const csv = toCsv(
      report.topProducts.map((p) => ({
        productName: p.productName,
        quantitySold: p.quantitySold,
        revenue: p.revenue.toFixed(2),
      })),
      [
        { key: "productName", label: "المنتج" },
        { key: "quantitySold", label: "الكمية المباعة" },
        { key: "revenue", label: "الإيراد" },
      ],
    );

    sendCsv(res, "sales-report.csv", csv);
  },

  async exportPurchasesCsv(req: AuthenticatedRequest, res: Response) {
    const { from, to } = getRangeParams(req);
    const { from: fromDate, to: toDate } = resolveDateRange(from, to);
    const report = await reportsService.getPurchasesReport(fromDate, toDate);

    const csv = toCsv(
      report.topSuppliers.map((s) => ({
        supplierName: s.supplierName,
        totalQuantity: s.totalQuantity,
        totalCost: s.totalCost.toFixed(2),
      })),
      [
        { key: "supplierName", label: "المورد" },
        { key: "totalQuantity", label: "الكمية" },
        { key: "totalCost", label: "التكلفة" },
      ],
    );

    sendCsv(res, "purchases-report.csv", csv);
  },

  async exportTopDebtsCsv(_req: AuthenticatedRequest, res: Response) {
    const topDebts = await reportsService.getTopDebtCustomers(50);

    const csv = toCsv(
      topDebts.map((c) => ({ customerName: c.customerName, balance: c.balance.toFixed(2) })),
      [
        { key: "customerName", label: "الزبون" },
        { key: "balance", label: "الدين المستحق" },
      ],
    );

    sendCsv(res, "top-debts-report.csv", csv);
  },
};
