/**
 * Development seed script.
 *
 * Creates the shared "essentials" (settings, permissions, Administrator
 * role, admin user — see seed-essentials.ts) plus sample data for every
 * module, so a fresh dev database is immediately useful for manual
 * testing without clicking through every form by hand.
 *
 * Never reuse the development admin credentials in a production build —
 * the first-run setup wizard (forcing a new password) is a future
 * hardening item, not yet built.
 */
import { PrismaClient } from "@prisma/client";
import { seedEssentials } from "./seed-essentials";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await seedEssentials(prisma);

  // ── Sample supplier + milk purchase (Phase 2 manual testing) ────
  const existingSupplier = await prisma.supplier.findFirst({ where: { name: "مزرعة الأمل" } });
  const supplier =
    existingSupplier ??
    (await prisma.supplier.create({
      data: {
        name: "مزرعة الأمل",
        phone: "0999000000",
        address: "الريف الشمالي",
        notes: "مورد تجريبي لأغراض الاختبار",
      },
    }));

  const existingPurchase = await prisma.milkPurchase.findFirst({
    where: { supplierId: supplier.id },
  });
  if (!existingPurchase) {
    await prisma.milkPurchase.create({
      data: {
        supplierId: supplier.id,
        date: new Date(),
        quantity: 100,
        pricePerUnit: 1.5,
        totalAmount: 150,
        paidAmount: 100,
        remainingAmount: 50,
        notes: "دفعة تجريبية",
      },
    });
    console.log("Created sample supplier + milk purchase for testing.");
  }

  // ── Sample product + production batch (Phase 4 manual testing) ──
  const existingProduct = await prisma.product.findFirst({ where: { name: "جبنة بيضاء" } });
  const product =
    existingProduct ??
    (await prisma.product.create({
      data: {
        name: "جبنة بيضاء",
        unit: "KG",
        sellingPrice: 5,
        costPrice: 3,
        minStockAlert: 10,
        notes: "منتج تجريبي لأغراض الاختبار",
      },
    }));

  const existingBatch = await prisma.productionBatch.findFirst({ where: { productId: product.id } });
  if (!existingBatch) {
    await prisma.$transaction([
      prisma.productionBatch.create({
        data: {
          productId: product.id,
          date: new Date(),
          quantityProduced: 20,
          milkConsumed: 100,
          notes: "دفعة تجريبية",
        },
      }),
      prisma.inventoryMovement.create({
        data: {
          productId: product.id,
          type: "IN",
          reason: "PRODUCTION",
          quantity: 20,
          date: new Date(),
          notes: "دفعة إنتاج",
        },
      }),
    ]);
    console.log("Created sample product + production batch for testing.");
  }

  // ── Sample customer + invoice + payment (Phase 5 manual testing) ──
  const existingCustomer = await prisma.customer.findFirst({ where: { name: "بقالة الأمل" } });
  const customer =
    existingCustomer ??
    (await prisma.customer.create({
      data: {
        name: "بقالة الأمل",
        phone: "0991234567",
        address: "حي الميدان",
        notes: "زبون تجريبي لأغراض الاختبار",
      },
    }));

  const existingInvoice = await prisma.invoice.findFirst({ where: { customerId: customer.id } });
  if (!existingInvoice) {
    const quantity = 5;
    const unitPrice = product.sellingPrice;
    const totalAmount = quantity * unitPrice;
    const paidAmount = totalAmount / 2;

    await prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: { key: "invoice" },
        update: { value: { increment: 1 } },
        create: { key: "invoice", value: 1 },
      });
      const invoiceNumber = `INV-${String(counter.value).padStart(6, "0")}`;

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: customer.id,
          date: new Date(),
          totalAmount,
          paidAmount,
          remainingAmount: totalAmount - paidAmount,
          notes: "فاتورة تجريبية",
          items: {
            create: [
              { productId: product.id, quantity, unitPrice, unitCost: product.costPrice, totalPrice: totalAmount },
            ],
          },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          type: "OUT",
          reason: "SALE",
          quantity,
          date: new Date(),
          notes: `بيع — فاتورة ${invoice.invoiceNumber}`,
        },
      });
    });
    console.log("Created sample customer + invoice for testing.");
  }

  // ── Sample expense + cash adjustment (Phase 6 manual testing) ──
  const existingExpense = await prisma.expense.findFirst({ where: { category: "UTILITIES" } });
  if (!existingExpense) {
    await prisma.expense.create({
      data: {
        category: "UTILITIES",
        amount: 50,
        date: new Date(),
        notes: "فاتورة كهرباء تجريبية",
      },
    });
    console.log("Created sample expense for testing.");
  }

  const existingAdjustment = await prisma.cashAdjustment.findFirst({ where: { reason: "رأس مال ابتدائي" } });
  if (!existingAdjustment) {
    await prisma.cashAdjustment.create({
      data: {
        type: "IN",
        amount: 1000,
        date: new Date(),
        reason: "رأس مال ابتدائي",
        notes: "دفعة تأسيسية تجريبية",
      },
    });
    console.log("Created sample cash adjustment for testing.");
  }

  console.log("Seeding complete.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
