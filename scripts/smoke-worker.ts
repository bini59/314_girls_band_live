/** Exercise the built Worker, including Prisma Wasm, against a disposable local D1. */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { getPlatformProxy } from "wrangler";
import { PrismaD1 } from "@prisma/adapter-d1";
import type { D1Database } from "@cloudflare/workers-types";
import { PrismaClient } from "../generated/prisma-node/client";

async function main() {
  const persist = await mkdtemp(path.join(tmpdir(), "gbl-worker-smoke-"));
  const port = 8789;
  const origin = `http://127.0.0.1:${port}`;
  const key = "local-worker-smoke-only";
  let worker: ReturnType<typeof spawn> | undefined;
  let output = "";
  try {
    execFileSync(
      "pnpm",
      [
        "exec",
        "wrangler",
        "d1",
        "migrations",
        "apply",
        "DB",
        "--local",
        "--persist-to",
        persist,
      ],
      { stdio: "pipe" },
    );
    // CLI --persist-to appends v3; the platform proxy takes the exact state root.
    const proxy = await getPlatformProxy<{ DB: D1Database }>({
      persist: { path: path.join(persist, "v3") },
      remoteBindings: false,
    });
    const db = new PrismaClient({ adapter: new PrismaD1(proxy.env.DB) });
    try {
      await db.apiKey.create({
        data: {
          name: "Worker smoke",
          keyHash: createHash("sha256").update(key).digest("hex"),
          keyPrefix: "local-wo",
        },
      });
      await db.live.create({
        data: {
          slug: "worker-smoke",
          titleKo: "Worker D1 smoke",
          titleJp: "Worker D1 smoke",
          type: "SOLO",
          startAt: new Date("2026-10-22T09:00:00.123Z"),
          venueName: "Tokyo",
          status: "PUBLISHED",
        },
      });
    } finally {
      await db.$disconnect();
      await proxy.dispose();
    }
    worker = spawn(
      "pnpm",
      [
        "exec",
        "wrangler",
        "dev",
        "--local",
        "--port",
        String(port),
        "--persist-to",
        persist,
      ],
      { detached: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    for (const stream of [worker.stdout, worker.stderr])
      stream?.on("data", (chunk) => {
        output = (output + String(chunk)).slice(-30000);
      });
    const deadline = Date.now() + 60000;
    while (true) {
      try {
        if (
          (
            await fetch(`${origin}/api/health`, {
              signal: AbortSignal.timeout(2000),
            })
          ).ok
        )
          break;
      } catch {
        /* Wait for the local Worker. */
      }
      assert(
        Date.now() < deadline && worker.exitCode === null,
        `Worker startup failed\n${output}`,
      );
      await delay(250);
    }
    async function request(route: string, options?: RequestInit) {
      const response = await fetch(`${origin}${route}`, {
        ...options,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(
          `${route}: HTTP ${response.status}\n${await response.text()}\n${output}`,
        );
      return response;
    }
    // Repeat requests to detect initialization / cross-request Wasm problems.
    for (let i = 0; i < 3; i++) {
      assert.match(
        await (await request("/?ym=2026-10")).text(),
        /Worker D1 smoke/,
      );
      assert.match(
        await (await request("/lives/worker-smoke")).text(),
        /Worker D1 smoke/,
      );
    }
    const headers = { "x-api-key": key, "content-type": "application/json" };
    const startAt = "2026-10-22T09:00:00.123Z";
    const created = (await (
      await request("/api/v1/lives", {
        method: "POST",
        headers,
        body: JSON.stringify({
          slug: "worker-created",
          titleKo: "Created by Worker",
          titleJp: "Created by Worker",
          type: "SOLO",
          startAt,
          venueName: "Tokyo",
        }),
      })
    ).json()) as { id: number; startAt: string };
    assert.equal(created.startAt, startAt);
    const updated = (await (
      await request(`/api/v1/lives/${created.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ titleKo: "Updated by Worker" }),
      })
    ).json()) as { titleKo: string };
    assert.equal(updated.titleKo, "Updated by Worker");
    const fetched = (await (
      await request(`/api/v1/lives/${created.id}`, { headers })
    ).json()) as { titleKo: string; startAt: string };
    assert.equal(fetched.titleKo, "Updated by Worker");
    assert.equal(fetched.startAt, startAt);
    console.log(
      "Worker smoke passed: homepage/detail repeated reads + authenticated API create/update/read + UTC date round trip",
    );
  } finally {
    if (worker?.pid) {
      const exited = new Promise((resolve) => worker!.once("exit", resolve));
      try {
        process.kill(-worker.pid, "SIGTERM");
      } catch {
        /* Already exited. */
      }
      await Promise.race([exited, delay(3000)]);
    }
    await rm(persist, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
