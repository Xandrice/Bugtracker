import type { Prisma } from "@prisma/client";

export function scheduleCategoryIds(form: FormData): string[] | null {
  const values = form.getAll("categoryId");
  if (values.length > 100 || values.some(value => typeof value !== "string" || !value || value.length > 100)) return null;
  return [...new Set(values as string[])];
}

export async function requireScheduleCategories(tx: Prisma.TransactionClient, ids: string[]) {
  if (ids.length && await tx.scheduleCategory.count({ where: { id: { in: ids } } }) !== ids.length) throw new Error("A category was removed. Refresh and try again.");
}
