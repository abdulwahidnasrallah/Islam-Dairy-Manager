import { prisma } from "../../config/prisma";
import type { Prisma } from "@prisma/client";

export const dailyClosingRepository = {
  findLatestSince(since: Date) {
    return prisma.dailyClosing.findFirst({
      where: { closedAt: { gte: since } },
      orderBy: { closedAt: "desc" },
    });
  },

  list(limit: number) {
    return prisma.dailyClosing.findMany({ orderBy: { closedAt: "desc" }, take: limit });
  },

  create(data: Prisma.DailyClosingCreateInput) {
    return prisma.dailyClosing.create({ data });
  },
};
