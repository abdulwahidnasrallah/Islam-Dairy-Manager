import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, Sparkles, User } from "lucide-react";
import { useAuth } from "@/store/authContext";
import { SmartSearchBar } from "@/components/search/SmartSearchBar";
import { settingsService } from "@/services/settingsService";
import { dashboardService } from "@/services/dashboardService";

export function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsService.getAll(),
    staleTime: 5 * 60_000,
  });

  const { data: summary } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => dashboardService.getSummary(),
    refetchInterval: 60_000,
  });

  const showLowStockBadge = settings?.LOW_STOCK_ALERTS_ENABLED && (summary?.lowStockCount ?? 0) > 0;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header className="no-print flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-surface px-4">
      <div className="shrink-0">
        <h2 className="text-sm font-bold text-primary-700">
          {settings?.STORE_NAME_AR ?? "إسلام للألبان والأجبان"}
        </h2>
        <p className="text-xs text-gray-400">
          {new Intl.DateTimeFormat("ar-EG", { dateStyle: "full" }).format(new Date())}
        </p>
      </div>

      <SmartSearchBar />

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100"
          aria-label="الإشعارات"
          onClick={() => navigate("/inventory")}
          title={showLowStockBadge ? `${summary?.lowStockCount} منتج تحت حد المخزون الأدنى` : "لا توجد تنبيهات"}
        >
          <Bell size={18} />
          {showLowStockBadge && (
            <span className="absolute -left-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
              {summary!.lowStockCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className="rounded-full p-2 text-primary-600 hover:bg-primary-50"
          aria-label="المساعد الذكي"
          onClick={() => navigate("/assistant")}
        >
          <Sparkles size={18} />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-100"
          >
            <span className="rounded-full bg-primary-100 p-1.5 text-primary-700">
              <User size={16} />
            </span>
            <span className="text-sm text-gray-700">{user?.fullName}</span>
          </button>

          {menuOpen && (
            <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-surface py-1 shadow-md">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-3 py-2 text-right text-sm text-danger hover:bg-gray-50"
              >
                تسجيل الخروج
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
