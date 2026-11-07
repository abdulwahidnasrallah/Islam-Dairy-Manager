/**
 * Minimal CSV serializer — deliberately dependency-free. Values are
 * quoted only when they contain a comma, quote, or newline, and
 * embedded quotes are doubled per RFC 4180.
 */
export function toCsv(rows: Record<string, string | number>[], headers: { key: string; label: string }[]): string {
  const escape = (value: string | number) => {
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const headerLine = headers.map((h) => escape(h.label)).join(",");
  const lines = rows.map((row) => headers.map((h) => escape(row[h.key] ?? "")).join(","));

  // Leading BOM so Excel opens Arabic text as UTF-8 instead of mangling it.
  return "\uFEFF" + [headerLine, ...lines].join("\r\n");
}
