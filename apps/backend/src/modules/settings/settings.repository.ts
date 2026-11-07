import { prisma } from "../../config/prisma";

export const settingsRepository = {
  findAll() {
    return prisma.applicationSettings.findMany();
  },

  async upsertMany(entries: Array<{ key: string; value: string }>): Promise<void> {
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.applicationSettings.upsert({
          where: { key: entry.key },
          update: { value: entry.value },
          create: { key: entry.key, value: entry.value },
        }),
      ),
    );
  },
};
