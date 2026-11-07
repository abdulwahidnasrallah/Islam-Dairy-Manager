import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Wallet,
  Package,
  Boxes,
  Factory,
  Truck,
  Milk,
  FileText,
  Receipt,
  DollarSign,
  FileBarChart,
  Sparkles,
  DatabaseBackup,
  Settings,
} from "lucide-react";

/**
 * Sidebar sections mirror the approved information architecture. Every
 * item here routes to a real, fully-built page — see docs/ROADMAP.md
 * for the module that built each one. Permission checks are enforced
 * in the backend (authorize() on every route); the sidebar and
 * frontend routing only require being logged in (see PrivateRoute),
 * not a specific permission. In practice this app is run by a small
 * number of trusted staff under one Administrator role, so this is an
 * accepted simplification — a user without a permission still sees the
 * link but gets a clear "access denied" response from the API.
 */
const navItems = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/sales", label: "المبيعات", icon: ShoppingCart },
  { to: "/customers", label: "الزبائن", icon: Users },
  { to: "/debts", label: "الديون", icon: Wallet },
  { to: "/products", label: "المنتجات", icon: Package },
  { to: "/inventory", label: "المخزون", icon: Boxes },
  { to: "/production", label: "الإنتاج", icon: Factory },
  { to: "/suppliers", label: "الموردون", icon: Truck },
  { to: "/milk-purchases", label: "شراء الحليب", icon: Milk },
  { to: "/purchase-invoices", label: "فواتير شراء الموردين", icon: FileText },
  { to: "/expenses", label: "المصاريف", icon: Receipt },
  { to: "/cash-register", label: "الصندوق", icon: DollarSign },
  { to: "/reports", label: "التقارير", icon: FileBarChart },
  { to: "/assistant", label: "المساعد الذكي", icon: Sparkles },
  { to: "/backup", label: "النسخ الاحتياطي", icon: DatabaseBackup },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="no-print hidden w-60 shrink-0 border-l border-gray-200 bg-surface md:flex md:flex-col">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
