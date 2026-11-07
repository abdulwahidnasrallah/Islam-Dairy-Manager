import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { inventoryService } from "@/services/inventoryService";
import { ApiClientError } from "@/services/apiClient";
import type { ProductWithStock } from "@idm/shared-types";

const unitLabels: Record<ProductWithStock["unit"], string> = {
  KG: "كغ",
  LITER: "لتر",
  PIECE: "قطعة",
};

const reasonLabels = {
  ADJUSTMENT: "تصحيح جرد",
  DAMAGE: "تالف",
  RETURN: "مرتجع",
  OTHER: "أخرى",
} as const;

/** Every reason that can appear in the movements table — the manual form above only offers `reasonLabels`; the rest are written by other modules. */
const movementReasonLabels: Record<string, string> = {
  ...reasonLabels,
  PRODUCTION: "إنتاج",
  SALE: "بيع",
  PURCHASE: "شراء من مورد",
  PURCHASE_CANCELLED: "إلغاء فاتورة شراء",
};

export default function InventoryPage() {
  const queryClient = useQueryClient();

  const { data: stock = [], isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => inventoryService.listStock(),
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["inventory-movements"],
    queryFn: () => inventoryService.listMovements(),
  });

  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState<keyof typeof reasonLabels>("ADJUSTMENT");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      inventoryService.adjust({
        productId,
        type,
        quantity: Number(quantity),
        date: new Date(),
        reason,
        notes: notes || null,
      }),
    onSuccess: () => {
      setQuantity("");
      setNotes("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory-movements"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  const stockColumns: TableColumn<ProductWithStock>[] = [
    { header: "المنتج", render: (p) => p.name },
    { header: "الوحدة", render: (p) => unitLabels[p.unit] },
    {
      header: "المخزون الحالي",
      render: (p) => (
        <span className={p.isLowStock ? "font-bold text-warning" : ""}>
          {p.currentStock} {unitLabels[p.unit]}
          {p.isLowStock && " ⚠️ تحت الحد الأدنى"}
        </span>
      ),
    },
    { header: "حد التنبيه", render: (p) => `${p.minStockAlert} ${unitLabels[p.unit]}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">المخزون</h1>
        <p className="text-sm text-gray-500">
          المخزون الحالي مُشتق دائماً من سجل الحركات، وليس رقماً مخزَّناً منفصلاً
        </p>
      </div>

      <Card>
        <h3 className="mb-3 text-sm font-bold text-gray-700">تسجيل حركة تعديل مخزون</h3>
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!productId) {
              setError("الرجاء اختيار المنتج");
              return;
            }
            if (!quantity || Number(quantity) <= 0) {
              setError("الكمية يجب أن تكون أكبر من صفر");
              return;
            }
            mutation.mutate();
          }}
        >
          <Select label="المنتج" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">اختر المنتج...</option>
            {stock.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>

          <Select label="نوع الحركة" value={type} onChange={(e) => setType(e.target.value as "IN" | "OUT")}>
            <option value="IN">إدخال (زيادة)</option>
            <option value="OUT">إخراج (نقص)</option>
          </Select>

          <Input
            label="الكمية"
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          <Select
            label="السبب"
            value={reason}
            onChange={(e) => setReason(e.target.value as keyof typeof reasonLabels)}
          >
            {Object.entries(reasonLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Input
            label="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="sm:col-span-2 lg:col-span-2"
          />

          {error && <p className="col-span-full text-sm text-danger">{error}</p>}

          <div className="col-span-full">
            <Button type="submit" isLoading={mutation.isPending}>
              تسجيل الحركة
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h3 className="mb-2 text-sm font-bold text-gray-700">المخزون الحالي</h3>
        <DataTable
          columns={stockColumns}
          rows={stock}
          keyExtractor={(p) => p.id}
          isLoading={isLoading}
          emptyMessage="لا توجد منتجات بعد"
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-gray-700">آخر حركات المخزون</h3>
        <DataTable
          columns={[
            { header: "التاريخ", render: (m) => new Date(m.date).toLocaleDateString("ar-EG") },
            { header: "النوع", render: (m) => (m.type === "IN" ? "إدخال" : "إخراج") },
            { header: "السبب", render: (m) => movementReasonLabels[m.reason] ?? m.reason },
            { header: "الكمية", render: (m) => m.quantity },
            { header: "ملاحظات", render: (m) => m.notes ?? "—" },
          ]}
          rows={movements}
          keyExtractor={(m) => m.id}
          emptyMessage="لا توجد حركات مسجلة بعد"
        />
      </div>
    </div>
  );
}
