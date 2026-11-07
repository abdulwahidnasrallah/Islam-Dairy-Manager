import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { customerService } from "@/services/customerService";
import { formatCurrency } from "@idm/shared-utils";
import type { CustomerWithBalance } from "@idm/shared-types";

export default function CustomersListPage() {
  const [search, setSearch] = useState("");

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => customerService.list(search || undefined),
  });

  const columns: TableColumn<CustomerWithBalance>[] = [
    {
      header: "الاسم",
      render: (c) => (
        <Link to={`/customers/${c.id}`} className="font-medium text-primary-700 hover:underline">
          {c.name}
        </Link>
      ),
    },
    { header: "الهاتف", render: (c) => c.phone ?? "—" },
    { header: "إجمالي الفواتير", render: (c) => formatCurrency(c.totalInvoiced) },
    { header: "المدفوع", render: (c) => formatCurrency(c.totalPaid) },
    {
      header: "الدين المستحق",
      render: (c) => (
        <span className={c.balance > 0 ? "font-bold text-warning" : "text-success"}>
          {formatCurrency(c.balance)}
        </span>
      ),
    },
    {
      header: "",
      render: (c) => (
        <Link to={`/customers/${c.id}`} className="text-sm text-primary-600 hover:underline">
          عرض التفاصيل
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">الزبائن</h1>
          <p className="text-sm text-gray-500">إدارة الزبائن وأرصدة الديون المستحقة عليهم</p>
        </div>
        <Link to="/customers/new">
          <Button>
            <Plus size={16} /> إضافة زبون
          </Button>
        </Link>
      </div>

      <Card>
        <Input
          placeholder="ابحث باسم الزبون..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <DataTable
        columns={columns}
        rows={customers}
        keyExtractor={(c) => c.id}
        isLoading={isLoading}
        emptyMessage="لا يوجد زبائن بعد"
      />
    </div>
  );
}
