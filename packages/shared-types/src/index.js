"use strict";
/**
 * @idm/shared-types
 *
 * Foundation-phase shared types only.
 * Business-domain types (Product, Invoice, Supplier, ...) will be added
 * module-by-module in later phases, once the corresponding Prisma models exist.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SETTINGS_KEYS = void 0;
__exportStar(require("./permissions"), exports);
// ═══════════════════════════════════════════════════════════════
// FINAL POLISH — Settings, Dashboard, Daily Closing, Smart Search
// ═══════════════════════════════════════════════════════════════
/** Known application settings keys — the single source of truth shared by the backend and the settings form. */
exports.SETTINGS_KEYS = {
    STORE_NAME_AR: "STORE_NAME_AR",
    STORE_PHONE: "STORE_PHONE",
    STORE_ADDRESS: "STORE_ADDRESS",
    CURRENCY: "CURRENCY",
    INVOICE_PREFIX: "INVOICE_PREFIX",
    INVOICE_FOOTER_NOTE: "INVOICE_FOOTER_NOTE",
    DEFAULT_MIN_STOCK_ALERT: "DEFAULT_MIN_STOCK_ALERT",
    LOW_STOCK_ALERTS_ENABLED: "LOW_STOCK_ALERTS_ENABLED",
    DEBT_ALERT_THRESHOLD: "DEBT_ALERT_THRESHOLD",
};
//# sourceMappingURL=index.js.map