import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { customerService } from "@/services/customerService";
import { customerPaymentService } from "@/services/customerPaymentService";
import { ApiClientError } from "@/services/apiClient";
import { formatCurrency } from "@idm/shared-utils";
import type { Invoice, CustomerPayment } from "@idm/shared-types";

const invoiceColumns: TableColumn<Invoice>[] = [
  {
    header: "رقم الفاتورة",
    render: (i) => (
      <Link to={`/sales/${i.id}`} className="font-medium text-primary-700 hover:underline">
        {i.invoiceNumber}
      </Link>
    ),
  },
  { header: "التاريخ", render: (i) => new Date(i.date).toLocaleDateString("ar-EG") },
  { header: "عدد الأصناف", render: (i) => i.items.length },
  { header: "الإجمالي", render: (i) => formatCurrency(i.totalAmount) },
  { header: "المدفوع", render: (i) => formatCurrency(i.paidAmount) },
  {
    header: "المتبقي",
    render: (i) => (
      <span className={i.remainingAmount > 0 ? "font-bold text-warning" : "text-success"}>
        {formatCurrency(i.remainingAmount)}
      </span>
    ),
  },
  {
    header: "الحالة",
    render: (i) =>
      i.status === "CANCELLED" ? (
        <span className="text-danger">ملغاة</span>
      ) : (
        <span className="text-success">سارية</span>
      ),
  },
];

const paymentColumns: TableColumn<CustomerPayment>[] = [
  { header: "التاريخ", render: (p) => new Date(p.date).toLocaleDateString("ar-EG") },
  { header: "المبلغ", render: (p) => formatCurrency(p.amount) },
  {
    header: "الطريقة",
    render: (p) => ({ CASH: "نقدي", BANK: "بنكي", OTHER: "أخرى" }[p.method]),
  },
  { header: "ملاحظات", render: (p) => p.notes ?? "—" },
];

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => customerService.getProfile(id!),
    enabled: Boolean(id),
  });

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "BANK" | "OTHER">("CASH");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const paymentMutation = useMutation({
    mutationFn: () =>
      customerPaymentService.create({
        customerId: id!,
        amount: Number(amount),
        date: new Date(),
        method,
      }),
    onSuccess: () => {
      setAmount("");
      setPaymentError(null);
      void queryClient.invalidateQueries({ queryKey: ["customer", id] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err) => {
      setPaymentError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  if (isLoading || !profile) {
    return <p className="text-sm text-gray-400">جاري التحميل...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{profile.customer.name}</h1>
          <p className="text-sm text-gray-500">
            {profile.customer.phone ?? "بدون رقم هاتف"} — {profile.customer.address ?? "بدون عنوان"}
          </p>
        </div>
        <Link to={`/customers/${id}/edit`}>
          <Button variant="secondary">تعديل البيانات</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">إجمالي الفواتير</p>
          <p className="mt-1 text-lg font-bold">{formatCurrency(profile.totalInvoiced)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">إجمالي المدفوع</p>
          <p className="mt-1 text-lg font-bold">{formatCurrency(profile.totalPaid)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">الدين المستحق</p>
          <p className={`mt-1 text-lg font-bold ${profile.balance > 0 ? "text-warning" : "text-success"}`}>
            {formatCurrency(profile.balance)}
          </p>
        </Card>
      </div>

      <Card>
        <h3 className="mb-3 text-sm font-bold text-gray-700">تسجيل دفعة جديدة</h3>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setPaymentError(null);
            if (!amount || Number(amount) <= 0) {
              setPaymentError("أدخل مبلغاً صحيحاً");
              return;
            }
            paymentMutation.mutate();
          }}
        >
          <Input
            label="المبلغ"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-40"
          />
          <Select
            label="طريقة الدفع"
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            className="w-40"
          >
            <option value="CASH">نقدي</option>
            <option value="BANK">بنكي</option>
            <option value="OTHER">أخرى</option>
          </Select>
          <Button type="submit" isLoading={paymentMutation.isPending}>
            تسجيل الدفعة
          </Button>
        </form>
        {paymentError && <p className="mt-2 text-sm text-danger">{paymentError}</p>}
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-bold text-gray-700">الفواتير</h3>
        <DataTable
          columns={invoiceColumns}
          rows={profile.invoices}
          keyExtractor={(i) => i.id}
          emptyMessage="لا توجد فواتير مسجلة"
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-gray-700">الدفعات</h3>
        <DataTable
          columns={paymentColumns}
          rows={profile.payments}
          keyExtractor={(p) => p.id}
          emptyMessage="لا توجد دفعات مسجلة"
        />
      </div>
    </div>
  );
}
