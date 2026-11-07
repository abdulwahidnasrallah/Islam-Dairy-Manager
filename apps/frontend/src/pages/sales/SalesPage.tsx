import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { customerService } from "@/services/customerService";
import { productService } from "@/services/productService";
import { salesService } from "@/services/salesService";
import { ApiClientError } from "@/services/apiClient";
import { formatCurrency } from "@idm/shared-utils";
import type { Invoice } from "@idm/shared-types";

interface DraftItem {
  productId: string;
  quantity: string;
  unitPrice: string;
}

function emptyItem(): DraftItem {
  return { productId: "", quantity: "", unitPrice: "" };
}

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
  { header: "الزبون", render: (i) => i.customerName ?? "—" },
  { header: "عدد الأصناف", render: (i) => i.items.length },
  { header: "الإجمالي", render: (i) => formatCurrency(i.totalAmount) },
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

export default function SalesPage() {
  const queryClient = useQueryClient();

  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => customerService.list(),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productService.list(),
  });
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: () => salesService.list(),
  });

  const [customerId, setCustomerId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function handleProductChange(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateItem(index, {
      productId,
      unitPrice: product ? String(product.sellingPrice) : "",
    });
  }

  const mutation = useMutation({
    mutationFn: () =>
      salesService.create({
        customerId,
        date: new Date(date),
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
        paidAmount: Number(paidAmount || 0),
        notes: notes || null,
      }),
    onSuccess: () => {
      setCustomerId("");
      setItems([emptyItem()]);
      setPaidAmount("");
      setNotes("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">المبيعات</h1>
        <p className="text-sm text-gray-500">
          تسجيل فاتورة بيع جديدة — تُخصَم الكميات المباعة تلقائياً من المخزون
        </p>
      </div>

      <Card>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!customerId) {
              setError("الرجاء اختيار الزبون");
              return;
            }
            if (items.some((item) => !item.productId || !item.quantity || !item.unitPrice)) {
              setError("الرجاء إكمال جميع حقول الأصناف");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="الزبون" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">اختر الزبون...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Input label="التاريخ" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold text-gray-700">الأصناف</p>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr,1fr,1fr,auto]">
                <Select
                  value={item.productId}
                  onChange={(e) => handleProductChange(index, e.target.value)}
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
              حفظ الفاتورة
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-bold text-gray-700">آخر الفواتير</h3>
        <DataTable
          columns={invoiceColumns}
          rows={invoices}
          keyExtractor={(i) => i.id}
          isLoading={isLoading}
          emptyMessage="لا توجد فواتير مسجلة بعد"
        />
      </div>
    </div>
  );
}
