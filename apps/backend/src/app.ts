import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { securityHeaders, corsPolicy } from "./config/security";
import { logger } from "./config/logger";
import { errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware";
import { healthRouter } from "./modules/health/health.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { supplierRouter } from "./modules/suppliers/supplier.routes";
import { milkPurchaseRouter } from "./modules/milk-purchases/purchase.routes";
import { supplierPaymentRouter } from "./modules/supplier-payments/payment.routes";
import { productRouter } from "./modules/products/product.routes";
import { inventoryRouter } from "./modules/inventory/inventory.routes";
import { productionRouter } from "./modules/production/production.routes";
import { customerRouter } from "./modules/customers/customer.routes";
import { salesRouter } from "./modules/sales/sales.routes";
import { customerPaymentRouter } from "./modules/customer-payments/payment.routes";
import { expenseRouter } from "./modules/expenses/expense.routes";
import { cashRegisterRouter } from "./modules/cash-register/cash-register.routes";
import { reportsRouter } from "./modules/reports/reports.routes";
import { assistantRouter } from "./modules/assistant/assistant.routes";
import { backupRouter } from "./modules/backup/backup.routes";
import { settingsRouter } from "./modules/settings/settings.routes";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes";
import { dailyClosingRouter } from "./modules/daily-closing/daily-closing.routes";
import { searchRouter } from "./modules/search/search.routes";
import { dataCleanupRouter } from "./modules/data-cleanup/data-cleanup.routes";
import { purchaseInvoiceRouter } from "./modules/purchase-invoices/purchase-invoice.routes";

export function createApp(): Express {
  const app = express();

  app.use(securityHeaders);
  app.use(corsPolicy);
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  // ── Routes ──────────────────────────────────────────────
  // Foundation phase: health check.
  app.use("/api/health", healthRouter);

  // Phase 3: Security (login/logout/me).
  app.use("/api/auth", authRouter);

  // Phase 2: Supplier & Milk Purchase module (now behind authentication).
  app.use("/api/suppliers", supplierRouter);
  app.use("/api/milk-purchases", milkPurchaseRouter);
  app.use("/api/supplier-payments", supplierPaymentRouter);

  // Phase 4: Products, Inventory & Production.
  app.use("/api/products", productRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/production", productionRouter);

  // Phase 5: Sales, Customers, Invoices & Debts.
  app.use("/api/customers", customerRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/customer-payments", customerPaymentRouter);

  // Phase 6: Financial System (Expenses, Cash Register, Profit).
  app.use("/api/expenses", expenseRouter);
  app.use("/api/cash-register", cashRegisterRouter);

  // Phase 7: Reports & Analytics.
  app.use("/api/reports", reportsRouter);

  // Phase 8: AI Assistant.
  app.use("/api/assistant", assistantRouter);

  // Phase 9: Backup & Deployment.
  app.use("/api/backup", backupRouter);

  // Final Polish: Settings, Dashboard, Daily Closing, Smart Search.
  app.use("/api/settings", settingsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/daily-closing", dailyClosingRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/data-management", dataCleanupRouter);

  // Supplier Purchase Invoices — buying tracked Products from suppliers.
  app.use("/api/purchase-invoices", purchaseInvoiceRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
