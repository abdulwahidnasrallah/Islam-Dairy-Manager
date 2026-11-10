/**
 * @idm/shared-utils
 * Small, dependency-free helpers usable from both frontend and backend.
 */

/** Formats a number as currency for display in the Arabic UI. */
export function formatCurrency(amount: number, currency = "USD"): string {
  if (/^[A-Z]{3}$/.test(currency)) {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  }

  // Settings may contain a custom display label (for example "ل .س"),
  // which is not valid as an Intl currency code.
  return `${new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} ${currency}`;
}

/** Formats a date using the Gregorian calendar with Arabic month/day names. */
export function formatArabicDate(date: Date): string {
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Converts Western digits (0-9) to Arabic-Indic digits (٠-٩) for display. */
export function toArabicDigits(value: string | number): string {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(value).replace(/[0-9]/g, (d) => arabicDigits[Number(d)] ?? d);
}

export * from "./accounting";
