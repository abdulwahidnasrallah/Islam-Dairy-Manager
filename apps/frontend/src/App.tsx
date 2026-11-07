import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/store/authContext";
import { PrivateRoute } from "@/routes/PrivateRoute";
import { AppLayout } from "@/layouts/AppLayout";
import LoginPage from "@/pages/Login";
import DashboardPage from "@/pages/Dashboard";
import SettingsPage from "@/pages/settings/SettingsPage";
import SuppliersListPage from "@/pages/suppliers/SuppliersListPage";
import SupplierFormPage from "@/pages/suppliers/SupplierFormPage";
import SupplierProfilePage from "@/pages/suppliers/SupplierProfilePage";
import MilkPurchasePage from "@/pages/milk-purchases/MilkPurchasePage";
import PurchaseInvoicesPage from "@/pages/purchase-invoices/PurchaseInvoicesPage";
import PurchaseInvoiceViewPage from "@/pages/purchase-invoices/PurchaseInvoiceViewPage";
import ProductsListPage from "@/pages/products/ProductsListPage";
import ProductFormPage from "@/pages/products/ProductFormPage";
import InventoryPage from "@/pages/inventory/InventoryPage";
import ProductionPage from "@/pages/production/ProductionPage";
import CustomersListPage from "@/pages/customers/CustomersListPage";
import CustomerFormPage from "@/pages/customers/CustomerFormPage";
import CustomerProfilePage from "@/pages/customers/CustomerProfilePage";
import SalesPage from "@/pages/sales/SalesPage";
import InvoiceViewPage from "@/pages/sales/InvoiceViewPage";
import DebtsPage from "@/pages/debts/DebtsPage";
import ExpensesPage from "@/pages/expenses/ExpensesPage";
import CashRegisterPage from "@/pages/cash-register/CashRegisterPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import AssistantPage from "@/pages/assistant/AssistantPage";
import BackupPage from "@/pages/backup/BackupPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Phase 2: Supplier & Milk Purchase module */}
            <Route path="/suppliers" element={<SuppliersListPage />} />
            <Route path="/suppliers/new" element={<SupplierFormPage />} />
            <Route path="/suppliers/:id" element={<SupplierProfilePage />} />
            <Route path="/suppliers/:id/edit" element={<SupplierFormPage />} />
            <Route path="/milk-purchases" element={<MilkPurchasePage />} />
            <Route path="/purchase-invoices" element={<PurchaseInvoicesPage />} />
            <Route path="/purchase-invoices/:id" element={<PurchaseInvoiceViewPage />} />

            {/* Phase 4: Products, Inventory & Production module */}
            <Route path="/products" element={<ProductsListPage />} />
            <Route path="/products/new" element={<ProductFormPage />} />
            <Route path="/products/:id/edit" element={<ProductFormPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/production" element={<ProductionPage />} />

            {/* Phase 5: Sales, Customers, Invoices & Debts module */}
            <Route path="/customers" element={<CustomersListPage />} />
            <Route path="/customers/new" element={<CustomerFormPage />} />
            <Route path="/customers/:id" element={<CustomerProfilePage />} />
            <Route path="/customers/:id/edit" element={<CustomerFormPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/sales/:id" element={<InvoiceViewPage />} />
            <Route path="/debts" element={<DebtsPage />} />

            {/* Phase 6: Financial System (Expenses, Cash Register, Profit) */}
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/cash-register" element={<CashRegisterPage />} />

            {/* Phase 7: Reports & Analytics */}
            <Route path="/reports" element={<ReportsPage />} />

            {/* Phase 8: AI Assistant */}
            <Route path="/assistant" element={<AssistantPage />} />

            {/* Phase 9: Backup & Deployment */}
            <Route path="/backup" element={<BackupPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
