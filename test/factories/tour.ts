/**
 * Tour (투어) 팩토리.
 *
 *  - 카운터 기반 slug 로 중복 회피.
 *  - workId 는 호출자가 명시적으로 넘긴다 (Work FK 필수).
 *  - 기본값: 학마스 LIVE TOUR 標 샘플.
 */
import type { Prisma, Tour } from "@prisma/client";
import { testDb } from "../helpers/db";

let counter = 0;

export type TourOverrides = Partial<Prisma.TourUncheckedCreateInput> & {
  workId: number;
};

export async function createTour(overrides: TourOverrides): Promise<Tour> {
  counter += 1;
  return testDb.tour.create({
    data: {
      slug: `gakumas-tour-shirube-${counter}`,
      nameKo: "학원아이돌마스터 LIVE TOUR 標",
      nameJp: "学園アイドルマスター LIVE TOUR 標",
      nameEn: "Gakuen Idolmaster LIVE TOUR Shirube",
      ...overrides,
    },
  });
}
