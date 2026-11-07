/**
 * Builds apps/desktop/resources/template.db — the database every fresh
 * install starts from. Contains only the essentials (settings,
 * permissions, Administrator role, admin user), never the demo
 * supplier/product/customer data from seed.ts.
 *
 * Run via `pnpm --filter database run build:template` (see
 * database/package.json). Requires migrations to already be applied to
 * a throwaway sqlite file — this script does that itself, so it's
 * self-contained.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { seedEssentials } from "./seed-essentials";

const TEMPLATE_DB_PATH = path.resolve(__dirname, "../../apps/desktop/resources/template.db");

async function main() {
  fs.mkdirSync(path.dirname(TEMPLATE_DB_PATH), { recursive: true });
  if (fs.existsSync(TEMPLATE_DB_PATH)) {
    fs.unlinkSync(TEMPLATE_DB_PATH);
  }

  const databaseUrl = `file:${TEMPLATE_DB_PATH}`;

  console.log("Applying migrations to a fresh template database...");
  execSync("prisma migrate deploy --schema=prisma/schema.prisma", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "inherit",
  });

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    console.log("Seeding essentials only (no demo data)...");
    await seedEssentials(prisma);
  } finally {
    await prisma.$disconnect();
  }

  console.log(`Template database written to: ${TEMPLATE_DB_PATH}`);
  console.log("Remember to change the default admin password before distributing real data on top of this.");
}

main().catch((error) => {
  console.error("Failed to build template database:", error);
  process.exit(1);
});
