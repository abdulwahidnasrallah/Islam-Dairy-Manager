import { prisma } from "../../config/prisma";

const RESULT_LIMIT_PER_TYPE = 5;

export const searchRepository = {
  searchCustomers(query: string) {
    return prisma.customer.findMany({
      where: { OR: [{ name: { contains: query } }, { phone: { contains: query } }] },
      take: RESULT_LIMIT_PER_TYPE,
    });
  },

  searchSuppliers(query: string) {
    return prisma.supplier.findMany({
      where: { name: { contains: query } },
      take: RESULT_LIMIT_PER_TYPE,
    });
  },

  searchProducts(query: string) {
    return prisma.product.findMany({
      where: { name: { contains: query } },
      take: RESULT_LIMIT_PER_TYPE,
    });
  },

  searchInvoices(query: string) {
    return prisma.invoice.findMany({
      where: {
        OR: [{ invoiceNumber: { contains: query } }, { customer: { name: { contains: query } } }],
      },
      include: { customer: { select: { name: true } } },
      take: RESULT_LIMIT_PER_TYPE,
      orderBy: { date: "desc" },
    });
  },

  searchMilkPurchases(query: string) {
    return prisma.milkPurchase.findMany({
      where: { supplier: { name: { contains: query } } },
      include: { supplier: { select: { name: true } } },
      take: RESULT_LIMIT_PER_TYPE,
      orderBy: { date: "desc" },
    });
  },

  searchPurchaseInvoices(query: string) {
    return prisma.purchaseInvoice.findMany({
      where: {
        OR: [{ purchaseNumber: { contains: query } }, { supplier: { name: { contains: query } } }],
      },
      include: { supplier: { select: { name: true } } },
      take: RESULT_LIMIT_PER_TYPE,
      orderBy: { date: "desc" },
    });
  },
};
