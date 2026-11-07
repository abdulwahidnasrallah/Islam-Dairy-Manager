import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { supplierService } from "@/services/supplierService";
import { formatCurrency } from "@idm/shared-utils";
import type { SupplierWithBalance } from "@idm/shared-types";

export default function SuppliersListPage() {
  const [search, setSearch] = useState("");

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", search],
    queryFn: () => supplierService.list(search || undefined),
  });

  const columns: TableColumn<SupplierWithBalance>[] = [
    { header: "الاسم", render: (s) => <Link to={`/suppliers/${s.id}`} className="font-medium text-primary-700 hover:underline">{s.name}</Link> },
    { header: "الهاتف", render: (s) => s.phone ?? "—" },
    { header: "إجمالي المشتريات", render: (s) => formatCurrency(s.totalPurchases) },
    { header: "المدفوع", render: (s) => formatCurrency(s.totalPaid) },
    {
      header: "الرصيد المستحق",
      render: (s) => (
        <span className={s.balance > 0 ? "font-bold text-warning" : "text-success"}>
          {formatCurrency(s.balance)}
        </span>
      ),
    },
    {
      header: "",
      render: (s) => (
        <Link to={`/suppliers/${s.id}`} className="text-sm text-primary-600 hover:underline">
          عرض التفاصيل
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">الموردون</h1>
          <p className="text-sm text-gray-500">إدارة موردي الحليب وأرصدتهم</p>
        </div>
        <Link to="/suppliers/new">
          <Button>
            <Plus size={16} /> إضافة مورد
          </Button>
        </Link>
      </div>

      <Card>
        <Input
          placeholder="ابحث باسم المورد..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <DataTable
        columns={columns}
        rows={suppliers}
        keyExtractor={(s) => s.id}
        isLoading={isLoading}
        emptyMessage="لا يوجد موردون بعد"
      />
    </div>
  );
}
