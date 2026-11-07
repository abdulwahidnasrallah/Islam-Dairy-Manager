import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

interface SummaryCardProps {
  title: string;
  value?: string;
  icon: LucideIcon;
  isLoading?: boolean;
  isError?: boolean;
}

export function SummaryCard({ title, value, icon: Icon, isLoading, isError }: SummaryCardProps) {
  return (
    <Card className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        {isLoading ? (
          <div className="mt-2 h-6 w-20 animate-pulse rounded bg-gray-200" />
        ) : isError ? (
          <p className="mt-1 text-sm text-danger">تعذر التحميل</p>
        ) : (
          <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
        )}
      </div>
      <div className="rounded-full bg-primary-50 p-3 text-primary-600">
        <Icon size={22} />
      </div>
    </Card>
  );
}
