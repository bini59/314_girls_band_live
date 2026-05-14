/**
 * Series (시리즈/IP) 팩토리.
 *
 *  - 카운터 기반 slug 로 중복 회피.
 *  - 기본값: "러브라이브 시리즈" 샘플.
 */
import type { Prisma, Series } from "@prisma/client";
import { testDb } from "../helpers/db";

let counter = 0;

export type SeriesOverrides = Partial<Prisma.SeriesUncheckedCreateInput>;

export async function createSeries(
  overrides: SeriesOverrides = {}
): Promise<Series> {
  counter += 1;
  return testDb.series.create({
    data: {
      slug: `love-live-${counter}`,
      nameKo: "러브라이브 시리즈",
      nameJp: "ラブライブ! シリーズ",
      nameEn: "Love Live! Series",
      ...overrides,
    },
  });
}
