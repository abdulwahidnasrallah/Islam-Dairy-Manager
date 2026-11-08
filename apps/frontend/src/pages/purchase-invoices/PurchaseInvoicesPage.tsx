import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { supplierService } from "@/services/supplierService";
import { productService } from "@/services/productService";
import { purchaseInvoiceService } from "@/services/purchaseInvoiceService";
import { ApiClientError } from "@/services/apiClient";
import { formatCurrency } from "@idm/shared-utils";
import type { PurchaseInvoice } from "@idm/shared-types";

interface DraftItem {
  productId: string;
  quantity: string;
  unitPrice: string;
}

function emptyItem(): DraftItem {
  return { productId: "", quantity: "", unitPrice: "" };
}

const paymentMethodLabels: Record<string, string> = {
  CASH: "نقدي",
  BANK: "بنكي",
  OTHER: "أخرى",
};

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
  { header: "المورد", render: (i) => i.supplierName ?? "—" },
  { header: "عدد الأصناف", render: (i) => i.items.length },
  { header: "الإجمالي", render: (i) => formatCurrency(i.totalAmount) },
  { header: "طريقة الدفع", render: (i) => paymentMethodLabels[i.paymentMethod] ?? i.paymentMethod },
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

export default function PurchaseInvoicesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const supplierIdFromQuery = searchParams.get("supplierId") ?? "";

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => supplierService.list(),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productService.list(),
  });
  const { data: purchaseInvoices = [], isLoading } = useQuery({
    queryKey: ["purchase-invoices"],
    queryFn: () => purchaseInvoiceService.list(),
  });

  const [supplierId, setSupplierId] = useState(supplierIdFromQuery);
  const [supplierFilter, setSupplierFilter] = useState(supplierIdFromQuery);

  // Coming from a supplier's profile page ("فاتورة شراء جديدة") pre-selects
  // that supplier in both the create form and the list filter below.
  useEffect(() => {
    if (supplierIdFromQuery) {
      setSupplierId(supplierIdFromQuery);
      setSupplierFilter(supplierIdFromQuery);
    }
  }, [supplierIdFromQuery]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK" | "OTHER">("CASH");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  // One key per invoice attempt: a double click or a retry after a network error
  // re-sends the SAME key, so the server creates (and stocks) the invoice once.
  const submitKeyRef = useRef<string>(crypto.randomUUID());

  const total = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  const mutation = useMutation({
    mutationFn: () =>
      purchaseInvoiceService.create({
        supplierId,
        date: new Date(date),
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
        paidAmount: Number(paidAmount || 0),
        paymentMethod,
        notes: notes || null,
        idempotencyKey: submitKeyRef.current,
      }),
    onSuccess: () => {
      submitKeyRef.current = crypto.randomUUID();
      setSupplierId("");
      setItems([emptyItem()]);
      setPaidAmount("");
      setPaymentMethod("CASH");
      setNotes("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["purchase-invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  const visibleInvoices = supplierFilter
    ? purchaseInvoices.filter((i) => i.supplierId === supplierFilter)
    : purchaseInvoices;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">فواتير شراء الموردين</h1>
        <p className="text-sm text-gray-500">
          تسجيل فاتورة شراء منتجات من مورد — تُضاف الكميات المشتراة تلقائياً إلى المخزون
        </p>
      </div>

      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!supplierId) {
              setError("الرجاء اختيار المورد");
              return;
            }
            if (items.some((item) => !item.productId || !item.quantity || !item.unitPrice)) {
              setError("الرجاء إكمال جميع حقول الأصناف");
              return;
            }
            if (Number(paidAmount || 0) > total) {
              setError("المبلغ المدفوع أكبر من إجمالي الفاتورة");
              return;
            }
            if (mutation.isPending) return;
            mutation.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select label="المورد" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">اختر المورد...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input label="التاريخ" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Select
              label="طريقة الدفع"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
            >
              <option value="CASH">نقدي</option>
              <option value="BANK">بنكي</option>
              <option value="OTHER">أخرى</option>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-gray-700">الأصناف</p>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr,1fr,1fr,auto]">
                <Select
                  value={item.productId}
                  onChange={(e) => updateItem(index, { productId: e.target.value })}
                >
                  <option value="">اختر المنتج...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (متوفر: {p.currentStock})
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="الكمية"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="سعر الوحدة"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, { unitPrice: e.target.value })}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  disabled={items.length === 1}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              className="self-start"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
            >
              <Plus size={16} /> إضافة صنف
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="المبلغ المدفوع الآن"
              type="number"
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
            <Input label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <p className="text-sm text-gray-700">
            الإجمالي: <span className="font-bold">{formatCurrency(total)}</span>
          </p>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div>
            <Button type="submit" isLoading={mutation.isPending}>
              حفظ فاتورة الشراء
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-gray-700">فواتير الشراء</h3>
          <Select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="w-56"
          >
            <option value="">كل الموردين</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <DataTable
          columns={purchaseInvoiceColumns}
          rows={visibleInvoices}
          keyExtractor={(i) => i.id}
          isLoading={isLoading}
          emptyMessage="لا توجد فواتير شراء مسجلة بعد"
        />
      </div>
    </div>
  );
}
