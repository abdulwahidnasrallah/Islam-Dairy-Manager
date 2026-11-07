interface SimpleBarChartProps {
  data: Array<{ label: string; value: number }>;
  emptyMessage?: string;
}

/**
 * A minimal, dependency-free bar chart. The project has no charting
 * library installed; pulling one in just for a handful of simple bars
 * isn't worth the added dependency, so this renders proportional
 * divs instead.
 */
export function SimpleBarChart({ data, emptyMessage = "لا توجد بيانات لعرضها" }: SimpleBarChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400">{emptyMessage}</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-2" style={{ height: 160 }}>
      {data.map((point) => (
        <div key={point.label} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-primary-500"
            style={{ height: `${Math.max((point.value / max) * 130, 2)}px` }}
            title={`${point.label}: ${point.value}`}
          />
          <span className="w-full truncate text-center text-[10px] text-gray-500" title={point.label}>
            {point.label}
          </span>
        </div>
      ))}
    </div>
  );
}
