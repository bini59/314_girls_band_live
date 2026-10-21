import { getPlatformProxy } from "wrangler";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "../generated/prisma-node/client";
export async function localDb() {
  const proxy = await getPlatformProxy<{
    DB: import("@cloudflare/workers-types").D1Database;
  }>();
  const client = new PrismaClient({ adapter: new PrismaD1(proxy.env.DB) });
  const disconnect = client.$disconnect.bind(client);
  client.$disconnect = async () => {
    await disconnect();
    await proxy.dispose();
  };
  return client;
}
