/**
 * LiveFormat 팩토리.
 *
 * Live 가 먼저 존재해야 한다. 기본값은 LIVE_VENUE.
 * 함수명은 repo 의 `createLiveFormat` 와 충돌하지 않도록 `Row` suffix.
 */
import type { LiveFormat, Prisma } from "@prisma/client";
import { testDb } from "../helpers/db";

export type LiveFormatOverrides = Partial<Prisma.LiveFormatUncheckedCreateInput>;

export async function createLiveFormatRow(
  liveId: number,
  overrides: LiveFormatOverrides = {}
): Promise<LiveFormat> {
  return testDb.liveFormat.create({
    data: {
      liveId,
      type: "LIVE_VENUE",
      venueName: "さいたまスーパーアリーナ",
      ...overrides,
    },
  });
}
