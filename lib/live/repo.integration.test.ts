/**
 * Live 레포지토리 통합 테스트 (RED — 구현 전).
 *
 * lib/live/repo.ts 는 모든 Live 도메인 DB I/O 의 단일 진입점.
 *  - 모든 조회 함수는 기본적으로 `deletedAt: null` 필터를 적용한다 (UX_DECISIONS C2).
 *  - JST → UTC 변환은 호출자(Server Action)가 담당. repo 는 Date 만 다룬다.
 *  - status 는 enum LiveStatus (DRAFT / PUBLISHED).
 *
 * 본 사이클 한정 가정:
 *  - publishLive 는 헤더 필수 필드 충족 + status 전이만 책임 (LiveBand 검증은 다음 사이클).
 *
 * 격리:
 *  - 각 it 전에 resetDb() 로 모든 도메인 테이블 TRUNCATE CASCADE.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import type { Live } from "@prisma/client";

import { resetDb, testDb, disconnectDb } from "@/test/helpers/db";
import { createLive, buildLiveData } from "@/test/factories/live";

import {
  listLivesForAdmin,
  getLiveById,
  getLiveBySlug,
  createLive as createLiveRepo,
  updateLive,
  publishLive,
  unpublishLive,
  softDeleteLive,
} from "./repo";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("createLive", () => {
  it("기본 status 는 DRAFT", async () => {
    const data = buildLiveData({ slug: "create-test-1" });
    const live = await createLiveRepo({
      slug: data.slug as string,
      titleKo: data.titleKo as string,
      titleJp: data.titleJp as string,
      titleEn: (data.titleEn as string | null | undefined) ?? null,
      type: data.type as "SOLO" | "TAIBAN" | "FES",
      startAt: data.startAt as Date,
      venueName: data.venueName as string,
    });

    expect(live.status).toBe("DRAFT");
    expect(live.id).toBeGreaterThan(0);
    expect(live.deletedAt).toBeNull();
  });

  it("slug 중복 시 `-2`, `-3` 자동 suffix (UX_DECISIONS C8)", async () => {
    // 동일 base slug 로 3번 생성
    const first = await createLiveRepo({
      slug: "duplicate-slug",
      titleKo: "k1",
      titleJp: "j1",
      type: "SOLO",
      startAt: new Date("2026-03-15T09:00:00Z"),
      venueName: "v",
    });
    const second = await createLiveRepo({
      slug: "duplicate-slug",
      titleKo: "k2",
      titleJp: "j2",
      type: "SOLO",
      startAt: new Date("2026-03-15T09:00:00Z"),
      venueName: "v",
    });
    const third = await createLiveRepo({
      slug: "duplicate-slug",
      titleKo: "k3",
      titleJp: "j3",
      type: "SOLO",
      startAt: new Date("2026-03-15T09:00:00Z"),
      venueName: "v",
    });

    expect(first.slug).toBe("duplicate-slug");
    expect(second.slug).toBe("duplicate-slug-2");
    expect(third.slug).toBe("duplicate-slug-3");
  });

  it("optional 필드 (titleEn / doorsOpenAt / endAt / venueAddress) 정상 저장", async () => {
    const live = await createLiveRepo({
      slug: "optional-fields",
      titleKo: "제목",
      titleJp: "タイトル",
      titleEn: "Title",
      type: "TAIBAN",
      startAt: new Date("2026-03-15T09:00:00Z"),
      doorsOpenAt: new Date("2026-03-15T08:00:00Z"),
      endAt: new Date("2026-03-15T12:00:00Z"),
      venueName: "장소",
      venueAddress: "도쿄도",
    });

    expect(live.titleEn).toBe("Title");
    expect(live.doorsOpenAt?.toISOString()).toBe("2026-03-15T08:00:00.000Z");
    expect(live.endAt?.toISOString()).toBe("2026-03-15T12:00:00.000Z");
    expect(live.venueAddress).toBe("도쿄도");
  });
});

describe("getLiveById", () => {
  it("존재하는 id 면 row 반환", async () => {
    const created = await createLive();
    const got = await getLiveById(created.id);
    expect(got?.id).toBe(created.id);
    expect(got?.slug).toBe(created.slug);
  });

  it("존재하지 않는 id 면 null", async () => {
    const got = await getLiveById(999999);
    expect(got).toBeNull();
  });

  it("soft-deleted 라이브는 null 반환", async () => {
    const created = await createLive();
    await testDb.live.update({
      where: { id: created.id },
      data: { deletedAt: new Date() },
    });

    const got = await getLiveById(created.id);
    expect(got).toBeNull();
  });
});

describe("getLiveBySlug", () => {
  it("존재하는 slug 면 row 반환", async () => {
    const created = await createLive({ slug: "find-me-by-slug" });
    const got = await getLiveBySlug("find-me-by-slug");
    expect(got?.id).toBe(created.id);
  });

  it("존재하지 않는 slug 면 null", async () => {
    expect(await getLiveBySlug("nonexistent")).toBeNull();
  });

  it("soft-deleted slug 도 null", async () => {
    const created = await createLive({ slug: "soft-deleted-slug" });
    await testDb.live.update({
      where: { id: created.id },
      data: { deletedAt: new Date() },
    });
    expect(await getLiveBySlug("soft-deleted-slug")).toBeNull();
  });
});

describe("listLivesForAdmin", () => {
  it("빈 DB 면 빈 배열", async () => {
    const result = await listLivesForAdmin();
    expect(result).toEqual([]);
  });

  it("DRAFT/PUBLISHED 모두 포함", async () => {
    await createLive({ slug: "list-draft", status: "DRAFT" });
    await createLive({ slug: "list-published", status: "PUBLISHED" });

    const result = await listLivesForAdmin();
    expect(result.map((l: Live) => l.slug).sort()).toEqual(
      ["list-draft", "list-published"].sort()
    );
  });

  it("deletedAt 이 not null 인 row 는 제외", async () => {
    const visible = await createLive({ slug: "list-visible" });
    const hidden = await createLive({ slug: "list-hidden" });
    await testDb.live.update({
      where: { id: hidden.id },
      data: { deletedAt: new Date() },
    });

    const result = await listLivesForAdmin();
    expect(result.map((l: Live) => l.id)).toEqual([visible.id]);
  });

  it("기본 정렬: updatedAt DESC (또는 createdAt DESC — 최근 등록/수정 우선)", async () => {
    const older = await createLive({ slug: "older" });
    // updatedAt 정렬을 강제하기 위해 명시적으로 시간 조작
    await testDb.live.update({
      where: { id: older.id },
      data: { updatedAt: new Date("2026-01-01T00:00:00Z") },
    });
    const newer = await createLive({ slug: "newer" });
    await testDb.live.update({
      where: { id: newer.id },
      data: { updatedAt: new Date("2026-06-01T00:00:00Z") },
    });

    const result = await listLivesForAdmin();
    expect(result.map((l: Live) => l.id)).toEqual([newer.id, older.id]);
  });

  it("limit 옵션으로 결과 개수 제한", async () => {
    for (let i = 0; i < 7; i++) {
      await createLive({ slug: `limit-test-${i}` });
    }

    const result = await listLivesForAdmin({ limit: 5 });
    expect(result.length).toBe(5);
  });

  it("limit 미지정 시 기본 한도 (50) 적용 — 보호용", async () => {
    // 51개 생성하면 50개만 반환되어야 함 (TODO.md Step 0-3)
    for (let i = 0; i < 51; i++) {
      await createLive({ slug: `default-limit-${i}` });
    }
    const result = await listLivesForAdmin();
    expect(result.length).toBeLessThanOrEqual(50);
  });
});

describe("updateLive", () => {
  it("부분 패치 (예: titleKo 만) 가능", async () => {
    const created = await createLive();
    const updated = await updateLive(created.id, { titleKo: "수정됨" });
    expect(updated.titleKo).toBe("수정됨");
    expect(updated.titleJp).toBe(created.titleJp);
  });

  it("updatedAt 가 갱신된다", async () => {
    const created = await createLive();
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 10));
    const updated = await updateLive(created.id, { titleKo: "수정됨" });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it("soft-deleted 라이브는 업데이트 거부 (찾지 못함 → throw 또는 null)", async () => {
    const created = await createLive();
    await testDb.live.update({
      where: { id: created.id },
      data: { deletedAt: new Date() },
    });
    await expect(
      updateLive(created.id, { titleKo: "수정됨" })
    ).rejects.toThrow();
  });
});

describe("publishLive", () => {
  it("DRAFT → PUBLISHED 전환", async () => {
    const created = await createLive({ status: "DRAFT" });
    const published = await publishLive(created.id);
    expect(published.status).toBe("PUBLISHED");
  });

  it("이미 PUBLISHED 라이브도 호출 가능 (idempotent)", async () => {
    const created = await createLive({ status: "PUBLISHED" });
    const published = await publishLive(created.id);
    expect(published.status).toBe("PUBLISHED");
  });

  it("soft-deleted 라이브 publish 시도 → throw", async () => {
    const created = await createLive();
    await testDb.live.update({
      where: { id: created.id },
      data: { deletedAt: new Date() },
    });
    await expect(publishLive(created.id)).rejects.toThrow();
  });

  it("updatedAt 갱신", async () => {
    const created = await createLive({ status: "DRAFT" });
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 10));
    const published = await publishLive(created.id);
    expect(published.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });
});

describe("unpublishLive", () => {
  it("PUBLISHED → DRAFT 전환", async () => {
    const created = await createLive({ status: "PUBLISHED" });
    const result = await unpublishLive(created.id);
    expect(result.status).toBe("DRAFT");
  });

  it("DRAFT → DRAFT (idempotent)", async () => {
    const created = await createLive({ status: "DRAFT" });
    const result = await unpublishLive(created.id);
    expect(result.status).toBe("DRAFT");
  });
});

describe("softDeleteLive", () => {
  it("deletedAt 가 설정된다", async () => {
    const created = await createLive();
    const deleted = await softDeleteLive(created.id);
    expect(deleted.deletedAt).not.toBeNull();
  });

  it("후속 getLiveById 에서 null", async () => {
    const created = await createLive();
    await softDeleteLive(created.id);
    expect(await getLiveById(created.id)).toBeNull();
  });

  it("후속 listLivesForAdmin 결과에서 제외", async () => {
    const a = await createLive({ slug: "keep" });
    const b = await createLive({ slug: "remove" });
    await softDeleteLive(b.id);

    const result = await listLivesForAdmin();
    expect(result.map((l: Live) => l.id)).toEqual([a.id]);
  });

  it("이미 soft-deleted 라이브는 멱등 (또는 throw — 어느 쪽이든 deletedAt 유지)", async () => {
    const created = await createLive();
    await softDeleteLive(created.id);
    // 두 번째 호출은 throw 또는 그대로 둠. 어느 쪽이든 deletedAt 은 유지.
    try {
      await softDeleteLive(created.id);
    } catch {
      // OK: 이미 삭제됨을 알릴 수 있음
    }
    const row = await testDb.live.findUnique({ where: { id: created.id } });
    expect(row?.deletedAt).not.toBeNull();
  });
});
