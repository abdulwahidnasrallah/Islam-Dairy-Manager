/**
 * @idm/shared-types
 *
 * Foundation-phase shared types only.
 * Business-domain types (Product, Invoice, Supplier, ...) will be added
 * module-by-module in later phases, once the corresponding Prisma models exist.
 */

export * from "./permissions";

/** Standard success envelope returned by every backend API. */
export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
}

/** Standard error envelope returned by every backend API. */
export interface ApiError {
  success: false;
  message: string;
  errorCode: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Minimal authenticated user shape shared between frontend and backend. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  fullName: string;
  roleName: string;
}

/** Application health/info payload returned by GET /api/health. */
export interface HealthStatus {
  status: "running" | "degraded";
  application: string;
  version: string;
  databaseConnected: boolean;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════
// PHASE 2 — Supplier & Milk Purchase Module
// ═══════════════════════════════════════════════════════════════

export type PaymentMethod = "CASH" | "BANK" | "OTHER";

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Supplier + derived financial summary, used by the list and profile pages. */
export interface SupplierWithBalance extends Supplier {
  totalPurchases: number;
  totalPaid: number;
  balance: number;
}

export interface MilkPurchase {
  id: string;
  supplierId: string;
  date: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  notes: string | null;
  /** Set when the payment settles a specific purchase invoice; null for a general payment. */
  purchaseInvoiceId: string | null;
  createdAt: string;
}

export interface SupplierProfile {
  supplier: Supplier;
  totalPurchases: number;
  totalPaid: number;
  balance: number;
  purchases: MilkPurchase[];
  payments: SupplierPayment[];
  /** Purchase invoices for tracked Products — separate from `purchases` (raw milk deliveries), see PurchaseInvoice. */
  purchaseInvoices: PurchaseInvoice[];
}

// ═══════════════════════════════════════════════════════════════
// PHASE 4 — Products, Inventory & Production
// ═══════════════════════════════════════════════════════════════

export type ProductUnit = "KG" | "LITER" | "PIECE";
export type InventoryMovementType = "IN" | "OUT";
export type InventoryMovementReason =
  | "PRODUCTION"
  | "ADJUSTMENT"
  | "DAMAGE"
  | "RETURN"
  | "OTHER"
  // Written automatically by the sales / purchase-invoice modules — never
  // selectable in the manual adjustment form (see createInventoryMovementSchema).
  | "SALE"
  | "PURCHASE"
  | "PURCHASE_CANCELLED";

export interface Product {
  id: string;
  name: string;
  unit: ProductUnit;
  sellingPrice: number;
  costPrice: number | null;
  minStockAlert: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Product + derived current stock, used by the list/inventory pages. */
export interface ProductWithStock extends Product {
  currentStock: number;
  isLowStock: boolean;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  type: InventoryMovementType;
  reason: InventoryMovementReason;
  quantity: number;
  date: string;
  notes: string | null;
  createdAt: string;
}

export interface ProductionBatch {
  id: string;
  productId: string;
  date: string;
  quantityProduced: number;
  milkConsumed: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════════════════════════
// PHASE 5 — Sales, Customers, Invoices & Debts
// ═══════════════════════════════════════════════════════════════

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Customer + derived financial summary, used by the list, debts, and profile pages. */
export interface CustomerWithBalance extends Customer {
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  /** Snapshot of the product's cost at the moment this item was sold — used for accurate profit reporting. */
  unitCost: number | null;
  totalPrice: number;
}

export type InvoiceStatus = "CONFIRMED" | "CANCELLED";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName?: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InvoiceStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
}

/** Full invoice detail for the print/view page — includes store info so the invoice is self-contained. */
export interface InvoiceDetail extends Invoice {
  storeName: string;
  storePhone: string | null;
  storeAddress: string | null;
  currency: string;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  notes: string | null;
  createdAt: string;
}

export interface CustomerProfile {
  customer: Customer;
  totalInvoiced: number;
  totalPaid: number;
  balance: number;
  invoices: Invoice[];
  payments: CustomerPayment[];
}

// ═══════════════════════════════════════════════════════════════
// PHASE 6 — Financial System (Expenses, Cash Register, Profit)
// ═══════════════════════════════════════════════════════════════

export type ExpenseCategory =
  | "RENT"
  | "SALARIES"
  | "UTILITIES"
  | "TRANSPORT"
  | "MAINTENANCE"
  | "OTHER";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CashAdjustmentType = "IN" | "OUT";

export interface CashAdjustment {
  id: string;
  type: CashAdjustmentType;
  amount: number;
  date: string;
  reason: string;
  notes: string | null;
  createdAt: string;
}

/** A single row in the unified cash-register ledger view, merged from
 * multiple source tables (sales, purchases, payments, expenses, manual
 * adjustments) and sorted by date — the source tables remain the single
 * source of truth; this is a read-only projection. */
export interface CashMovement {
  date: string;
  type: CashAdjustmentType;
  source: string;
  description: string;
  amount: number;
}

export interface CashRegisterSummary {
  balance: number;
  totalIn: number;
  totalOut: number;
  movements: CashMovement[];
}

export interface ProfitSummary {
  periodLabel: string;
  totalSalesRevenue: number;
  /** Cost of goods actually sold (sum of unitCost × quantity across confirmed invoice items) — what "estimatedProfit" is based on. */
  totalCOGS: number;
  /** Informational only: total spent buying raw milk in the period, independent of what was sold. */
  totalMilkPurchaseCost: number;
  totalExpenses: number;
  estimatedProfit: number;
  /** Count of sold line items that had no cost recorded — their cost contributes 0 to totalCOGS, so a high count means the profit figure understates true cost. */
  itemsWithoutCost: number;
}

// ═══════════════════════════════════════════════════════════════
// PHASE 7 — Reports & Analytics
// ═══════════════════════════════════════════════════════════════

export interface ReportDailyPoint {
  date: string;
  amount: number;
}

export interface ReportTopProduct {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface ReportTopSupplier {
  supplierId: string;
  supplierName: string;
  totalQuantity: number;
  totalCost: number;
}

export interface ReportTopDebtCustomer {
  customerId: string;
  customerName: string;
  balance: number;
}

export interface SalesReport {
  from: string;
  to: string;
  invoiceCount: number;
  totalRevenue: number;
  totalPaid: number;
  totalRemaining: number;
  dailyRevenue: ReportDailyPoint[];
  topProducts: ReportTopProduct[];
}

export interface PurchasesReport {
  from: string;
  to: string;
  /** Milk purchases only — unchanged meaning, kept exactly as before. */
  purchaseCount: number;
  totalQuantity: number;
  totalCost: number;
  totalPaid: number;
  /** Purchase invoices only (tracked Products bought from suppliers). */
  purchaseInvoiceCount: number;
  totalPurchaseInvoiceCost: number;
  totalPurchaseInvoicePaid: number;
  /** Milk purchases + purchase invoices combined — "إجمالي مشتريات الفترة" / "المدفوع للموردين". */
  totalCombinedCost: number;
  totalCombinedPaid: number;
  /** Combined ranking across both milk purchases and purchase invoices. */
  topSuppliers: ReportTopSupplier[];
}

export interface ProfitReport {
  from: string;
  to: string;
  totalSalesRevenue: number;
  /** Cost of goods actually sold (sum of unitCost × quantity across confirmed invoice items) — what "estimatedProfit" is based on. */
  totalCOGS: number;
  /** Informational only: total spent buying raw milk in the period, independent of what was sold. */
  totalMilkPurchaseCost: number;
  totalExpenses: number;
  estimatedProfit: number;
  /** Count of sold line items that had no cost recorded — their cost contributes 0 to totalCOGS. */
  itemsWithoutCost: number;
}

export interface ReportsSummary {
  sales: SalesReport;
  purchases: PurchasesReport;
  profit: ProfitReport;
  topDebtCustomers: ReportTopDebtCustomer[];
}

// ═══════════════════════════════════════════════════════════════
// PHASE 8 — AI Assistant
// ═══════════════════════════════════════════════════════════════

export type AssistantMessageRole = "USER" | "ASSISTANT";

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: AssistantMessageRole;
  content: string;
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantConversationWithMessages extends AssistantConversation {
  messages: AssistantMessage[];
}

// ═══════════════════════════════════════════════════════════════
// PHASE 9 — Backup & Deployment
// ═══════════════════════════════════════════════════════════════

export interface BackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}


// ═══════════════════════════════════════════════════════════════
// FINAL POLISH — Settings, Dashboard, Daily Closing, Smart Search
// ═══════════════════════════════════════════════════════════════

/** Known application settings keys — the single source of truth shared by the backend and the settings form. */
export const SETTINGS_KEYS = {
  STORE_NAME_AR: "STORE_NAME_AR",
  STORE_PHONE: "STORE_PHONE",
  STORE_ADDRESS: "STORE_ADDRESS",
  CURRENCY: "CURRENCY",
  INVOICE_PREFIX: "INVOICE_PREFIX",
  INVOICE_FOOTER_NOTE: "INVOICE_FOOTER_NOTE",
  DEFAULT_MIN_STOCK_ALERT: "DEFAULT_MIN_STOCK_ALERT",
  LOW_STOCK_ALERTS_ENABLED: "LOW_STOCK_ALERTS_ENABLED",
  DEBT_ALERT_THRESHOLD: "DEBT_ALERT_THRESHOLD",
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

/** Typed, defaulted view of all settings — what the frontend actually consumes. */
export interface AppSettings {
  STORE_NAME_AR: string;
  STORE_PHONE: string;
  STORE_ADDRESS: string;
  CURRENCY: string;
  INVOICE_PREFIX: string;
  INVOICE_FOOTER_NOTE: string;
  DEFAULT_MIN_STOCK_ALERT: number;
  LOW_STOCK_ALERTS_ENABLED: boolean;
  DEBT_ALERT_THRESHOLD: number;
}

export interface DashboardTodaySales {
  invoiceCount: number;
  cashSalesTotal: number;
  debtSalesTotal: number;
  totalRevenue: number;
}

export interface DashboardSummary {
  /** ISO timestamp "today" is measured from — either midnight or the last daily closing, whichever is later. */
  todaySince: string;
  todaySalesRevenue: number;
  todayProfit: number;
  cashBalance: number;
  totalCustomerDebt: number;
  totalSupplierDebt: number;
  inventoryValue: number;
  lowStockCount: number;
  todaySalesSummary: DashboardTodaySales;
  isDayClosedToday: boolean;
}

export interface DailyClosing {
  id: string;
  businessDate: string;
  closedAt: string;
  closedByUserId: string | null;
  totalSales: number;
  totalProfit: number;
  cashBalanceAtClose: number;
  notes: string | null;
}

export type SearchResultType =
  | "customer"
  | "supplier"
  | "product"
  | "invoice"
  | "milk_purchase"
  | "purchase_invoice";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  link: string;
}

// ═══════════════════════════════════════════════════════════════
// Data Cleanup — wiping operational/demo data to start fresh
// ═══════════════════════════════════════════════════════════════

/** Number of rows deleted per table, keyed by table name — shown to the admin as a receipt after cleanup. */
export interface DataCleanupResult {
  deletedCounts: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// Supplier Purchase Invoices — buying tracked Products from suppliers
// ═══════════════════════════════════════════════════════════════

export type PurchaseInvoiceStatus = "CONFIRMED" | "CANCELLED";

/** Derived from paid vs. total (never stored): UNPAID / PARTIAL / PAID. */
export type PurchaseInvoicePaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface PurchaseInvoiceItem {
  id: string;
  purchaseInvoiceId: string;
  productId: string;
  productName?: string;
  /** Display-only, derived from the product's own unit (KG/LITER/PIECE) — not a separately stored column. */
  productUnit?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PurchaseInvoice {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  supplierName?: string;
  date: string;
  totalAmount: number;
  paidAmount: number;
  /** The part of paidAmount paid when the invoice was created (later payments excluded). */
  initialPaidAmount: number;
  remainingAmount: number;
  paymentMethod: PaymentMethod;
  status: PurchaseInvoiceStatus;
  /** UNPAID / PARTIAL / PAID — follows paidAmount automatically. */
  paymentStatus: PurchaseInvoicePaymentStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseInvoiceItem[];
  /** Payments recorded against this invoice after it was created (oldest first). */
  payments?: SupplierPayment[];
}

/** Full purchase invoice detail for the print/view page — includes store info so the invoice is self-contained, same idea as InvoiceDetail. */
export interface PurchaseInvoiceDetail extends PurchaseInvoice {
  storeName: string;
  storePhone: string | null;
  storeAddress: string | null;
  currency: string;
}

/** The supplier "statement of account" (كشف حساب) — purchase invoices + payments + running totals, for the supplier profile page's print button. */
export interface SupplierStatement {
  supplier: Supplier;
  totalPurchases: number;
  totalPaid: number;
  balance: number;
  purchaseInvoices: PurchaseInvoice[];
  milkPurchases: MilkPurchase[];
  payments: SupplierPayment[];
  storeName: string;
  currency: string;
}
