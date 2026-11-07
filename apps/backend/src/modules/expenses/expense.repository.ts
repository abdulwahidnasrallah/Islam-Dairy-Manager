import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

export const expenseRepository = {
  findMany(category?: string) {
    return prisma.expense.findMany({
      where: category ? { category } : undefined,
      orderBy: { date: "desc" },
    });
  },

  findById(id: string) {
    return prisma.expense.findUnique({ where: { id } });
  },

  create(data: Prisma.ExpenseCreateInput) {
    return prisma.expense.create({ data });
  },

  update(id: string, data: Prisma.ExpenseUpdateInput) {
    return prisma.expense.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.expense.delete({ where: { id } });
  },

  /** Sum of all expenses in a date range — used by the cash register and profit summary. */
  async getTotal(from?: Date, to?: Date) {
    const agg = await prisma.expense.aggregate({
      where: from || to ? { date: { gte: from, lte: to } } : undefined,
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  },
};
