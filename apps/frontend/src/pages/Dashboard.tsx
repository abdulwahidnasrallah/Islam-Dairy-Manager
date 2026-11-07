import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Users,
  Truck,
  Boxes,
  AlertTriangle,
  CalendarCheck,
} from "lucide-react";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { healthService } from "@/services/healthService";
import { dashboardService } from "@/services/dashboardService";
import { dailyClosingService } from "@/services/dailyClosingService";
import { ApiClientError } from "@/services/apiClient";
import { formatCurrency } from "@idm/shared-utils";
import type { DailyClosing } from "@idm/shared-types";

const closingColumns: TableColumn<DailyClosing>[] = [
  { header: "تاريخ الإغلاق", render: (c) => new Date(c.closedAt).toLocaleString("ar-EG") },
  { header: "المبيعات", render: (c) => formatCurrency(c.totalSales) },
  { header: "الربح", render: (c) => formatCurrency(c.totalProfit) },
  { header: "رصيد الصندوق عند الإغلاق", render: (c) => formatCurrency(c.cashBalanceAtClose) },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: health, isLoading: healthLoading, isError: healthError } = useQuery({
    queryKey: ["health"],
    queryFn: healthService.check,
  });

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardService.getSummary(),
    refetchInterval: 60_000,
  });

  const { data: closingHistory = [] } = useQuery({
    queryKey: ["daily-closing-history"],
    queryFn: () => dailyClosingService.listHistory(),
  });

  const [closeError, setCloseError] = useState<string | null>(null);
  const [closeResult, setCloseResult] = useState<string | null>(null);

  const closeDayMutation = useMutation({
    mutationFn: () => dailyClosingService.close(),
    onSuccess: (closing) => {
      setCloseError(null);
      setCloseResult(
        `تم إغلاق اليوم. إجمالي المبيعات: ${formatCurrency(closing.totalSales)} — الربح: ${formatCurrency(closing.totalProfit)}`,
      );
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["daily-closing-history"] });
    },
    onError: (err) => {
      setCloseResult(null);
      setCloseError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">لوحة التحكم</h1>
          <p className="text-sm text-gray-500">
            نظرة سريعة على أداء المتجر
            {summary && (
              <>
                {" "}
                — اليوم منذ{" "}
                {new Date(summary.todaySince).toLocaleTimeString("ar-EG", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (
              confirm(
                "هل تريد بدء يوم جديد؟\n\nسيتم حفظ ملخص اليوم الحالي، وستبدأ مؤشرات \"اليوم\" في لوحة التحكم من الصفر. لن يُحذف أي بيع أو مخزون أو دين.",
              )
            ) {
              closeDayMutation.mutate();
            }
          }}
          isLoading={closeDayMutation.isPending}
        >
          <CalendarCheck size={16} /> بدء يوم جديد
        </Button>
      </div>

      {closeResult && <p className="text-sm text-success">{closeResult}</p>}
      {closeError && <p className="text-sm text-danger">{closeError}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="مبيعات اليوم"
          value={summary ? formatCurrency(summary.todaySalesRevenue) : undefined}
          icon={DollarSign}
          isLoading={summaryLoading}
          isError={summaryError}
        />
        <SummaryCard
          title="أرباح اليوم"
          value={summary ? formatCurrency(summary.todayProfit) : undefined}
          icon={TrendingUp}
          isLoading={summaryLoading}
          isError={summaryError}
        />
        <SummaryCard
          title="النقد الموجود"
          value={summary ? formatCurrency(summary.cashBalance) : undefined}
          icon={Wallet}
          isLoading={summaryLoading}
          isError={summaryError}
        />
        <SummaryCard
          title="ديون الزبائن"
          value={summary ? formatCurrency(summary.totalCustomerDebt) : undefined}
          icon={Users}
          isLoading={summaryLoading}
          isError={summaryError}
        />
        <SummaryCard
          title="مستحقات الموردين"
          value={summary ? formatCurrency(summary.totalSupplierDebt) : undefined}
          icon={Truck}
          isLoading={summaryLoading}
          isError={summaryError}
        />
        <SummaryCard
          title="قيمة المخزون"
          value={summary ? formatCurrency(summary.inventoryValue) : undefined}
          icon={Boxes}
          isLoading={summaryLoading}
          isError={summaryError}
        />
      </div>

      {summary && summary.lowStockCount > 0 && (
        <Link to="/inventory">
          <Card className="flex items-center gap-3 border border-warning/30 bg-warning/5 hover:bg-warning/10">
            <AlertTriangle size={20} className="text-warning" />
            <p className="text-sm text-warning">
              يوجد {summary.lowStockCount} منتج{summary.lowStockCount > 1 ? "ات" : ""} تحت حد المخزون
              الأدنى — اضغط لعرض المخزون
            </p>
          </Card>
        </Link>
      )}

      {summary && (
        <Card>
          <h3 className="mb-3 text-sm font-bold text-gray-700">ملخص مبيعات اليوم</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-gray-500">عدد الفواتير</p>
              <p className="font-bold">{summary.todaySalesSummary.invoiceCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">مبيعات نقدية</p>
              <p className="font-bold text-success">{formatCurrency(summary.todaySalesSummary.cashSalesTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">مبيعات بالدين</p>
              <p className="font-bold text-warning">{formatCurrency(summary.todaySalesSummary.debtSalesTotal)}</p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="mb-2 text-sm font-bold text-gray-700">حالة النظام</h3>
        {healthLoading && <p className="text-sm text-gray-400">جاري الفحص...</p>}
        {healthError && (
          <p className="text-sm text-danger">تعذر الاتصال بالخادم الخلفي. تأكد من تشغيل: pnpm backend</p>
        )}
        {health && (
          <ul className="space-y-1 text-sm text-gray-600">
            <li>الحالة: {health.status === "running" ? "يعمل بشكل طبيعي ✅" : "متدهور ⚠️"}</li>
            <li>قاعدة البيانات: {health.databaseConnected ? "متصلة ✅" : "غير متصلة ❌"}</li>
            <li>الإصدار: {health.version}</li>
          </ul>
        )}
      </Card>

      {closingHistory.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-700">سجل إغلاقات الأيام السابقة</h3>
          <DataTable
            columns={closingColumns}
            rows={closingHistory}
            keyExtractor={(c) => c.id}
            emptyMessage="لا توجد عمليات إغلاق يوم مسجلة بعد"
          />
        </div>
      )}
    </div>
  );
}
