"use strict";
/**
 * @idm/shared-utils
 * Small, dependency-free helpers usable from both frontend and backend.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatCurrency = formatCurrency;
exports.formatArabicDate = formatArabicDate;
exports.toArabicDigits = toArabicDigits;
/** Formats a number as currency for display in the Arabic UI. */
function formatCurrency(amount, currency = "USD") {
    return new Intl.NumberFormat("ar-EG", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
    }).format(amount);
}
/** Formats a date using the Gregorian calendar with Arabic month/day names. */
function formatArabicDate(date) {
    return new Intl.DateTimeFormat("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
    }).format(date);
}
/** Converts Western digits (0-9) to Arabic-Indic digits (٠-٩) for display. */
function toArabicDigits(value) {
    const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
    return String(value).replace(/[0-9]/g, (d) => arabicDigits[Number(d)] ?? d);
}
//# sourceMappingURL=index.js.map