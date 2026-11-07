import { searchRepository } from "./search.repository";
import { formatCurrency } from "@idm/shared-utils";
import type { SearchResult } from "@idm/shared-types";

const MIN_QUERY_LENGTH = 2;

export const searchService = {
  async search(query: string): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return [];

    const [customers, suppliers, products, invoices, milkPurchases, purchaseInvoices] = await Promise.all([
      searchRepository.searchCustomers(trimmed),
      searchRepository.searchSuppliers(trimmed),
      searchRepository.searchProducts(trimmed),
      searchRepository.searchInvoices(trimmed),
      searchRepository.searchMilkPurchases(trimmed),
      searchRepository.searchPurchaseInvoices(trimmed),
    ]);

    const results: SearchResult[] = [
      ...customers.map(
        (c): SearchResult => ({
          type: "customer",
          id: c.id,
          title: c.name,
          subtitle: c.phone ? `زبون — ${c.phone}` : "زبون",
          link: `/customers/${c.id}`,
        }),
      ),
      ...suppliers.map(
        (s): SearchResult => ({
          type: "supplier",
          id: s.id,
          title: s.name,
          subtitle: "مورد",
          link: `/suppliers/${s.id}`,
        }),
      ),
      ...products.map(
        (p): SearchResult => ({
          type: "product",
          id: p.id,
          title: p.name,
          subtitle: `منتج — ${formatCurrency(p.sellingPrice)}`,
          link: `/products/${p.id}/edit`,
        }),
      ),
      ...invoices.map(
        (inv): SearchResult => ({
          type: "invoice",
          id: inv.id,
          title: inv.invoiceNumber,
          subtitle: `فاتورة — ${inv.customer.name} — ${formatCurrency(inv.totalAmount)}`,
          link: `/sales/${inv.id}`,
        }),
      ),
      ...milkPurchases.map(
        (mp): SearchResult => ({
          type: "milk_purchase",
          id: mp.id,
          title: `شراء حليب — ${mp.supplier.name}`,
          subtitle: `${mp.quantity} لتر — ${formatCurrency(mp.totalAmount)}`,
          link: `/milk-purchases`,
        }),
      ),
      ...purchaseInvoices.map(
        (pi): SearchResult => ({
          type: "purchase_invoice",
          id: pi.id,
          title: pi.purchaseNumber,
          subtitle: `فاتورة شراء — ${pi.supplier.name} — ${formatCurrency(pi.totalAmount)}`,
          link: `/purchase-invoices/${pi.id}`,
        }),
      ),
    ];

    return results;
  },
};
