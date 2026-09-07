/**
 * API 키 해시 유틸 단위 테스트 (RED — 구현 전).
 *
 * lib/api-key/hash.ts:
 *  - generateApiKey(): { plaintext, hash, prefix }
 *      plaintext = "gbl_" + 32바이트 CSPRNG base64url
 *      hash      = sha256(plaintext) hex
 *      prefix    = plaintext 앞 8자
 *  - hashApiKey(plaintext): sha256 hex (결정적)
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

import { generateApiKey, hashApiKey } from "./hash";

describe("generateApiKey", () => {
  it("plaintext 는 'gbl_' 접두사로 시작한다", () => {
    const { plaintext } = generateApiKey();
    expect(plaintext.startsWith("gbl_")).toBe(true);
  });

  it("매 호출마다 서로 다른 plaintext 를 생성한다 (고유성)", () => {
    const a = generateApiKey().plaintext;
    const b = generateApiKey().plaintext;
    expect(a).not.toBe(b);
  });

  it("prefix 는 plaintext 앞 8자와 동일하다", () => {
    const { plaintext, prefix } = generateApiKey();
    expect(prefix).toBe(plaintext.slice(0, 8));
  });

  it("hash 는 plaintext 의 sha256 hex 와 일치한다", () => {
    const { plaintext, hash } = generateApiKey();
    const expected = createHash("sha256").update(plaintext).digest("hex");
    expect(hash).toBe(expected);
  });
});

describe("hashApiKey", () => {
  it("결정적: 같은 입력이면 같은 해시", () => {
    expect(hashApiKey("gbl_sample")).toBe(hashApiKey("gbl_sample"));
  });

  it("generateApiKey 가 돌려준 hash 와 일치한다", () => {
    const { plaintext, hash } = generateApiKey();
    expect(hashApiKey(plaintext)).toBe(hash);
  });
});
