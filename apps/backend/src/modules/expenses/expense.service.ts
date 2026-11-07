import { expenseRepository } from "./expense.repository";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { CreateExpenseInput, UpdateExpenseInput } from "@idm/shared-validation";
import type { Expense } from "@idm/shared-types";

function toDto(expense: {
  id: string;
  category: string;
  amount: number;
  date: Date;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Expense {
  return {
    id: expense.id,
    category: expense.category as Expense["category"],
    amount: expense.amount,
    date: expense.date.toISOString(),
    notes: expense.notes,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

export const expenseService = {
  async list(category?: string): Promise<Expense[]> {
    const expenses = await expenseRepository.findMany(category);
    return expenses.map(toDto);
  },

  async create(input: CreateExpenseInput, actorUserId: string): Promise<Expense> {
    const created = await expenseRepository.create({
      category: input.category,
      amount: input.amount,
      date: input.date,
      notes: input.notes ?? null,
    });

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_EXPENSE",
      entityType: "Expense",
      entityId: created.id,
      newValue: created,
    });

    return toDto(created);
  },

  async update(id: string, input: UpdateExpenseInput, actorUserId: string): Promise<Expense> {
    const before = await this.getByIdOrThrow(id);
    const updated = await expenseRepository.update(id, input);

    await auditService.log({
      userId: actorUserId,
      action: "UPDATE_EXPENSE",
      entityType: "Expense",
      entityId: id,
      oldValue: toDto(before),
      newValue: toDto(updated),
    });

    return toDto(updated);
  },

  async remove(id: string, actorUserId: string): Promise<void> {
    const before = await this.getByIdOrThrow(id);
    await expenseRepository.delete(id);

    await auditService.log({
      userId: actorUserId,
      action: "DELETE_EXPENSE",
      entityType: "Expense",
      entityId: id,
      oldValue: toDto(before),
    });
  },

  async getByIdOrThrow(id: string) {
    const expense = await expenseRepository.findById(id);
    if (!expense) {
      throw new AppError("المصروف غير موجود", 404, "EXPENSE_NOT_FOUND");
    }
    return expense;
  },
};
