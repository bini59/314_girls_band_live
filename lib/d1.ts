import { getDb } from "@/lib/db";
import type { D1PreparedStatement } from "@cloudflare/workers-types";
export function statement(
  sql: string,
  values: unknown[] = [],
): D1PreparedStatement {
  return getDb()
    .prepare(sql)
    .bind(
      // Same text the Prisma D1 adapter binds; SQLite never matches an integer against a text date.
      ...values.map((value) =>
        value instanceof Date ? value.toISOString().replace("Z", "+00:00") : value,
      ),
    );
}
export async function atomicBatch(statements: D1PreparedStatement[]) {
  if (statements.length === 0) return [];
  return getDb().batch(statements);
}
