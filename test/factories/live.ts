/**
 * Live 팩토리.
 *
 * - 기본값은 MyGO!!!!! 1st 라이브를 표준 샘플로 사용 (UX_DECISIONS 참조).
 * - 모든 시각은 UTC `Date` 로 저장. JST 18:00 = UTC 09:00.
 * - `overrides` 로 필드 단위 변경.
 * - DB 에 실제 row 를 만들고 반환 (integration 테스트 용).
 */
import type { Live, Prisma } from "@prisma/client";
import { testDb } from "../helpers/db";

let counter = 0;

function nextSlug(base: string): string {
  counter += 1;
  return `${base}-${counter}`;
}

export type LiveOverrides = Partial<Prisma.LiveUncheckedCreateInput>;

export function buildLiveData(
  overrides: LiveOverrides = {}
): Prisma.LiveUncheckedCreateInput {
  const slug =
    overrides.slug !== undefined
      ? overrides.slug
      : nextSlug("mygo-1st-haru-no-uta");

  // JST 2026-03-15 18:00 = UTC 2026-03-15 09:00
  const startAt =
    overrides.startAt !== undefined
      ? overrides.startAt
      : new Date("2026-03-15T09:00:00Z");

  return {
    slug,
    titleKo: "MyGO!!!!! 1주년 라이브",
    titleJp: "MyGO!!!!! 1st ライブ「春の唄」",
    titleEn: 'MyGO!!!!! 1st Live "Haru no Uta"',
    type: "SOLO",
    startAt,
    venueName: "さいたまスーパーアリーナ",
    venueAddress: "埼玉県さいたま市中央区新都心8",
    status: "DRAFT",
    ...overrides,
  };
}

export async function createLive(overrides: LiveOverrides = {}): Promise<Live> {
  const data = buildLiveData(overrides);
  return testDb.live.create({ data });
}
