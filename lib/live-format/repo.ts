/**
 * LiveFormat 도메인 DB I/O 단일 진입점.
 *
 * 한 Live 는 실황(LIVE_VENUE) / 라이브뷰잉(LIVE_VIEWING) / 배포(STREAMING) 포맷을 가질 수 있다.
 *  - 컨벤션: 항상 LIVE_VENUE 1개 이상 (ensureDefaultFormat 으로 보장).
 *  - 삭제 시 TicketTier → TicketSaleTier 까지 cascade.
 */
import type { LiveFormat, LiveFormatType, TicketTier } from "@prisma/client";

import { prisma } from "@/lib/db";

/** Prisma not-found (record-to-delete) 판별. */
function isNotFoundError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2025"
  );
}

/**
 * 라이브의 LiveFormat 목록. tiers include.
 *  - tiers 는 order asc, id asc 로 정렬.
 *  - format 자체는 id asc.
 */
export async function listLiveFormats(
  liveId: number
): Promise<(LiveFormat & { tiers: TicketTier[] })[]> {
  return prisma.liveFormat.findMany({
    where: { liveId },
    orderBy: { id: "asc" },
    include: {
      tiers: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
      },
    },
  });
}

export type CreateLiveFormatInput = {
  liveId: number;
  type: LiveFormatType;
  label?: string | null;
  venueName?: string | null;
  url?: string | null;
};

/** LiveFormat 생성. */
export async function createLiveFormat(
  input: CreateLiveFormatInput
): Promise<LiveFormat> {
  return prisma.liveFormat.create({
    data: {
      liveId: input.liveId,
      type: input.type,
      label: input.label ?? null,
      venueName: input.venueName ?? null,
      url: input.url ?? null,
    },
  });
}

export type UpdateLiveFormatPatch = Partial<{
  type: LiveFormatType;
  label: string | null;
  venueName: string | null;
  url: string | null;
}>;

/**
 * 부분 업데이트. 존재하지 않으면 throw.
 */
export async function updateLiveFormat(
  formatId: number,
  patch: UpdateLiveFormatPatch
): Promise<LiveFormat> {
  const existing = await prisma.liveFormat.findFirst({
    where: { id: formatId },
  });
  if (!existing) {
    throw new Error(`LiveFormat(id=${formatId}) 를 찾을 수 없습니다.`);
  }
  return prisma.liveFormat.update({
    where: { id: formatId },
    data: patch,
  });
}

/**
 * LiveFormat 삭제. TicketTier / TicketSaleTier cascade.
 *  - 존재하지 않으면 throw ("찾을 수 없").
 */
export async function deleteLiveFormat(formatId: number): Promise<void> {
  try {
    await prisma.liveFormat.delete({ where: { id: formatId } });
  } catch (err) {
    if (isNotFoundError(err)) {
      throw new Error(`LiveFormat(id=${formatId}) 를 찾을 수 없습니다.`);
    }
    throw err;
  }
}

/**
 * 라이브에 LIVE_VENUE 포맷이 하나도 없으면 자동 생성.
 *  - venueName 은 Live.venueName 을 그대로 복사.
 *  - 이미 포맷이 있으면 no-op (멱등).
 *  - Live 자체가 없으면 throw.
 */
export async function ensureDefaultFormat(liveId: number): Promise<void> {
  const live = await prisma.live.findUnique({
    where: { id: liveId },
    select: { id: true, venueName: true },
  });
  if (!live) {
    throw new Error(`Live(id=${liveId}) 를 찾을 수 없습니다.`);
  }

  const count = await prisma.liveFormat.count({ where: { liveId } });
  if (count > 0) {
    return;
  }

  await prisma.liveFormat.create({
    data: {
      liveId,
      type: "LIVE_VENUE",
      venueName: live.venueName,
    },
  });
}
