/**
 * Single source of truth for permission names, shared between the
 * backend (authorize() middleware) and the database seed script.
 * A typo here becomes a compile error, not a silent authorization bypass.
 */
export const PERMISSIONS = {
  VIEW_SUPPLIERS: "view_suppliers",
  CREATE_SUPPLIER: "create_supplier",
  EDIT_SUPPLIER: "edit_supplier",
  DELETE_SUPPLIER: "delete_supplier",
  RECORD_MILK_PURCHASE: "record_milk_purchase",
  RECORD_SUPPLIER_PAYMENT: "record_supplier_payment",
  MANAGE_USERS: "manage_users",

  // Phase 4 — Products, Inventory & Production
  VIEW_PRODUCTS: "view_products",
  CREATE_PRODUCT: "create_product",
  EDIT_PRODUCT: "edit_product",
  DELETE_PRODUCT: "delete_product",
  VIEW_INVENTORY: "view_inventory",
  ADJUST_INVENTORY: "adjust_inventory",
  VIEW_PRODUCTION: "view_production",
  RECORD_PRODUCTION: "record_production",

  // Phase 5 — Sales, Customers, Invoices & Debts
  VIEW_CUSTOMERS: "view_customers",
  CREATE_CUSTOMER: "create_customer",
  EDIT_CUSTOMER: "edit_customer",
  DELETE_CUSTOMER: "delete_customer",
  VIEW_SALES: "view_sales",
  RECORD_SALE: "record_sale",
  RECORD_CUSTOMER_PAYMENT: "record_customer_payment",

  // Phase 6 — Financial System (Expenses, Cash Register, Profit)
  VIEW_EXPENSES: "view_expenses",
  CREATE_EXPENSE: "create_expense",
  EDIT_EXPENSE: "edit_expense",
  DELETE_EXPENSE: "delete_expense",
  VIEW_CASH_REGISTER: "view_cash_register",
  RECORD_CASH_ADJUSTMENT: "record_cash_adjustment",

  // Phase 7 — Reports & Analytics
  VIEW_REPORTS: "view_reports",

  // Phase 8 — AI Assistant
  USE_AI_ASSISTANT: "use_ai_assistant",

  // Phase 9 — Backup & Deployment
  VIEW_BACKUPS: "view_backups",
  CREATE_BACKUP: "create_backup",
  RESTORE_BACKUP: "restore_backup",
  DELETE_BACKUP: "delete_backup",

  // Final Polish — Dashboard, Settings, Invoice cancellation, Daily Closing, Search
  VIEW_DASHBOARD: "view_dashboard",
  VIEW_SETTINGS: "view_settings",
  MANAGE_SETTINGS: "manage_settings",
  CANCEL_SALE: "cancel_sale",
  CLOSE_DAY: "close_day",
  USE_SEARCH: "use_search",

  // Data Cleanup — wiping operational/demo data to start fresh
  MANAGE_DATA: "manage_data",

  // Supplier Purchase Invoices — buying tracked Products from suppliers
  VIEW_PURCHASE_INVOICES: "view_purchase_invoices",
  CREATE_PURCHASE_INVOICE: "create_purchase_invoice",
  CANCEL_PURCHASE_INVOICE: "cancel_purchase_invoice",
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionName[] = Object.values(PERMISSIONS);
