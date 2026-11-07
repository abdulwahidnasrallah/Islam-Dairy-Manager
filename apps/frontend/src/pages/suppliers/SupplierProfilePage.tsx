import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { supplierService } from "@/services/supplierService";
import { supplierPaymentService } from "@/services/supplierPaymentService";
import { ApiClientError } from "@/services/apiClient";
import { formatCurrency } from "@idm/shared-utils";
import type { MilkPurchase, PurchaseInvoice, SupplierPayment } from "@idm/shared-types";

const purchaseColumns: TableColumn<MilkPurchase>[] = [
  { header: "التاريخ", render: (p) => new Date(p.date).toLocaleDateString("ar-EG") },
  { header: "الكمية", render: (p) => p.quantity },
  { header: "سعر الوحدة", render: (p) => formatCurrency(p.pricePerUnit) },
  { header: "الإجمالي", render: (p) => formatCurrency(p.totalAmount) },
  { header: "المدفوع", render: (p) => formatCurrency(p.paidAmount) },
  { header: "المتبقي", render: (p) => formatCurrency(p.remainingAmount) },
];

const purchaseInvoiceColumns: TableColumn<PurchaseInvoice>[] = [
  {
    header: "رقم الفاتورة",
    render: (i) => (
      <Link to={`/purchase-invoices/${i.id}`} className="font-medium text-primary-700 hover:underline">
        {i.purchaseNumber}
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

const paymentColumns: TableColumn<SupplierPayment>[] = [
  { header: "التاريخ", render: (p) => new Date(p.date).toLocaleDateString("ar-EG") },
  { header: "المبلغ", render: (p) => formatCurrency(p.amount) },
  {
    header: "الطريقة",
    render: (p) => ({ CASH: "نقدي", BANK: "بنكي", OTHER: "أخرى" }[p.method]),
  },
  { header: "ملاحظات", render: (p) => p.notes ?? "—" },
];

export default function SupplierProfilePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["supplier", id],
    queryFn: () => supplierService.getProfile(id!),
    enabled: Boolean(id),
  });

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "BANK" | "OTHER">("CASH");
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const paymentMutation = useMutation({
    mutationFn: () =>
      supplierPaymentService.create({
        supplierId: id!,
        purchaseInvoiceId: purchaseInvoiceId || null,
        amount: Number(amount),
        date: new Date(),
        method,
      }),
    onSuccess: () => {
      setAmount("");
      setPaymentError(null);
      void queryClient.invalidateQueries({ queryKey: ["supplier", id] });
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
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
          <h1 className="text-xl font-bold text-gray-900">{profile.supplier.name}</h1>
          <p className="text-sm text-gray-500">
            {profile.supplier.phone ?? "بدون رقم هاتف"} — {profile.supplier.address ?? "بدون عنوان"}
          </p>
        </div>
        <Link to={`/suppliers/${id}/edit`}>
          <Button variant="secondary">تعديل البيانات</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">إجمالي المشتريات</p>
          <p className="mt-1 text-lg font-bold">{formatCurrency(profile.totalPurchases)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">إجمالي المدفوع</p>
          <p className="mt-1 text-lg font-bold">{formatCurrency(profile.totalPaid)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">الرصيد المستحق</p>
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
          <Select
            label="الفاتورة"
            value={purchaseInvoiceId}
            onChange={(e) => setPurchaseInvoiceId(e.target.value)}
            className="w-56"
          >
            <option value="">دفعة عامة للمورد</option>
            {profile.purchaseInvoices
              .filter((invoice) => invoice.status === "CONFIRMED" && invoice.remainingAmount > 0)
              .map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.purchaseNumber} ({formatCurrency(invoice.remainingAmount)})
                </option>
              ))}
          </Select>
          <Button type="submit" isLoading={paymentMutation.isPending}>
            تسجيل الدفعة
          </Button>
        </form>
        {paymentError && <p className="mt-2 text-sm text-danger">{paymentError}</p>}
      </Card>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-700">فواتير الشراء (المنتجات)</h3>
          <Link
            to={`/purchase-invoices?supplierId=${id}`}
            className="text-xs text-primary-600 hover:underline"
          >
            فاتورة شراء جديدة
          </Link>
        </div>
        <DataTable
          columns={purchaseInvoiceColumns}
          rows={profile.purchaseInvoices}
          keyExtractor={(i) => i.id}
          emptyMessage="لا توجد فواتير شراء مسجلة لهذا المورد"
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-gray-700">المشتريات (الحليب)</h3>
        <DataTable
          columns={purchaseColumns}
          rows={profile.purchases}
          keyExtractor={(p) => p.id}
          emptyMessage="لا توجد مشتريات مسجلة"
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
