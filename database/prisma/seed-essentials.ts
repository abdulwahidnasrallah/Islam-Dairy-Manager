/**
 * The minimum a fresh install needs to be usable: settings, the full
 * permission list, an Administrator role granting all of them, and one
 * admin user. Shared by `seed.ts` (dev seed — essentials + demo data)
 * and `build-template-db.ts` (production installer template —
 * essentials only, no demo data).
 */
import type { PrismaClient } from "@prisma/client";
import argon2 from "argon2";
import { ALL_PERMISSIONS } from "@idm/shared-types";

export async function seedEssentials(prisma: PrismaClient): Promise<void> {
  // ── Application settings ────────────────────────────────
  await prisma.applicationSettings.upsert({
    where: { key: "STORE_NAME_AR" },
    update: {},
    create: { key: "STORE_NAME_AR", value: "إسلام للألبان والأجبان" },
  });

  await prisma.applicationSettings.upsert({
    where: { key: "CURRENCY" },
    update: {},
    create: { key: "CURRENCY", value: "USD" },
  });

  // ── Permissions ──────────────────────────────────────────
  for (const name of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // ── Administrator role, granting every permission ───────
  const adminRole = await prisma.role.upsert({
    where: { name: "Administrator" },
    update: {},
    create: { name: "Administrator", description: "صلاحيات كاملة على النظام" },
  });

  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    });
  }

  // ── Admin user ───────────────────────────────────────────
  const existingAdmin = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!existingAdmin) {
    const passwordHash = await argon2.hash("ChangeMe123!", { type: argon2.argon2id });
    await prisma.user.create({
      data: {
        username: "admin",
        fullName: "Administrator",
        passwordHash,
        roleId: adminRole.id,
      },
    });
    console.log("Created admin user (username: admin / password: ChangeMe123!)");
    console.log("⚠️  Change this password before using the app with real data.");
  } else if (!existingAdmin.roleId) {
    await prisma.user.update({ where: { id: existingAdmin.id }, data: { roleId: adminRole.id } });
  }
}
