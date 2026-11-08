import { z } from "zod";

/**
 * Foundation-phase validation schemas only.
 * Business schemas (createSupplierSchema, createInvoiceSchema, ...) are added
 * alongside each business module in later phases.
 */

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
  APP_VERSION: z.string().default("0.1.0"),
  // Optional: only required to use the AI Assistant module (Phase 8). The
  // rest of the app works fully without it — the assistant module simply
  // returns a clear "not configured" error if it's missing.
  ANTHROPIC_API_KEY: z.string().optional(),
  ASSISTANT_MODEL: z.string().default("claude-sonnet-5"),
});

export type Env = z.infer<typeof envSchema>;

export const loginSchema = z.object({
  username: z.string().min(1, "اسم المستخدم مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ═══════════════════════════════════════════════════════════════
// PHASE 2 — Supplier & Milk Purchase Module
// ═══════════════════════════════════════════════════════════════

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "اسم المورد مطلوب"),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;

export const updateSupplierSchema = createSupplierSchema.partial();
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const createMilkPurchaseSchema = z.object({
  supplierId: z.string().min(1, "المورد مطلوب"),
  date: z.coerce.date(),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  pricePerUnit: z.coerce.number().positive("السعر يجب أن يكون أكبر من صفر"),
  paidAmount: z.coerce.number().min(0, "المبلغ المدفوع لا يمكن أن يكون سالباً").default(0),
  notes: z.string().trim().optional().nullable(),
});
export type CreateMilkPurchaseInput = z.infer<typeof createMilkPurchaseSchema>;

export const createSupplierPaymentSchema = z.object({
  supplierId: z.string().min(1, "المورد مطلوب"),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  date: z.coerce.date(),
  method: z.enum(["CASH", "BANK", "OTHER"]).default("CASH"),
  notes: z.string().trim().optional().nullable(),
  /** Optional: settle this specific purchase invoice (it must belong to the supplier). */
  purchaseInvoiceId: z.string().min(1).optional().nullable(),
  /** Optional client key so re-sending the same request never records the payment twice. */
  idempotencyKey: z.string().trim().min(8).max(100).optional().nullable(),
});
export type CreateSupplierPaymentInput = z.infer<typeof createSupplierPaymentSchema>;

// ═══════════════════════════════════════════════════════════════
// PHASE 4 — Products, Inventory & Production
// ═══════════════════════════════════════════════════════════════

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "اسم المنتج مطلوب"),
  unit: z.enum(["KG", "LITER", "PIECE"]),
  sellingPrice: z.coerce.number().positive("سعر البيع يجب أن يكون أكبر من صفر"),
  costPrice: z.coerce.number().min(0).optional().nullable(),
  minStockAlert: z.coerce.number().min(0, "حد التنبيه لا يمكن أن يكون سالباً").default(0),
  isActive: z.boolean().default(true),
  notes: z.string().trim().optional().nullable(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const createInventoryAdjustmentSchema = z.object({
  productId: z.string().min(1, "المنتج مطلوب"),
  type: z.enum(["IN", "OUT"]),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  date: z.coerce.date(),
  reason: z.enum(["ADJUSTMENT", "DAMAGE", "RETURN", "OTHER"]).default("ADJUSTMENT"),
  notes: z.string().trim().optional().nullable(),
});
export type CreateInventoryAdjustmentInput = z.infer<typeof createInventoryAdjustmentSchema>;

export const createProductionBatchSchema = z.object({
  productId: z.string().min(1, "المنتج مطلوب"),
  date: z.coerce.date(),
  quantityProduced: z.coerce.number().positive("الكمية المنتَجة يجب أن تكون أكبر من صفر"),
  milkConsumed: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});
export type CreateProductionBatchInput = z.infer<typeof createProductionBatchSchema>;

// ═══════════════════════════════════════════════════════════════
// PHASE 5 — Sales, Customers, Invoices & Debts
// ═══════════════════════════════════════════════════════════════

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "اسم الزبون مطلوب"),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const invoiceItemInputSchema = z.object({
  productId: z.string().min(1, "المنتج مطلوب"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unitPrice: z.coerce.number().positive("سعر الوحدة يجب أن يكون أكبر من صفر"),
});
export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1, "الزبون مطلوب"),
  date: z.coerce.date(),
  items: z.array(invoiceItemInputSchema).min(1, "يجب إضافة صنف واحد على الأقل"),
  paidAmount: z.coerce.number().min(0, "المبلغ المدفوع لا يمكن أن يكون سالباً").default(0),
  notes: z.string().trim().optional().nullable(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const createCustomerPaymentSchema = z.object({
  customerId: z.string().min(1, "الزبون مطلوب"),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  date: z.coerce.date(),
  method: z.enum(["CASH", "BANK", "OTHER"]).default("CASH"),
  notes: z.string().trim().optional().nullable(),
});
export type CreateCustomerPaymentInput = z.infer<typeof createCustomerPaymentSchema>;

// ═══════════════════════════════════════════════════════════════
// PHASE 6 — Financial System (Expenses, Cash Register, Profit)
// ═══════════════════════════════════════════════════════════════

export const createExpenseSchema = z.object({
  category: z.enum(["RENT", "SALARIES", "UTILITIES", "TRANSPORT", "MAINTENANCE", "OTHER"]),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  date: z.coerce.date(),
  notes: z.string().trim().optional().nullable(),
});
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema.partial();
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const createCashAdjustmentSchema = z.object({
  type: z.enum(["IN", "OUT"]),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  date: z.coerce.date(),
  reason: z.string().trim().min(1, "السبب مطلوب"),
  notes: z.string().trim().optional().nullable(),
});
export type CreateCashAdjustmentInput = z.infer<typeof createCashAdjustmentSchema>;

// ═══════════════════════════════════════════════════════════════
// PHASE 8 — AI Assistant
// ═══════════════════════════════════════════════════════════════

export const assistantChatSchema = z.object({
  conversationId: z.string().optional().nullable(),
  message: z.string().trim().min(1, "الرسالة مطلوبة").max(4000, "الرسالة طويلة جداً"),
});
export type AssistantChatInput = z.infer<typeof assistantChatSchema>;

// ═══════════════════════════════════════════════════════════════
// FINAL POLISH — Settings
// ═══════════════════════════════════════════════════════════════

export const updateSettingsSchema = z.object({
  STORE_NAME_AR: z.string().trim().min(1, "اسم المتجر مطلوب").optional(),
  STORE_PHONE: z.string().trim().optional(),
  STORE_ADDRESS: z.string().trim().optional(),
  CURRENCY: z.string().trim().min(1).optional(),
  INVOICE_PREFIX: z.string().trim().min(1, "بادئة رقم الفاتورة مطلوبة").optional(),
  INVOICE_FOOTER_NOTE: z.string().trim().optional(),
  DEFAULT_MIN_STOCK_ALERT: z.coerce.number().min(0).optional(),
  LOW_STOCK_ALERTS_ENABLED: z.boolean().optional(),
  DEBT_ALERT_THRESHOLD: z.coerce.number().min(0).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ═══════════════════════════════════════════════════════════════
// Data Cleanup — wiping operational/demo data to start fresh
// ═══════════════════════════════════════════════════════════════

export const cleanupOperationalDataSchema = z
  .object({
    confirmation: z.string().min(1, "التأكيد مطلوب"),
    password: z.string().min(1, "كلمة المرور مطلوبة للتأكيد"),
  })
  .refine((data) => data.confirmation === "DELETE", {
    message: "يجب كتابة DELETE بالضبط لتأكيد العملية",
    path: ["confirmation"],
  });
export type CleanupOperationalDataInput = z.infer<typeof cleanupOperationalDataSchema>;

// ═══════════════════════════════════════════════════════════════
// Supplier Purchase Invoices — buying tracked Products from suppliers
// ═══════════════════════════════════════════════════════════════

export const purchaseInvoiceItemInputSchema = z.object({
  productId: z.string().min(1, "المنتج مطلوب"),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
  unitPrice: z.coerce.number().positive("سعر الوحدة يجب أن يكون أكبر من صفر"),
});
export type PurchaseInvoiceItemInput = z.infer<typeof purchaseInvoiceItemInputSchema>;

export const createPurchaseInvoiceSchema = z.object({
  supplierId: z.string().min(1, "المورد مطلوب"),
  date: z.coerce.date(),
  items: z.array(purchaseInvoiceItemInputSchema).min(1, "يجب إضافة صنف واحد على الأقل"),
  paidAmount: z.coerce.number().min(0, "المبلغ المدفوع لا يمكن أن يكون سالباً").default(0),
  paymentMethod: z.enum(["CASH", "BANK", "OTHER"]).default("CASH"),
  notes: z.string().trim().optional().nullable(),
  /** Optional client key so re-sending the same request never creates (or re-stocks) a second invoice. */
  idempotencyKey: z.string().trim().min(8).max(100).optional().nullable(),
});
export type CreatePurchaseInvoiceInput = z.infer<typeof createPurchaseInvoiceSchema>;
