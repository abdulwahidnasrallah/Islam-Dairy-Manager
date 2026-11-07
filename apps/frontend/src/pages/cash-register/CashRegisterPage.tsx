import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { cashRegisterService } from "@/services/cashRegisterService";
import { ApiClientError } from "@/services/apiClient";
import { formatCurrency } from "@idm/shared-utils";
import type { CashMovement } from "@idm/shared-types";

const movementColumns: TableColumn<CashMovement>[] = [
  { header: "التاريخ", render: (m) => new Date(m.date).toLocaleDateString("ar-EG") },
  { header: "النوع", render: (m) => (m.type === "IN" ? "إدخال" : "إخراج") },
  { header: "المصدر", render: (m) => m.source },
  { header: "الوصف", render: (m) => m.description },
  {
    header: "المبلغ",
    render: (m) => (
      <span className={m.type === "IN" ? "text-success" : "text-danger"}>
        {m.type === "IN" ? "+" : "-"}
        {formatCurrency(m.amount)}
      </span>
    ),
  },
];

export default function CashRegisterPage() {
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useQuery({
    queryKey: ["cash-register"],
    queryFn: () => cashRegisterService.getSummary(),
  });

  const { data: profit } = useQuery({
    queryKey: ["cash-register", "profit-summary"],
    queryFn: () => cashRegisterService.getProfitSummary(),
  });

  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      cashRegisterService.createAdjustment({
        type,
        amount: Number(amount),
        date: new Date(),
        reason,
        notes: notes || null,
      }),
    onSuccess: () => {
      setAmount("");
      setReason("");
      setNotes("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">الصندوق</h1>
        <p className="text-sm text-gray-500">
          رصيد الصندوق مُشتق من كل حركات النقد (مبيعات، مشتريات، دفعات، مصاريف) + التسويات اليدوية
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">الرصيد الحالي</p>
          <p className="mt-1 text-xl font-bold text-primary-700">
            {isLoading ? "..." : formatCurrency(summary?.balance ?? 0)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">إجمالي الداخل</p>
          <p className="mt-1 text-xl font-bold text-success">
            {isLoading ? "..." : formatCurrency(summary?.totalIn ?? 0)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">إجمالي الخارج</p>
          <p className="mt-1 text-xl font-bold text-danger">
            {isLoading ? "..." : formatCurrency(summary?.totalOut ?? 0)}
          </p>
        </Card>
      </div>

      {profit && (
        <Card>
          <h3 className="mb-3 text-sm font-bold text-gray-700">ملخص الأرباح — {profit.periodLabel}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">مبيعات</p>
              <p className="font-bold">{formatCurrency(profit.totalSalesRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">تكلفة البضاعة المباعة</p>
              <p className="font-bold">{formatCurrency(profit.totalCOGS)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">المصاريف</p>
              <p className="font-bold">{formatCurrency(profit.totalExpenses)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">الربح التقديري</p>
              <p className={`font-bold ${profit.estimatedProfit >= 0 ? "text-success" : "text-danger"}`}>
                {formatCurrency(profit.estimatedProfit)}
              </p>
            </div>
          </div>
          {profit.itemsWithoutCost > 0 && (
            <p className="mt-3 text-xs text-warning">
              {profit.itemsWithoutCost} من الأصناف المباعة بلا سعر تكلفة مسجَّل — احتُسبت تكلفتها كصفر.
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            رقم تقديري وليس محاسبياً دقيقاً — تكلفة البضاعة المباعة محسوبة من سعر تكلفة كل منتج وقت البيع.
          </p>
        </Card>
      )}

      <Card>
        <h3 className="mb-3 text-sm font-bold text-gray-700">تسوية يدوية (غير مرتبطة بفاتورة أو دفعة)</h3>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!amount || Number(amount) <= 0) {
              setError("المبلغ يجب أن يكون أكبر من صفر");
              return;
            }
            if (!reason.trim()) {
              setError("السبب مطلوب");
              return;
            }
            mutation.mutate();
          }}
        >
          <Select label="النوع" value={type} onChange={(e) => setType(e.target.value as "IN" | "OUT")}>
            <option value="IN">إدخال (زيادة)</option>
            <option value="OUT">إخراج (سحب)</option>
          </Select>
          <Input
            label="المبلغ"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input label="السبب" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Input label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {error && <p className="col-span-full text-sm text-danger">{error}</p>}

          <div className="col-span-full">
            <Button type="submit" isLoading={mutation.isPending}>
              تسجيل الحركة
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-bold text-gray-700">آخر حركات الصندوق</h3>
        <DataTable
          columns={movementColumns}
          rows={summary?.movements ?? []}
          keyExtractor={(m) => `${m.source}-${m.description}-${m.date}-${m.amount}`}
          isLoading={isLoading}
          emptyMessage="لا توجد حركات مسجلة بعد"
        />
      </div>
    </div>
  );
}
