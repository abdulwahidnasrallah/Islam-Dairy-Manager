import type { ReactNode } from "react";

export interface TableColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
}

/**
 * Minimal, dependency-free data table.
 * Search/sort/pagination are added per-page as each module needs them —
 * this component only owns rendering, to avoid building a premature
 * "table framework" before real usage patterns are known.
 */
export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  isLoading,
  emptyMessage = "لا توجد بيانات",
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-card border border-gray-200">
      <table className="w-full text-right text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className={`px-4 py-2 font-medium ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {isLoading && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-gray-400">
                جاري التحميل...
              </td>
            </tr>
          )}

          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          )}

          {!isLoading &&
            rows.map((row) => (
              <tr key={keyExtractor(row)} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col.header} className={`px-4 py-3 ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
