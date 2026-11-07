import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { productService } from "@/services/productService";
import { ApiClientError } from "@/services/apiClient";
import { formatCurrency } from "@idm/shared-utils";
import type { ProductWithStock } from "@idm/shared-types";

const unitLabels: Record<ProductWithStock["unit"], string> = {
  KG: "كغ",
  LITER: "لتر",
  PIECE: "قطعة",
};

export default function ProductsListPage() {
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", search],
    queryFn: () => productService.list(search || undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productService.remove(id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
    },
  });

  const columns: TableColumn<ProductWithStock>[] = [
    {
      header: "الاسم",
      render: (p) => (
        <Link to={`/products/${p.id}/edit`} className="font-medium text-primary-700 hover:underline">
          {p.name}
        </Link>
      ),
    },
    { header: "الوحدة", render: (p) => unitLabels[p.unit] },
    { header: "سعر البيع", render: (p) => formatCurrency(p.sellingPrice) },
    {
      header: "المخزون الحالي",
      render: (p) => (
        <span className={p.isLowStock ? "font-bold text-warning" : ""}>
          {p.currentStock} {unitLabels[p.unit]}
          {p.isLowStock && " ⚠️"}
        </span>
      ),
    },
    { header: "الحالة", render: (p) => (p.isActive ? "نشط" : "غير نشط") },
    {
      header: "",
      render: (p) => (
        <div className="flex gap-3">
          <Link to={`/products/${p.id}/edit`} className="text-sm text-primary-600 hover:underline">
            تعديل
          </Link>
          <button
            type="button"
            className="text-sm text-danger hover:underline disabled:opacity-50"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (confirm(`هل تريد حذف المنتج "${p.name}"؟`)) {
                deleteMutation.mutate(p.id);
              }
            }}
          >
            حذف
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">المنتجات</h1>
          <p className="text-sm text-gray-500">إدارة المنتجات وأسعار البيع وحدود التنبيه للمخزون</p>
        </div>
        <Link to="/products/new">
          <Button>
            <Plus size={16} /> إضافة منتج
          </Button>
        </Link>
      </div>

      <Card>
        <Input
          placeholder="ابحث باسم المنتج..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <DataTable
        columns={columns}
        rows={products}
        keyExtractor={(p) => p.id}
        isLoading={isLoading}
        emptyMessage="لا توجد منتجات بعد"
      />
    </div>
  );
}
