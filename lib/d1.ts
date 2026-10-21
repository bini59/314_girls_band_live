import { getDb } from "@/lib/db";
import type { D1PreparedStatement } from "@cloudflare/workers-types";
export function statement(
  sql: string,
  values: unknown[] = [],
): D1PreparedStatement {
  return getDb()
    .prepare(sql)
    .bind(
      ...values.map((value) =>
        value instanceof Date ? value.getTime() : value,
      ),
    );
}
export async function atomicBatch(statements: D1PreparedStatement[]) {
  if (statements.length === 0) return [];
  return getDb().batch(statements);
}
