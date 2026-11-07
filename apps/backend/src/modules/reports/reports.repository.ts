import { prisma } from "../../config/prisma";

/**
 * Like the cash-register repository, this is a read-only projection
 * over tables owned by other modules. It never writes anything — it
 * only aggregates what sales/purchases/customers already recorded.
 *
 * Every invoice-based query here filters to `status: "CONFIRMED"` — a
 * cancelled sale must not appear in revenue, top-products, or profit
 * figures. See sales.service.ts cancel().
 */
const CONFIRMED_ONLY = { status: "CONFIRMED" as const };

/** Same CONFIRMED-only rule, applied to supplier PurchaseInvoice — a cancelled purchase invoice must not appear in purchase totals or the top-suppliers ranking, same as a cancelled sale. */
const CONFIRMED_PURCHASE_INVOICE = { status: "CONFIRMED" as const };

export const reportsRepository = {
  async getSalesTotals(from: Date, to: Date) {
    const agg = await prisma.invoice.aggregate({
      where: { date: { gte: from, lte: to }, ...CONFIRMED_ONLY },
      _count: { _all: true },
      _sum: { totalAmount: true, paidAmount: true, remainingAmount: true },
    });

    return {
      invoiceCount: agg._count._all,
      totalRevenue: agg._sum.totalAmount ?? 0,
      totalPaid: agg._sum.paidAmount ?? 0,
      totalRemaining: agg._sum.remainingAmount ?? 0,
    };
  },

  /** Invoice date + total, reduced to one point per calendar day in JS (SQLite has no easy date-trunc via Prisma). */
  async getDailyRevenue(from: Date, to: Date) {
    const invoices = await prisma.invoice.findMany({
      where: { date: { gte: from, lte: to }, ...CONFIRMED_ONLY },
      select: { date: true, totalAmount: true },
    });

    const byDay = new Map<string, number>();
    for (const invoice of invoices) {
      const day = invoice.date.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + invoice.totalAmount);
    }

    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount }));
  },

  async getTopProducts(from: Date, to: Date, limit: number) {
    const items = await prisma.invoiceItem.findMany({
      where: { invoice: { date: { gte: from, lte: to }, ...CONFIRMED_ONLY } },
      select: { productId: true, quantity: true, totalPrice: true, product: { select: { name: true } } },
    });

    const byProduct = new Map<string, { productName: string; quantitySold: number; revenue: number }>();
    for (const item of items) {
      const entry = byProduct.get(item.productId) ?? {
        productName: item.product.name,
        quantitySold: 0,
        revenue: 0,
      };
      entry.quantitySold += item.quantity;
      entry.revenue += item.totalPrice;
      byProduct.set(item.productId, entry);
    }

    return Array.from(byProduct.entries())
      .map(([productId, v]) => ({ productId, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  },

  /**
   * Cost of goods actually sold: sum(unitCost × quantity) across every
   * confirmed invoice item in range. unitCost is a per-item snapshot
   * taken at sale time (see InvoiceItem.unitCost), so this reflects
   * what each item actually cost when it was sold — not the product's
   * current cost. Items sold before a cost was ever set contribute 0,
   * which is surfaced separately via `itemsWithoutCost` so the profit
   * figure's accuracy is never silently overstated.
   */
  async getCOGS(from: Date, to: Date): Promise<{ totalCOGS: number; itemsWithoutCost: number }> {
    const items = await prisma.invoiceItem.findMany({
      where: { invoice: { date: { gte: from, lte: to }, ...CONFIRMED_ONLY } },
      select: { quantity: true, unitCost: true },
    });

    let totalCOGS = 0;
    let itemsWithoutCost = 0;
    for (const item of items) {
      if (item.unitCost === null) {
        itemsWithoutCost += 1;
        continue;
      }
      totalCOGS += item.unitCost * item.quantity;
    }

    return { totalCOGS, itemsWithoutCost };
  },

  async getPurchaseTotals(from: Date, to: Date) {
    const agg = await prisma.milkPurchase.aggregate({
      where: { date: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { quantity: true, totalAmount: true, paidAmount: true },
    });

    return {
      purchaseCount: agg._count._all,
      totalQuantity: agg._sum.quantity ?? 0,
      totalCost: agg._sum.totalAmount ?? 0,
      totalPaid: agg._sum.paidAmount ?? 0,
    };
  },

  /** Purchase invoices only (tracked Products bought from suppliers), CONFIRMED only — mirrors getPurchaseTotals but for PurchaseInvoice instead of MilkPurchase. */
  async getPurchaseInvoiceTotals(from: Date, to: Date) {
    const agg = await prisma.purchaseInvoice.aggregate({
      where: { date: { gte: from, lte: to }, ...CONFIRMED_PURCHASE_INVOICE },
      _count: { _all: true },
      _sum: { totalAmount: true, paidAmount: true },
    });

    return {
      purchaseInvoiceCount: agg._count._all,
      totalCost: agg._sum.totalAmount ?? 0,
      totalPaid: agg._sum.paidAmount ?? 0,
    };
  },

  /**
   * Top suppliers ranked by COMBINED spend — milk purchases (raw milk,
   * no status field, always included) plus CONFIRMED purchase invoices
   * (tracked Products) — grouped and summed in JS since they come from
   * two different tables. Quantity is milk-only (purchase invoices mix
   * units across different products, so a combined "quantity" would be
   * meaningless); cost is combined, matching totalCombinedCost on
   * PurchasesReport.
   */
  async getTopSuppliers(from: Date, to: Date, limit: number) {
    const [milkGrouped, invoiceGrouped] = await Promise.all([
      prisma.milkPurchase.groupBy({
        by: ["supplierId"],
        where: { date: { gte: from, lte: to } },
        _sum: { quantity: true, totalAmount: true },
      }),
      prisma.purchaseInvoice.groupBy({
        by: ["supplierId"],
        where: { date: { gte: from, lte: to }, ...CONFIRMED_PURCHASE_INVOICE },
        _sum: { totalAmount: true },
      }),
    ]);

    const bySupplier = new Map<string, { totalQuantity: number; totalCost: number }>();
    for (const g of milkGrouped) {
      const entry = bySupplier.get(g.supplierId) ?? { totalQuantity: 0, totalCost: 0 };
      entry.totalQuantity += g._sum.quantity ?? 0;
      entry.totalCost += g._sum.totalAmount ?? 0;
      bySupplier.set(g.supplierId, entry);
    }
    for (const g of invoiceGrouped) {
      const entry = bySupplier.get(g.supplierId) ?? { totalQuantity: 0, totalCost: 0 };
      entry.totalCost += g._sum.totalAmount ?? 0;
      bySupplier.set(g.supplierId, entry);
    }

    const ranked = Array.from(bySupplier.entries())
      .sort(([, a], [, b]) => b.totalCost - a.totalCost)
      .slice(0, limit);

    const suppliers = await prisma.supplier.findMany({
      where: { id: { in: ranked.map(([supplierId]) => supplierId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(suppliers.map((s) => [s.id, s.name]));

    return ranked.map(([supplierId, totals]) => ({
      supplierId,
      supplierName: nameById.get(supplierId) ?? "—",
      totalQuantity: totals.totalQuantity,
      totalCost: totals.totalCost,
    }));
  },
};
