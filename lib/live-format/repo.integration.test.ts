/**
 * LiveFormat 레포지토리 통합 테스트.
 *
 *  - list/create/update/delete + tier cascade.
 *  - ensureDefaultFormat 멱등.
 *  - Live 가 없는 상황에서 ensureDefaultFormat throw.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { createLive } from "@/test/factories/live";
import { createLiveFormatRow } from "@/test/factories/live-format";
import { createTicketTierRow } from "@/test/factories/ticket-tier";

import {
  listLiveFormats,
  createLiveFormat,
  updateLiveFormat,
  deleteLiveFormat,
  ensureDefaultFormat,
} from "./repo";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("listLiveFormats", () => {
  it("빈 라이브 → []", async () => {
    const live = await createLive();
    expect(await listLiveFormats(live.id)).toEqual([]);
  });

  it("tiers include + tier order asc, id asc", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const t1 = await createTicketTierRow(fmt.id, { name: "A", order: 1 });
    const t2 = await createTicketTierRow(fmt.id, { name: "B", order: 0 });
    const t3 = await createTicketTierRow(fmt.id, { name: "C", order: 1 });

    const result = await listLiveFormats(live.id);
    expect(result.length).toBe(1);
    expect(result[0]!.tiers.map((t) => t.id)).toEqual([t2.id, t1.id, t3.id]);
  });

  it("다른 라이브 포맷은 보이지 않는다", async () => {
    const liveA = await createLive({ slug: "lf-a" });
    const liveB = await createLive({ slug: "lf-b" });
    await createLiveFormatRow(liveA.id);

    expect(await listLiveFormats(liveB.id)).toEqual([]);
  });
});

describe("createLiveFormat", () => {
  it("LIVE_VENUE 생성", async () => {
    const live = await createLive();
    const fmt = await createLiveFormat({
      liveId: live.id,
      type: "LIVE_VENUE",
      venueName: "場所",
    });
    expect(fmt.type).toBe("LIVE_VENUE");
    expect(fmt.venueName).toBe("場所");
  });

  it("STREAMING + url", async () => {
    const live = await createLive();
    const fmt = await createLiveFormat({
      liveId: live.id,
      type: "STREAMING",
      label: "ABEMA 배포",
      url: "https://abema.tv/xxx",
    });
    expect(fmt.type).toBe("STREAMING");
    expect(fmt.url).toBe("https://abema.tv/xxx");
    expect(fmt.label).toBe("ABEMA 배포");
  });
});

describe("updateLiveFormat", () => {
  it("부분 패치", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);

    const updated = await updateLiveFormat(fmt.id, { label: "변경됨" });
    expect(updated.label).toBe("변경됨");
    expect(updated.type).toBe(fmt.type);
  });

  it("존재하지 않는 formatId → throw '찾을 수 없'", async () => {
    await expect(
      updateLiveFormat(999999, { label: "x" })
    ).rejects.toThrow(/찾을 수 없/);
  });
});

describe("deleteLiveFormat", () => {
  it("정상 삭제", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);

    await deleteLiveFormat(fmt.id);
    expect(await listLiveFormats(live.id)).toEqual([]);
  });

  it("TicketTier cascade", async () => {
    const live = await createLive();
    const fmt = await createLiveFormatRow(live.id);
    const tier = await createTicketTierRow(fmt.id);

    await deleteLiveFormat(fmt.id);

    const remaining = await testDb.ticketTier.findUnique({
      where: { id: tier.id },
    });
    expect(remaining).toBeNull();
  });

  it("존재하지 않는 formatId → throw '찾을 수 없'", async () => {
    await expect(deleteLiveFormat(999999)).rejects.toThrow(/찾을 수 없/);
  });
});

describe("ensureDefaultFormat", () => {
  it("포맷 없으면 LIVE_VENUE 자동 생성 (Live.venueName 복사)", async () => {
    const live = await createLive({ venueName: "東京ドーム" });
    await ensureDefaultFormat(live.id);

    const formats = await listLiveFormats(live.id);
    expect(formats.length).toBe(1);
    expect(formats[0]!.type).toBe("LIVE_VENUE");
    expect(formats[0]!.venueName).toBe("東京ドーム");
  });

  it("이미 포맷이 있으면 no-op (멱등) — 두 번째 호출에도 1개 유지", async () => {
    const live = await createLive();
    await ensureDefaultFormat(live.id);
    await ensureDefaultFormat(live.id);
    await ensureDefaultFormat(live.id);

    const formats = await listLiveFormats(live.id);
    expect(formats.length).toBe(1);
  });

  it("STREAMING 등 다른 타입 포맷만 있어도 추가 생성 안 함", async () => {
    const live = await createLive();
    await createLiveFormatRow(live.id, { type: "STREAMING", venueName: null });
    await ensureDefaultFormat(live.id);

    const formats = await listLiveFormats(live.id);
    expect(formats.length).toBe(1);
    expect(formats[0]!.type).toBe("STREAMING");
  });

  it("존재하지 않는 liveId → throw", async () => {
    await expect(ensureDefaultFormat(999999)).rejects.toThrow();
  });
});
