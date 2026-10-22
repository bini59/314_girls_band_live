import { PrismaClient } from "@/generated/prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";

// Tests inject an isolated local workerd D1 binding; requests use the Worker binding.
const state = globalThis as typeof globalThis & { __testD1?: D1Database };
export function getDb(): D1Database {
  return (
    state.__testD1 ??
    (getCloudflareContext().env as unknown as { DB: D1Database }).DB
  );
}
const clients = new WeakMap<D1Database, PrismaClient>();
function getPrisma(): PrismaClient {
  const db = getDb();
  let client = clients.get(db);
  if (!client) {
    client = new PrismaClient({ adapter: new PrismaD1(db) });
    clients.set(db, client);
  }
  return client;
}
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, key) {
    const client = getPrisma();
    const value = Reflect.get(client, key);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
