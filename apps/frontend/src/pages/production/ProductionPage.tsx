import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { productService } from "@/services/productService";
import { productionService } from "@/services/productionService";
import { ApiClientError } from "@/services/apiClient";
import type { ProductionBatch } from "@idm/shared-types";

const columns: TableColumn<ProductionBatch & { productName?: string }>[] = [
  { header: "التاريخ", render: (b) => new Date(b.date).toLocaleDateString("ar-EG") },
  { header: "الكمية المنتَجة", render: (b) => b.quantityProduced },
  { header: "الحليب المستهلك", render: (b) => b.milkConsumed ?? "—" },
  { header: "ملاحظات", render: (b) => b.notes ?? "—" },
];

export default function ProductionPage() {
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productService.list(),
  });

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["production"],
    queryFn: () => productionService.list(),
  });

  const [productId, setProductId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantityProduced, setQuantityProduced] = useState("");
  const [milkConsumed, setMilkConsumed] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      productionService.create({
        productId,
        date: new Date(date),
        quantityProduced: Number(quantityProduced),
        milkConsumed: milkConsumed ? Number(milkConsumed) : null,
        notes: notes || null,
      }),
    onSuccess: () => {
      setQuantityProduced("");
      setMilkConsumed("");
      setNotes("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["production"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">الإنتاج</h1>
        <p className="text-sm text-gray-500">
          تسجيل دفعة إنتاج جديدة — تُضاف الكمية المنتَجة تلقائياً إلى مخزون المنتج
        </p>
      </div>

      <Card>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!productId) {
              setError("الرجاء اختيار المنتج");
              return;
            }
            if (!quantityProduced || Number(quantityProduced) <= 0) {
              setError("الكمية المنتَجة يجب أن تكون أكبر من صفر");
              return;
            }
            mutation.mutate();
          }}
        >
          <Select label="المنتج" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">اختر المنتج...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>

          <Input label="التاريخ" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input
            label="الكمية المنتَجة"
            type="number"
            step="0.01"
            value={quantityProduced}
            onChange={(e) => setQuantityProduced(e.target.value)}
          />
          <Input
            label="الحليب المستهلك (اختياري)"
            type="number"
            step="0.01"
            value={milkConsumed}
            onChange={(e) => setMilkConsumed(e.target.value)}
          />
          <Input
            label="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="sm:col-span-2 lg:col-span-1"
          />

          {error && <p className="col-span-full text-sm text-danger">{error}</p>}

          <div className="col-span-full">
            <Button type="submit" isLoading={mutation.isPending}>
              حفظ دفعة الإنتاج
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-bold text-gray-700">آخر دفعات الإنتاج</h3>
        <DataTable
          columns={columns}
          rows={batches}
          keyExtractor={(b) => b.id}
          isLoading={isLoading}
          emptyMessage="لا توجد دفعات إنتاج مسجلة بعد"
        />
      </div>
    </div>
  );
}
