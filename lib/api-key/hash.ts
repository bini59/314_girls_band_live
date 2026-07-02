/**
 * API 키 해시 유틸 (순수, node:crypto).
 *
 * 저장은 항상 sha256 해시만. 평문은 생성 시 1회만 노출한다.
 */
import { createHash, randomBytes } from "node:crypto";

export function generateApiKey(): {
  plaintext: string;
  hash: string;
  prefix: string;
} {
  const plaintext = `gbl_${randomBytes(32).toString("base64url")}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, 8),
  };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
