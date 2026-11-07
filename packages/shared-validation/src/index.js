"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPurchaseInvoiceSchema = exports.purchaseInvoiceItemInputSchema = exports.cleanupOperationalDataSchema = exports.updateSettingsSchema = exports.assistantChatSchema = exports.createCashAdjustmentSchema = exports.updateExpenseSchema = exports.createExpenseSchema = exports.createCustomerPaymentSchema = exports.createInvoiceSchema = exports.invoiceItemInputSchema = exports.updateCustomerSchema = exports.createCustomerSchema = exports.createProductionBatchSchema = exports.createInventoryAdjustmentSchema = exports.updateProductSchema = exports.createProductSchema = exports.createSupplierPaymentSchema = exports.createMilkPurchaseSchema = exports.updateSupplierSchema = exports.createSupplierSchema = exports.loginSchema = exports.envSchema = void 0;
const zod_1 = require("zod");
/**
 * Foundation-phase validation schemas only.
 * Business schemas (createSupplierSchema, createInvoiceSchema, ...) are added
 * alongside each business module in later phases.
 */
exports.envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"),
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    DATABASE_URL: zod_1.z.string().min(1, "DATABASE_URL is required"),
    SESSION_SECRET: zod_1.z.string().min(16, "SESSION_SECRET must be at least 16 characters"),
    APP_VERSION: zod_1.z.string().default("0.1.0"),
    // Optional: only required to use the AI Assistant module (Phase 8). The
    // rest of the app works fully without it — the assistant module simply
    // returns a clear "not configured" error if it's missing.
    ANTHROPIC_API_KEY: zod_1.z.string().optional(),
    ASSISTANT_MODEL: zod_1.z.string().default("claude-sonnet-5"),
});
exports.loginSchema = zod_1.z.object({
    username: zod_1.z.string().min(1, "اسم المستخدم مطلوب"),
    password: zod_1.z.string().min(1, "كلمة المرور مطلوبة"),
});
// ═══════════════════════════════════════════════════════════════
// PHASE 2 — Supplier & Milk Purchase Module
// ═══════════════════════════════════════════════════════════════
exports.createSupplierSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, "اسم المورد مطلوب"),
    phone: zod_1.z.string().trim().optional().nullable(),
    address: zod_1.z.string().trim().optional().nullable(),
    notes: zod_1.z.string().trim().optional().nullable(),
});
exports.updateSupplierSchema = exports.createSupplierSchema.partial();
exports.createMilkPurchaseSchema = zod_1.z.object({
    supplierId: zod_1.z.string().min(1, "المورد مطلوب"),
    date: zod_1.z.coerce.date(),
    quantity: zod_1.z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
    pricePerUnit: zod_1.z.coerce.number().positive("السعر يجب أن يكون أكبر من صفر"),
    paidAmount: zod_1.z.coerce.number().min(0, "المبلغ المدفوع لا يمكن أن يكون سالباً").default(0),
    notes: zod_1.z.string().trim().optional().nullable(),
});
exports.createSupplierPaymentSchema = zod_1.z.object({
    supplierId: zod_1.z.string().min(1, "المورد مطلوب"),
    purchaseInvoiceId: zod_1.z.string().min(1).optional().nullable(),
    amount: zod_1.z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
    date: zod_1.z.coerce.date(),
    method: zod_1.z.enum(["CASH", "BANK", "OTHER"]).default("CASH"),
    notes: zod_1.z.string().trim().optional().nullable(),
});
// ═══════════════════════════════════════════════════════════════
// PHASE 4 — Products, Inventory & Production
// ═══════════════════════════════════════════════════════════════
exports.createProductSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, "اسم المنتج مطلوب"),
    unit: zod_1.z.enum(["KG", "LITER", "PIECE"]),
    sellingPrice: zod_1.z.coerce.number().positive("سعر البيع يجب أن يكون أكبر من صفر"),
    costPrice: zod_1.z.coerce.number().min(0).optional().nullable(),
    minStockAlert: zod_1.z.coerce.number().min(0, "حد التنبيه لا يمكن أن يكون سالباً").default(0),
    isActive: zod_1.z.boolean().default(true),
    notes: zod_1.z.string().trim().optional().nullable(),
});
exports.updateProductSchema = exports.createProductSchema.partial();
exports.createInventoryAdjustmentSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "المنتج مطلوب"),
    type: zod_1.z.enum(["IN", "OUT"]),
    quantity: zod_1.z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
    date: zod_1.z.coerce.date(),
    reason: zod_1.z.enum(["ADJUSTMENT", "DAMAGE", "RETURN", "OTHER"]).default("ADJUSTMENT"),
    notes: zod_1.z.string().trim().optional().nullable(),
});
exports.createProductionBatchSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "المنتج مطلوب"),
    date: zod_1.z.coerce.date(),
    quantityProduced: zod_1.z.coerce.number().positive("الكمية المنتَجة يجب أن تكون أكبر من صفر"),
    milkConsumed: zod_1.z.coerce.number().min(0).optional().nullable(),
    notes: zod_1.z.string().trim().optional().nullable(),
});
// ═══════════════════════════════════════════════════════════════
// PHASE 5 — Sales, Customers, Invoices & Debts
// ═══════════════════════════════════════════════════════════════
exports.createCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, "اسم الزبون مطلوب"),
    phone: zod_1.z.string().trim().optional().nullable(),
    address: zod_1.z.string().trim().optional().nullable(),
    notes: zod_1.z.string().trim().optional().nullable(),
});
exports.updateCustomerSchema = exports.createCustomerSchema.partial();
exports.invoiceItemInputSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "المنتج مطلوب"),
    quantity: zod_1.z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
    unitPrice: zod_1.z.coerce.number().positive("سعر الوحدة يجب أن يكون أكبر من صفر"),
});
exports.createInvoiceSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1, "الزبون مطلوب"),
    date: zod_1.z.coerce.date(),
    items: zod_1.z.array(exports.invoiceItemInputSchema).min(1, "يجب إضافة صنف واحد على الأقل"),
    paidAmount: zod_1.z.coerce.number().min(0, "المبلغ المدفوع لا يمكن أن يكون سالباً").default(0),
    notes: zod_1.z.string().trim().optional().nullable(),
});
exports.createCustomerPaymentSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1, "الزبون مطلوب"),
    amount: zod_1.z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
    date: zod_1.z.coerce.date(),
    method: zod_1.z.enum(["CASH", "BANK", "OTHER"]).default("CASH"),
    notes: zod_1.z.string().trim().optional().nullable(),
});
// ═══════════════════════════════════════════════════════════════
// PHASE 6 — Financial System (Expenses, Cash Register, Profit)
// ═══════════════════════════════════════════════════════════════
exports.createExpenseSchema = zod_1.z.object({
    category: zod_1.z.enum(["RENT", "SALARIES", "UTILITIES", "TRANSPORT", "MAINTENANCE", "OTHER"]),
    amount: zod_1.z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
    date: zod_1.z.coerce.date(),
    notes: zod_1.z.string().trim().optional().nullable(),
});
exports.updateExpenseSchema = exports.createExpenseSchema.partial();
exports.createCashAdjustmentSchema = zod_1.z.object({
    type: zod_1.z.enum(["IN", "OUT"]),
    amount: zod_1.z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
    date: zod_1.z.coerce.date(),
    reason: zod_1.z.string().trim().min(1, "السبب مطلوب"),
    notes: zod_1.z.string().trim().optional().nullable(),
});
// ═══════════════════════════════════════════════════════════════
// PHASE 8 — AI Assistant
// ═══════════════════════════════════════════════════════════════
exports.assistantChatSchema = zod_1.z.object({
    conversationId: zod_1.z.string().optional().nullable(),
    message: zod_1.z.string().trim().min(1, "الرسالة مطلوبة").max(4000, "الرسالة طويلة جداً"),
});
// ═══════════════════════════════════════════════════════════════
// FINAL POLISH — Settings
// ═══════════════════════════════════════════════════════════════
exports.updateSettingsSchema = zod_1.z.object({
    STORE_NAME_AR: zod_1.z.string().trim().min(1, "اسم المتجر مطلوب").optional(),
    STORE_PHONE: zod_1.z.string().trim().optional(),
    STORE_ADDRESS: zod_1.z.string().trim().optional(),
    CURRENCY: zod_1.z.string().trim().min(1).optional(),
    INVOICE_PREFIX: zod_1.z.string().trim().min(1, "بادئة رقم الفاتورة مطلوبة").optional(),
    INVOICE_FOOTER_NOTE: zod_1.z.string().trim().optional(),
    DEFAULT_MIN_STOCK_ALERT: zod_1.z.coerce.number().min(0).optional(),
    LOW_STOCK_ALERTS_ENABLED: zod_1.z.boolean().optional(),
    DEBT_ALERT_THRESHOLD: zod_1.z.coerce.number().min(0).optional(),
});
// ═══════════════════════════════════════════════════════════════
// Data Cleanup — wiping operational/demo data to start fresh
// ═══════════════════════════════════════════════════════════════
exports.cleanupOperationalDataSchema = zod_1.z
    .object({
    confirmation: zod_1.z.string().min(1, "التأكيد مطلوب"),
    password: zod_1.z.string().min(1, "كلمة المرور مطلوبة للتأكيد"),
})
    .refine((data) => data.confirmation === "DELETE", {
    message: "يجب كتابة DELETE بالضبط لتأكيد العملية",
    path: ["confirmation"],
});
// ═══════════════════════════════════════════════════════════════
// Supplier Purchase Invoices — buying tracked Products from suppliers
// ═══════════════════════════════════════════════════════════════
exports.purchaseInvoiceItemInputSchema = zod_1.z.object({
    productId: zod_1.z.string().min(1, "المنتج مطلوب"),
    quantity: zod_1.z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر"),
    unitPrice: zod_1.z.coerce.number().positive("سعر الوحدة يجب أن يكون أكبر من صفر"),
});
exports.createPurchaseInvoiceSchema = zod_1.z.object({
    supplierId: zod_1.z.string().min(1, "المورد مطلوب"),
    date: zod_1.z.coerce.date(),
    items: zod_1.z.array(exports.purchaseInvoiceItemInputSchema).min(1, "يجب إضافة صنف واحد على الأقل"),
    paidAmount: zod_1.z.coerce.number().min(0, "المبلغ المدفوع لا يمكن أن يكون سالباً").default(0),
    paymentMethod: zod_1.z.enum(["CASH", "BANK", "OTHER"]).default("CASH"),
    notes: zod_1.z.string().trim().optional().nullable(),
});
//# sourceMappingURL=index.js.map