import { customerPaymentRepository } from "./payment.repository";
import { customerService } from "../customers/customer.service";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { CreateCustomerPaymentInput } from "@idm/shared-validation";
import type { CustomerPayment } from "@idm/shared-types";

function toDto(payment: {
  id: string;
  customerId: string;
  amount: number;
  date: Date;
  method: string;
  notes: string | null;
  createdAt: Date;
}): CustomerPayment {
  return {
    id: payment.id,
    customerId: payment.customerId,
    amount: payment.amount,
    date: payment.date.toISOString(),
    method: payment.method as CustomerPayment["method"],
    notes: payment.notes,
    createdAt: payment.createdAt.toISOString(),
  };
}

export const customerPaymentService = {
  async list(customerId?: string): Promise<CustomerPayment[]> {
    const payments = await customerPaymentRepository.findMany(customerId);
    return payments.map(toDto);
  },

  async create(input: CreateCustomerPaymentInput, actorUserId: string): Promise<CustomerPayment> {
    const balance = await customerService.getBalance(input.customerId);

    if (input.amount > balance) {
      throw new AppError(
        "المبلغ المدفوع أكبر من المستحق على الزبون",
        422,
        "PAYMENT_EXCEEDS_BALANCE",
      );
    }

    const created = await customerPaymentRepository.create({
      customer: { connect: { id: input.customerId } },
      amount: input.amount,
      date: input.date,
      method: input.method,
      notes: input.notes ?? null,
    });

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_CUSTOMER_PAYMENT",
      entityType: "CustomerPayment",
      entityId: created.id,
      newValue: created,
    });

    // Reducing the customer's outstanding balance happens automatically
    // because the balance is always DERIVED (totalInvoiced - totalPaid),
    // never stored — so there is nothing further to "update" here.

    return toDto(created);
  },
};
