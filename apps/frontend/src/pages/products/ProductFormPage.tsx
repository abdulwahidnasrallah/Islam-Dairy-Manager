import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { productService } from "@/services/productService";
import { ApiClientError } from "@/services/apiClient";
import type { ProductUnit } from "@idm/shared-types";

export default function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("KG");
  const [sellingPrice, setSellingPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [minStockAlert, setMinStockAlert] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: product } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productService.getById(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (product) {
      setName(product.name);
      setUnit(product.unit);
      setSellingPrice(String(product.sellingPrice));
      setCostPrice(product.costPrice !== null ? String(product.costPrice) : "");
      setMinStockAlert(String(product.minStockAlert));
      setIsActive(product.isActive);
      setNotes(product.notes ?? "");
    }
  }, [product]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        unit,
        sellingPrice: Number(sellingPrice),
        costPrice: costPrice ? Number(costPrice) : null,
        minStockAlert: Number(minStockAlert || 0),
        isActive,
        notes: notes || null,
      };
      return isEditMode ? productService.update(id!, payload) : productService.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      navigate("/products");
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  return (
    <Card className="mx-auto max-w-lg">
      <h1 className="mb-4 text-lg font-bold text-gray-900">
        {isEditMode ? "تعديل بيانات المنتج" : "إضافة منتج جديد"}
      </h1>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!name.trim()) {
            setError("اسم المنتج مطلوب");
            return;
          }
          if (!sellingPrice || Number(sellingPrice) <= 0) {
            setError("سعر البيع يجب أن يكون أكبر من صفر");
            return;
          }
          mutation.mutate();
        }}
      >
        <Input label="اسم المنتج" value={name} onChange={(e) => setName(e.target.value)} required />

        <Select label="الوحدة" value={unit} onChange={(e) => setUnit(e.target.value as ProductUnit)}>
          <option value="KG">كيلوغرام</option>
          <option value="LITER">لتر</option>
          <option value="PIECE">قطعة</option>
        </Select>

        <Input
          label="سعر البيع"
          type="number"
          step="0.01"
          value={sellingPrice}
          onChange={(e) => setSellingPrice(e.target.value)}
        />
        <Input
          label="سعر التكلفة (اختياري)"
          type="number"
          step="0.01"
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
        />
        <p className="-mt-2 text-xs text-gray-400">
          يُحدَّث تلقائياً من تكلفة آخر دفعة إنتاج (كمية الحليب المستهلك × متوسط سعره) إذا سجّلت دفعة إنتاج
          لهذا المنتج من صفحة الإنتاج — يمكنك تعديله يدوياً هنا في أي وقت.
        </p>
        <Input
          label="حد التنبيه لانخفاض المخزون"
          type="number"
          step="0.01"
          value={minStockAlert}
          onChange={(e) => setMinStockAlert(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          منتج نشط
        </label>

        <Input label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button type="submit" isLoading={mutation.isPending}>
            حفظ
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            إلغاء
          </Button>
        </div>
      </form>
    </Card>
  );
}
