import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { SimpleBarChart } from "@/components/reports/SimpleBarChart";
import { reportsService } from "@/services/reportsService";
import { formatCurrency } from "@idm/shared-utils";
import type { ReportTopDebtCustomer, ReportTopProduct, ReportTopSupplier } from "@idm/shared-types";

function defaultMonthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().slice(0, 10);
  return { from, to };
}

function todayRange() {
  const today = new Date().toISOString().slice(0, 10);
  return { from: today, to: today };
}

function currentWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek);
  return { from: start.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
}

const productColumns: TableColumn<ReportTopProduct>[] = [
  { header: "المنتج", render: (p) => p.productName },
  { header: "الكمية المباعة", render: (p) => p.quantitySold },
  { header: "الإيراد", render: (p) => formatCurrency(p.revenue) },
];

const supplierColumns: TableColumn<ReportTopSupplier>[] = [
  { header: "المورد", render: (s) => s.supplierName },
  { header: "الكمية", render: (s) => s.totalQuantity },
  { header: "التكلفة", render: (s) => formatCurrency(s.totalCost) },
];

const debtColumns: TableColumn<ReportTopDebtCustomer>[] = [
  { header: "الزبون", render: (c) => c.customerName },
  { header: "الدين المستحق", render: (c) => <span className="font-bold text-warning">{formatCurrency(c.balance)}</span> },
];

export default function ReportsPage() {
  const [{ from, to }, setRange] = useState(defaultMonthRange());

  const { data: summary, isLoading } = useQuery({
    queryKey: ["reports", from, to],
    queryFn: () => reportsService.getSummary(from, to),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">التقارير والتحليلات</h1>
        <p className="text-sm text-gray-500">اختر فترة زمنية لعرض ملخص المبيعات والمشتريات والأرباح</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="من تاريخ"
            type="date"
            value={from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
          <Input
            label="إلى تاريخ"
            type="date"
            value={to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
          <Button type="button" variant="secondary" onClick={() => setRange(todayRange())}>
            اليوم
          </Button>
          <Button type="button" variant="secondary" onClick={() => setRange(currentWeekRange())}>
            هذا الأسبوع
          </Button>
          <Button type="button" variant="secondary" onClick={() => setRange(defaultMonthRange())}>
            هذا الشهر
          </Button>
        </div>
      </Card>

      {isLoading || !summary ? (
        <p className="text-sm text-gray-400">جاري التحميل...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card>
              <p className="text-sm text-gray-500">إيراد المبيعات</p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(summary.profit.totalSalesRevenue)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">تكلفة البضاعة المباعة</p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(summary.profit.totalCOGS)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">تكلفة شراء الحليب (معلوماتي)</p>
              <p className="mt-1 text-lg font-bold">{formatCurrency(summary.profit.totalMilkPurchaseCost)}</p>
            </Card>
            <Card>
              <p className="text-sm text-gray-500">الربح التقديري</p>
              <p
                className={`mt-1 text-lg font-bold ${
                  summary.profit.estimatedProfit >= 0 ? "text-success" : "text-danger"
                }`}
              >
                {formatCurrency(summary.profit.estimatedProfit)}
              </p>
            </Card>
          </div>

          {summary.profit.itemsWithoutCost > 0 && (
            <p className="text-xs text-warning">
              تنبيه: {summary.profit.itemsWithoutCost} من الأصناف المباعة في هذه الفترة لم يكن لها سعر تكلفة
              مسجَّل وقت البيع، لذا تكلفتها احتُسبت كصفر — الربح الفعلي قد يكون أقل مما هو ظاهر. حدِّد سعر
              تكلفة لكل منتج من صفحة المنتجات لتحسين الدقة.
            </p>
          )}

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700">
                المبيعات اليومية ({summary.sales.invoiceCount} فاتورة، إجمالي{" "}
                {formatCurrency(summary.sales.totalRevenue)})
              </h3>
              <a
                href={reportsService.exportUrl("sales", from, to)}
                className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
              >
                <Download size={14} /> تصدير أعلى المنتجات CSV
              </a>
            </div>
            <SimpleBarChart
              data={summary.sales.dailyRevenue.map((p) => ({ label: p.date.slice(5), value: p.amount }))}
            />
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold text-gray-700">مشتريات الفترة</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-gray-500">
                  شراء الحليب ({summary.purchases.purchaseCount})
                </p>
                <p className="mt-1 text-base font-bold">{formatCurrency(summary.purchases.totalCost)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">
                  فواتير شراء المنتجات ({summary.purchases.purchaseInvoiceCount})
                </p>
                <p className="mt-1 text-base font-bold">
                  {formatCurrency(summary.purchases.totalPurchaseInvoiceCost)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">إجمالي مشتريات الفترة</p>
                <p className="mt-1 text-base font-bold">
                  {formatCurrency(summary.purchases.totalCombinedCost)}
                </p>
                <p className="text-xs text-gray-400">
                  المدفوع للموردين: {formatCurrency(summary.purchases.totalCombinedPaid)}
                </p>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-gray-700">أعلى المنتجات مبيعاً</h3>
              <DataTable
                columns={productColumns}
                rows={summary.sales.topProducts}
                keyExtractor={(p) => p.productId}
                emptyMessage="لا توجد مبيعات في هذه الفترة"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">أعلى الموردين شراءً</h3>
                <a
                  href={reportsService.exportUrl("purchases", from, to)}
                  className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
                >
                  <Download size={12} /> تصدير CSV
                </a>
              </div>
              <DataTable
                columns={supplierColumns}
                rows={summary.purchases.topSuppliers}
                keyExtractor={(s) => s.supplierId}
                emptyMessage="لا توجد مشتريات في هذه الفترة"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700">أعلى الزبائن ديناً (كل الفترات)</h3>
              <a
                href={reportsService.exportUrl("top-debts")}
                className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
              >
                <Download size={12} /> تصدير CSV
              </a>
            </div>
            <DataTable
              columns={debtColumns}
              rows={summary.topDebtCustomers}
              keyExtractor={(c) => c.customerId}
              emptyMessage="لا يوجد زبائن عليهم ديون حالياً"
            />
          </div>

          <p className="text-xs text-gray-400">
            الربح التقديري = إيراد المبيعات − تكلفة البضاعة المباعة (المحسوبة من سعر تكلفة كل منتج وقت
            البيع الفعلي) − المصاريف. تكلفة شراء الحليب معروضة للمعلومة فقط ولا تُطرَح مرتين.
          </p>
        </>
      )}
    </div>
  );
}
