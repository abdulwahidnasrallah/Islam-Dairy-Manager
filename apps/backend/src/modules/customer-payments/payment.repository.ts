import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

export const customerPaymentRepository = {
  findMany(customerId?: string) {
    return prisma.customerPayment.findMany({
      where: customerId ? { customerId } : undefined,
      orderBy: { date: "desc" },
    });
  },

  create(data: Prisma.CustomerPaymentCreateInput) {
    return prisma.customerPayment.create({ data });
  },
};
