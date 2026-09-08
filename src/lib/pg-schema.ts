import { Prisma } from "@prisma/client";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

type PgTable = "Issue" | "User" | "IssueWatcher";

/** Prisma model queries qualify `?schema=` from DATABASE_URL; `$queryRaw` does not. */
export function postgresSchema(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "public";
  try {
    const schema = new URL(raw).searchParams.get("schema");
    if (schema && IDENT.test(schema)) return schema;
  } catch {
    // Fall through to Prisma's default schema.
  }
  return "public";
}

export function pgTable(name: PgTable): Prisma.Sql {
  return Prisma.raw(`"${postgresSchema()}"."${name}"`);
}
