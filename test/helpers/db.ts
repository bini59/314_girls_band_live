import { prisma as testDb, getDb } from "@/lib/db";
export { testDb };

const TABLES = [
  "ticket_sale_tier",
  "ticket_sale",
  "ticket_tier",
  "live_format",
  "live_band",
  "live",
  "tour",
  "band",
  "work",
  "series",
  "vendor",
  "api_key",
];

export async function resetDb(): Promise<void> {
  const db = getDb();
  await db.batch([
    ...TABLES.map((table) => db.prepare(`DELETE FROM "${table}"`)),
    db.prepare("DELETE FROM sqlite_sequence"),
  ]);
}

export async function disconnectDb(): Promise<void> {
  await testDb.$disconnect();
}
