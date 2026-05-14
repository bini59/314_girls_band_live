/**
 * Band 팩토리 (그리고 의존하는 Work 팩토리).
 *
 * Band 는 Work 의 자식이므로 Work 가 먼저 존재해야 한다.
 * 본 사이클에서는 LiveBand 검증을 끄지만, 다음 사이클을 위해 미리 둔다.
 */
import type { Band, Prisma, Work } from "@prisma/client";
import { testDb } from "../helpers/db";

let workCounter = 0;
let bandCounter = 0;

export type WorkOverrides = Partial<Prisma.WorkUncheckedCreateInput>;

export async function createWork(
  overrides: WorkOverrides = {}
): Promise<Work> {
  workCounter += 1;
  return testDb.work.create({
    data: {
      slug: `bang-dream-${workCounter}`,
      nameKo: "뱅드림",
      nameJp: "バンドリ!",
      nameEn: "BanG Dream!",
      ...overrides,
    },
  });
}

export type BandOverrides = Partial<Prisma.BandUncheckedCreateInput> & {
  workId?: number;
};

export async function createBand(
  overrides: BandOverrides = {}
): Promise<Band> {
  bandCounter += 1;
  let workId = overrides.workId;
  if (workId === undefined) {
    const work = await createWork();
    workId = work.id;
  }

  return testDb.band.create({
    data: {
      slug: `mygo-${bandCounter}`,
      nameKo: "마이고",
      nameJp: "MyGO!!!!!",
      nameEn: "MyGO!!!!!",
      ...overrides,
      workId,
    },
  });
}
