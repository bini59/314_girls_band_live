/**
 * ApiKey 팩토리.
 *
 * repo.createApiKey 는 평문을 1회만 돌려주므로, 테스트에서 평문을 통제하려면
 * 직접 row 를 삽입한다. 해시는 hashApiKey 로 계산해 실제 저장 형태를 맞춘다.
 */
import type { ApiKey, Prisma } from "@prisma/client";
import { testDb } from "../helpers/db";
import { hashApiKey } from "@/lib/api-key/hash";

let counter = 0;

export type ApiKeyOverrides = Partial<Prisma.ApiKeyUncheckedCreateInput> & {
  plaintext?: string;
};

export async function createApiKeyRow(
  overrides: ApiKeyOverrides = {}
): Promise<{ apiKey: ApiKey; plaintext: string }> {
  counter += 1;
  const { plaintext: overridePlaintext, ...data } = overrides;
  const plaintext = overridePlaintext ?? `gbl_test_plaintext_${counter}`;

  const apiKey = await testDb.apiKey.create({
    data: {
      name: `test-key-${counter}`,
      keyHash: hashApiKey(plaintext),
      keyPrefix: plaintext.slice(0, 8),
      ...data,
    },
  });

  return { apiKey, plaintext };
}
