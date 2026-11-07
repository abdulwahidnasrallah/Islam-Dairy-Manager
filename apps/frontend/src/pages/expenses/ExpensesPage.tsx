import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { expenseService } from "@/services/expenseService";
import { ApiClientError } from "@/services/apiClient";
import { formatCurrency } from "@idm/shared-utils";
import type { Expense, ExpenseCategory } from "@idm/shared-types";

const categoryLabels: Record<ExpenseCategory, string> = {
  RENT: "إيجار",
  SALARIES: "رواتب",
  UTILITIES: "خدمات (كهرباء/ماء)",
  TRANSPORT: "نقل",
  MAINTENANCE: "صيانة",
  OTHER: "أخرى",
};

export default function ExpensesPage() {
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => expenseService.list(),
  });

  const [category, setCategory] = useState<ExpenseCategory>("OTHER");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      expenseService.create({
        category,
        amount: Number(amount),
        date: new Date(date),
        notes: notes || null,
      }),
    onSuccess: () => {
      setAmount("");
      setNotes("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["expenses"] });
      void queryClient.invalidateQueries({ queryKey: ["cash-register"] });
    },
  });

  const columns: TableColumn<Expense>[] = [
    { header: "التاريخ", render: (e) => new Date(e.date).toLocaleDateString("ar-EG") },
    { header: "الفئة", render: (e) => categoryLabels[e.category] },
    { header: "المبلغ", render: (e) => formatCurrency(e.amount) },
    { header: "ملاحظات", render: (e) => e.notes ?? "—" },
    {
      header: "",
      render: (e) => (
        <button
          type="button"
          className="text-sm text-danger hover:underline disabled:opacity-50"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (confirm("هل تريد حذف هذا المصروف؟")) {
              deleteMutation.mutate(e.id);
            }
          }}
        >
          حذف
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">المصاريف</h1>
        <p className="text-sm text-gray-500">تسجيل مصاريف المحل (إيجار، رواتب، خدمات، ...)</p>
      </div>

      <Card>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!amount || Number(amount) <= 0) {
              setError("المبلغ يجب أن يكون أكبر من صفر");
              return;
            }
            mutation.mutate();
          }}
        >
          <Select
            label="الفئة"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          >
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="المبلغ"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input label="التاريخ" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {error && <p className="col-span-full text-sm text-danger">{error}</p>}

          <div className="col-span-full">
            <Button type="submit" isLoading={mutation.isPending}>
              تسجيل المصروف
            </Button>
          </div>
        </form>
      </Card>

      <DataTable
        columns={columns}
        rows={expenses}
        keyExtractor={(e) => e.id}
        isLoading={isLoading}
        emptyMessage="لا توجد مصاريف مسجلة بعد"
      />
    </div>
  );
}
