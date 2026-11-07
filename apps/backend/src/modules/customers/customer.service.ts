import { customerRepository } from "./customer.repository";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { CreateCustomerInput, UpdateCustomerInput } from "@idm/shared-validation";
import type { Customer, CustomerProfile, CustomerWithBalance } from "@idm/shared-types";

function toDto(customer: {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Customer {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    notes: customer.notes,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export const customerService = {
  async list(search?: string): Promise<CustomerWithBalance[]> {
    const customers = await customerRepository.findMany(search);
    const totalsMap = await customerRepository.getFinancialTotalsMap(customers.map((c) => c.id));

    return customers.map((customer) => ({
      ...toDto(customer),
      ...(totalsMap.get(customer.id) ?? { totalInvoiced: 0, totalPaid: 0, balance: 0 }),
    }));
  },

  /** Customers who currently owe the store money — backs the "Debts" screen. */
  async listWithDebt(): Promise<CustomerWithBalance[]> {
    const all = await this.list();
    return all.filter((c) => c.balance > 0);
  },

  async create(input: CreateCustomerInput, actorUserId: string): Promise<Customer> {
    const existing = await customerRepository.findByExactName(input.name);
    if (existing) {
      throw new AppError("يوجد زبون آخر بنفس الاسم", 409, "DUPLICATE_CUSTOMER");
    }

    const created = await customerRepository.create({
      name: input.name,
      phone: input.phone ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    });

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_CUSTOMER",
      entityType: "Customer",
      entityId: created.id,
      newValue: created,
    });

    return toDto(created);
  },

  async update(id: string, input: UpdateCustomerInput, actorUserId: string): Promise<Customer> {
    const before = await this.getByIdOrThrow(id);

    if (input.name) {
      const existing = await customerRepository.findByExactName(input.name);
      if (existing && existing.id !== id) {
        throw new AppError("يوجد زبون آخر بنفس الاسم", 409, "DUPLICATE_CUSTOMER");
      }
    }

    const updated = await customerRepository.update(id, input);

    await auditService.log({
      userId: actorUserId,
      action: "UPDATE_CUSTOMER",
      entityType: "Customer",
      entityId: id,
      oldValue: toDto(before),
      newValue: toDto(updated),
    });

    return toDto(updated);
  },

  async remove(id: string, actorUserId: string): Promise<void> {
    const before = await this.getByIdOrThrow(id);

    const [invoiceCount, paymentCount] = await customerRepository.hasInvoicesOrPayments(id);
    if (invoiceCount > 0 || paymentCount > 0) {
      throw new AppError(
        "لا يمكن حذف زبون له فواتير أو دفعات مسجلة",
        409,
        "CUSTOMER_HAS_TRANSACTIONS",
      );
    }

    await customerRepository.delete(id);

    await auditService.log({
      userId: actorUserId,
      action: "DELETE_CUSTOMER",
      entityType: "Customer",
      entityId: id,
      oldValue: toDto(before),
    });
  },

  async getProfile(id: string): Promise<CustomerProfile> {
    const customer = await customerRepository.findByIdWithRelations(id);
    if (!customer) {
      throw new AppError("الزبون غير موجود", 404, "CUSTOMER_NOT_FOUND");
    }

    const totals = await customerRepository.getFinancialTotals(id);

    return {
      customer: toDto(customer),
      ...totals,
      invoices: customer.invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        date: inv.date.toISOString(),
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        remainingAmount: inv.remainingAmount,
        status: inv.status as CustomerProfile["invoices"][number]["status"],
        notes: inv.notes,
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
        items: inv.items.map((item) => ({
          id: item.id,
          invoiceId: item.invoiceId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          totalPrice: item.totalPrice,
        })),
      })),
      payments: customer.payments.map((pay) => ({
        id: pay.id,
        customerId: pay.customerId,
        amount: pay.amount,
        date: pay.date.toISOString(),
        method: pay.method as CustomerProfile["payments"][number]["method"],
        notes: pay.notes,
        createdAt: pay.createdAt.toISOString(),
      })),
    };
  },

  async getByIdOrThrow(id: string) {
    const customer = await customerRepository.findById(id);
    if (!customer) {
      throw new AppError("الزبون غير موجود", 404, "CUSTOMER_NOT_FOUND");
    }
    return customer;
  },

  /** Used by other modules (e.g. customer payments) that need just the balance. */
  async getBalance(id: string): Promise<number> {
    await this.getByIdOrThrow(id);
    const totals = await customerRepository.getFinancialTotals(id);
    return totals.balance;
  },

  /** Total owed by all customers combined — used by the dashboard. */
  async getTotalBalance(): Promise<number> {
    return customerRepository.getTotalBalance();
  },
};
