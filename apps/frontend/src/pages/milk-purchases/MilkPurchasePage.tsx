import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { supplierService } from "@/services/supplierService";
import { milkPurchaseService } from "@/services/milkPurchaseService";
import { ApiClientError } from "@/services/apiClient";
import { formatCurrency } from "@idm/shared-utils";
import type { MilkPurchase } from "@idm/shared-types";

const columns: TableColumn<MilkPurchase & { supplierName?: string }>[] = [
  { header: "التاريخ", render: (p) => new Date(p.date).toLocaleDateString("ar-EG") },
  { header: "الكمية", render: (p) => p.quantity },
  { header: "سعر الوحدة", render: (p) => formatCurrency(p.pricePerUnit) },
  { header: "الإجمالي", render: (p) => formatCurrency(p.totalAmount) },
  { header: "المدفوع", render: (p) => formatCurrency(p.paidAmount) },
  { header: "المتبقي", render: (p) => formatCurrency(p.remainingAmount) },
];

export default function MilkPurchasePage() {
  const queryClient = useQueryClient();

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => supplierService.list(),
  });

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["milk-purchases"],
    queryFn: () => milkPurchaseService.list(),
  });

  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total =
    quantity && pricePerUnit ? Number(quantity) * Number(pricePerUnit) : 0;

  const mutation = useMutation({
    mutationFn: () =>
      milkPurchaseService.create({
        supplierId,
        date: new Date(date),
        quantity: Number(quantity),
        pricePerUnit: Number(pricePerUnit),
        paidAmount: Number(paidAmount || 0),
        notes: notes || null,
      }),
    onSuccess: () => {
      setQuantity("");
      setPricePerUnit("");
      setPaidAmount("0");
      setNotes("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["milk-purchases"] });
      void queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      void queryClient.invalidateQueries({ queryKey: ["supplier", supplierId] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">شراء الحليب</h1>
        <p className="text-sm text-gray-500">تسجيل توريد حليب جديد من أحد الموردين</p>
      </div>

      <Card>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!supplierId) {
              setError("الرجاء اختيار المورد");
              return;
            }
            if (!quantity || Number(quantity) <= 0) {
              setError("الكمية يجب أن تكون أكبر من صفر");
              return;
            }
            if (!pricePerUnit || Number(pricePerUnit) <= 0) {
              setError("السعر يجب أن يكون أكبر من صفر");
              return;
            }
            mutation.mutate();
          }}
        >
          <Select
            label="المورد"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">اختر المورد...</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>

          <Input label="التاريخ" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input
            label="الكمية (كغ)"
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            label="سعر الوحدة"
            type="number"
            step="0.01"
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(e.target.value)}
          />
          <Input
            label="المبلغ المدفوع الآن"
            type="number"
            step="0.01"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
          />
          <Input label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="col-span-full flex items-center justify-between rounded-lg bg-primary-50 px-4 py-3">
            <span className="text-sm text-gray-600">القيمة الإجمالية</span>
            <span className="text-lg font-bold text-primary-700">{formatCurrency(total)}</span>
          </div>

          {error && <p className="col-span-full text-sm text-danger">{error}</p>}

          <div className="col-span-full">
            <Button type="submit" isLoading={mutation.isPending}>
              حفظ عملية الشراء
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-bold text-gray-700">آخر عمليات الشراء</h3>
        <DataTable
          columns={columns}
          rows={purchases}
          keyExtractor={(p) => p.id}
          isLoading={isLoading}
          emptyMessage="لا توجد مشتريات مسجلة بعد"
        />
      </div>
    </div>
  );
}
