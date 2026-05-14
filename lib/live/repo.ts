/**
 * Live 도메인 DB I/O 단일 진입점 (post-merge reco M2).
 *
 * 원칙:
 *  - 모든 조회는 기본적으로 `deletedAt: null` 필터를 적용 (UX_DECISIONS C2).
 *  - JST → UTC 변환은 호출자(Server Action) 책임. repo 는 `Date` 만 다룬다.
 *  - status 는 enum LiveStatus (DRAFT / PUBLISHED).
 *  - mutation 은 가능한 한 단일 prisma 호출. 트랜잭션은 슬러그 중복 같이 race 필요한 곳만.
 */
import type { Live, LiveStatus, LiveType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

const DEFAULT_LIST_LIMIT = 50;
const MAX_SLUG_SUFFIX_ATTEMPTS = 50;

/**
 * createLive 입력 — JST→UTC 변환 후 호출자가 채워서 전달.
 *
 * slug 는 base 값을 받는다. 충돌 시 `-2`, `-3` ... suffix 가 자동 부여된다.
 */
export type CreateLiveInput = {
  slug: string;
  titleKo: string;
  titleJp: string;
  titleEn?: string | null;
  type: LiveType;
  startAt: Date;
  doorsOpenAt?: Date | null;
  endAt?: Date | null;
  venueName: string;
  venueAddress?: string | null;
  venueUrl?: string | null;
  notes?: string | null;
};

/**
 * Create a new Live (DRAFT by default).
 *
 * Slug collision handling:
 *  - 1차 시도: `slug` 그대로 insert.
 *  - Prisma `P2002` (unique violation) 발생 시 `${slug}-2`, `-3` ... 시도.
 *  - `MAX_SLUG_SUFFIX_ATTEMPTS` 까지 실패하면 throw.
 *
 * Race condition: 어드민 1인 시스템이라 사실상 발생하지 않지만, 발생 시
 * P2002 catch 로 안전하게 재시도된다.
 */
export async function createLive(input: CreateLiveInput): Promise<Live> {
  const baseSlug = input.slug;
  let attempt = 0;

  while (attempt < MAX_SLUG_SUFFIX_ATTEMPTS) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      return await prisma.live.create({
        data: {
          slug: candidate,
          titleKo: input.titleKo,
          titleJp: input.titleJp,
          titleEn: input.titleEn ?? null,
          type: input.type,
          startAt: input.startAt,
          doorsOpenAt: input.doorsOpenAt ?? null,
          endAt: input.endAt ?? null,
          venueName: input.venueName,
          venueAddress: input.venueAddress ?? null,
          venueUrl: input.venueUrl ?? null,
          notes: input.notes ?? null,
          status: "DRAFT",
        },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    `createLive: slug "${baseSlug}" 의 고유 suffix 를 찾지 못했습니다 (시도 ${MAX_SLUG_SUFFIX_ATTEMPTS}회).`
  );
}

/** Prisma unique violation 인지 판별. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

/** id 로 조회. soft-deleted 는 null. */
export async function getLiveById(id: number): Promise<Live | null> {
  return prisma.live.findFirst({
    where: { id, deletedAt: null },
  });
}

/** slug 로 조회. soft-deleted 는 null. */
export async function getLiveBySlug(slug: string): Promise<Live | null> {
  return prisma.live.findFirst({
    where: { slug, deletedAt: null },
  });
}

/**
 * slug 가 이미 사용 중인지 (soft-deleted 포함). slug 중복 자동 suffix 계산용.
 *
 * 본 함수는 soft-deleted 도 포함한다 — slug 는 globally unique 제약이므로
 * DB 레벨 충돌을 피해야 한다.
 */
export async function isSlugTaken(slug: string): Promise<boolean> {
  const row = await prisma.live.findUnique({ where: { slug } });
  return row !== null;
}

export type ListLivesOptions = {
  limit?: number;
};

/**
 * 어드민 목록용 라이브 리스트.
 *
 * - DRAFT / PUBLISHED 모두 포함.
 * - deletedAt: null 만.
 * - 기본 정렬: updatedAt DESC (최근 작업한 라이브 우선).
 * - limit 기본 50.
 */
export async function listLivesForAdmin(
  options: ListLivesOptions = {}
): Promise<Live[]> {
  const limit = Math.min(options.limit ?? DEFAULT_LIST_LIMIT, DEFAULT_LIST_LIMIT);
  return prisma.live.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/**
 * updateLive 입력 — partial.
 * JST→UTC 변환은 호출자가 수행.
 */
export type UpdateLiveInput = Partial<{
  titleKo: string;
  titleJp: string;
  titleEn: string | null;
  type: LiveType;
  startAt: Date;
  doorsOpenAt: Date | null;
  endAt: Date | null;
  venueName: string;
  venueAddress: string | null;
  venueUrl: string | null;
  slug: string;
  notes: string | null;
}>;

/**
 * 부분 업데이트. soft-deleted 라이브는 throw.
 *
 * updateMany 로 deletedAt:null 조건을 함께 검사하여, 결과 count 가 0 이면
 * "찾지 못함" 으로 throw. 그 후 다시 findUnique 로 row 를 가져와 반환.
 */
export async function updateLive(
  id: number,
  patch: UpdateLiveInput
): Promise<Live> {
  // findFirst 로 deletedAt:null 검사 (P2025 보다 명시적).
  const existing = await prisma.live.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new Error(`Live(id=${id}) 를 찾을 수 없거나 삭제됨.`);
  }

  // 슬러그가 변경되었다면 unique 충돌 가능성. Prisma 의 P2002 를 throw 그대로 전파.
  return prisma.live.update({
    where: { id },
    data: patch as Prisma.LiveUncheckedUpdateInput,
  });
}

/** DRAFT → PUBLISHED. soft-deleted 라이브는 throw. */
export async function publishLive(id: number): Promise<Live> {
  return setLiveStatus(id, "PUBLISHED");
}

/** PUBLISHED → DRAFT. soft-deleted 라이브는 throw. */
export async function unpublishLive(id: number): Promise<Live> {
  return setLiveStatus(id, "DRAFT");
}

async function setLiveStatus(id: number, status: LiveStatus): Promise<Live> {
  const existing = await prisma.live.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw new Error(`Live(id=${id}) 를 찾을 수 없거나 삭제됨.`);
  }
  return prisma.live.update({
    where: { id },
    data: { status },
  });
}

/** Soft-delete. 이미 삭제된 row 라도 호출 가능 (멱등 보장 — deletedAt 유지). */
export async function softDeleteLive(id: number): Promise<Live> {
  const existing = await prisma.live.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`Live(id=${id}) 가 존재하지 않습니다.`);
  }
  if (existing.deletedAt) {
    // 이미 삭제됨 — 그대로 반환 (멱등).
    return existing;
  }
  return prisma.live.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
