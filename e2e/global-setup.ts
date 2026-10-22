import { prepareE2EEnv } from "./prepare-env";
import { localDb } from "./db";
export default async function globalSetup() {
  await prepareE2EEnv();
  const db = await localDb();
  try {
    for (const table of [
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
    ]) {
      await db.$executeRawUnsafe(`DELETE FROM "${table}"`);
    }
    await db.$executeRawUnsafe("DELETE FROM sqlite_sequence");
  } finally {
    await db.$disconnect();
  }
}
