import { useMemo, useRef, useState } from "react";
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
import { buildSupplierStatement, formatCurrency, type SupplierStatementEntry } from "@idm/shared-utils";
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
    render: (i) => {
      if (i.status === "CANCELLED") return <span className="text-danger">ملغاة</span>;
      if (i.paymentStatus === "PAID") return <span className="text-success">مدفوعة</span>;
      if (i.paymentStatus === "PARTIAL") return <span className="text-warning">مدفوعة جزئياً</span>;
      return <span className="text-danger">غير مدفوعة</span>;
    },
  },
];

function makePaymentColumns(invoiceNumberById: Map<string, string>): TableColumn<SupplierPayment>[] {
  return [
    { header: "التاريخ", render: (p) => new Date(p.date).toLocaleDateString("ar-EG") },
    { header: "المبلغ", render: (p) => formatCurrency(p.amount) },
    {
      header: "الطريقة",
      render: (p) => ({ CASH: "نقدي", BANK: "بنكي", OTHER: "أخرى" }[p.method]),
    },
    {
      header: "الفاتورة",
      render: (p) =>
        p.purchaseInvoiceId ? (
          <Link to={`/purchase-invoices/${p.purchaseInvoiceId}`} className="text-primary-700 hover:underline">
            {invoiceNumberById.get(p.purchaseInvoiceId) ?? "فاتورة"}
          </Link>
        ) : (
          "دفعة عامة"
        ),
    },
    { header: "ملاحظات", render: (p) => p.notes ?? "—" },
  ];
}

const statementColumns: TableColumn<SupplierStatementEntry>[] = [
  { header: "التاريخ", render: (e) => new Date(e.date).toLocaleDateString("ar-EG") },
  { header: "البيان", render: (e) => e.reference },
  { header: "عليه (مشتريات)", render: (e) => (e.debit ? formatCurrency(e.debit) : "—") },
  { header: "له (مدفوع)", render: (e) => (e.credit ? formatCurrency(e.credit) : "—") },
  {
    header: "الرصيد",
    render: (e) => (
      <span className={e.balance > 0 ? "font-bold text-warning" : "font-bold text-success"}>
        {formatCurrency(e.balance)}
      </span>
    ),
  },
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
  // Optional: settle one specific purchase invoice instead of a general payment.
  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  // One key per payment attempt: a double click or a retry re-sends the SAME key,
  // so the server records the payment once. A fresh key is made after success.
  const paymentKeyRef = useRef<string>(crypto.randomUUID());
  const [method, setMethod] = useState<"CASH" | "BANK" | "OTHER">("CASH");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const paymentMutation = useMutation({
    mutationFn: () =>
      supplierPaymentService.create({
        supplierId: id!,
        amount: Number(amount),
        date: new Date(),
        method,
        purchaseInvoiceId: paymentInvoiceId || null,
        idempotencyKey: paymentKeyRef.current,
      }),
    onSuccess: () => {
      paymentKeyRef.current = crypto.randomUUID();
      setAmount("");
      setPaymentInvoiceId("");
      setPaymentError(null);
      void queryClient.invalidateQueries({ queryKey: ["supplier", id] });
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      void queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["purchase-invoice"] });
      void queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err) => {
      setPaymentError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  const statement = useMemo(
    () =>
      profile
        ? buildSupplierStatement({
            milkPurchases: profile.purchases.map((m) => ({
              id: m.id,
              date: m.date,
              totalAmount: m.totalAmount,
              paidAmount: m.paidAmount,
            })),
            purchaseInvoices: profile.purchaseInvoices.map((i) => ({
              id: i.id,
              purchaseNumber: i.purchaseNumber,
              date: i.date,
              totalAmount: i.totalAmount,
              initialPaidAmount: i.initialPaidAmount,
              status: i.status,
            })),
            payments: profile.payments.map((p) => ({
              id: p.id,
              date: p.date,
              amount: p.amount,
              purchaseInvoiceId: p.purchaseInvoiceId,
            })),
          })
        : null,
    [profile],
  );

  if (isLoading || !profile) {
    return <p className="text-sm text-gray-400">جاري التحميل...</p>;
  }

  const invoiceNumberById = new Map(profile.purchaseInvoices.map((i) => [i.id, i.purchaseNumber]));
  const payableInvoices = profile.purchaseInvoices.filter(
    (i) => i.status === "CONFIRMED" && i.remainingAmount > 0,
  );
  const selectedInvoice = payableInvoices.find((i) => i.id === paymentInvoiceId);

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
            if (selectedInvoice && Number(amount) > selectedInvoice.remainingAmount) {
              setPaymentError(
                `المبلغ أكبر من المتبقي على الفاتورة (${formatCurrency(selectedInvoice.remainingAmount)})`,
              );
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
            label="الدفعة على"
            value={paymentInvoiceId}
            onChange={(e) => setPaymentInvoiceId(e.target.value)}
            className="w-64"
          >
            <option value="">دفعة عامة (من رصيد المورد)</option>
            {payableInvoices.map((i) => (
              <option key={i.id} value={i.id}>
                {i.purchaseNumber} — المتبقي {formatCurrency(i.remainingAmount)}
              </option>
            ))}
          </Select>
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
          columns={makePaymentColumns(invoiceNumberById)}
          rows={profile.payments}
          keyExtractor={(p) => p.id}
          emptyMessage="لا توجد دفعات مسجلة"
        />
      </div>

      {statement && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-gray-700">
            كشف الحساب (الفواتير الملغاة لا تظهر فيه)
          </h3>
          <DataTable
            columns={statementColumns}
            rows={statement.entries}
            keyExtractor={(e) => e.id}
            emptyMessage="لا توجد حركات"
          />
          <p className="mt-2 text-sm text-gray-700">
            إجمالي عليه: <span className="font-bold">{formatCurrency(statement.totalDebit)}</span> — إجمالي
            له: <span className="font-bold">{formatCurrency(statement.totalCredit)}</span> — الرصيد الختامي:{" "}
            <span className="font-bold">{formatCurrency(statement.closingBalance)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
