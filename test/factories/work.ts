/**
 * Work (작품) 팩토리.
 *
 *  - 카운터 기반 slug 로 중복 회피.
 *  - 기본값: "걸즈밴드 크라이" 샘플.
 *  - seriesId 는 옵션 (단일 작품 IP 는 null).
 *
 * 참고: `band.ts` 의 `createWork` 는 Band 의 부모 셋업용으로 남겨두었다.
 * 두 팩토리는 서로 독립적이며, 카운터를 공유하지 않는다.
 */
import type { Prisma, Work } from "@prisma/client";
import { testDb } from "../helpers/db";

let counter = 0;

export type WorkOverrides = Partial<Prisma.WorkUncheckedCreateInput>;

export async function createWorkRow(
  overrides: WorkOverrides = {}
): Promise<Work> {
  counter += 1;
  return testDb.work.create({
    data: {
      slug: `girls-band-cry-${counter}`,
      nameKo: "걸즈밴드 크라이",
      nameJp: "ガールズバンドクライ",
      nameEn: "Girls Band Cry",
      ...overrides,
    },
  });
}
