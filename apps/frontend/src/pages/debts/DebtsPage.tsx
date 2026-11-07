import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/Card";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { customerService } from "@/services/customerService";
import { formatCurrency } from "@idm/shared-utils";
import type { CustomerWithBalance } from "@idm/shared-types";

const columns: TableColumn<CustomerWithBalance>[] = [
  {
    header: "الزبون",
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
    render: (c) => <span className="font-bold text-warning">{formatCurrency(c.balance)}</span>,
  },
];

export default function DebtsPage() {
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", "debts"],
    queryFn: () => customerService.listWithDebt(),
  });

  const totalDebt = customers.reduce((sum, c) => sum + c.balance, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">الديون</h1>
        <p className="text-sm text-gray-500">
          الزبائن الذين عليهم مبالغ مستحقة حالياً — الدين مُشتق مباشرة من الفواتير ناقص الدفعات
        </p>
      </div>

      <Card>
        <p className="text-sm text-gray-500">إجمالي الديون المستحقة</p>
        <p className="mt-1 text-xl font-bold text-warning">{formatCurrency(totalDebt)}</p>
      </Card>

      <DataTable
        columns={columns}
        rows={customers}
        keyExtractor={(c) => c.id}
        isLoading={isLoading}
        emptyMessage="لا يوجد زبائن عليهم ديون حالياً"
      />
    </div>
  );
}
