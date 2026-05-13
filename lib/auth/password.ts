import bcrypt from "bcryptjs";

/**
 * Verify a plaintext password against a bcrypt hash.
 * Never throws — returns false on any error (malformed hash, empty input, etc.).
 *
 * 비정상 해시 형식 등 예외 경로는 호출자에게는 false 로 단일화하되,
 * 운영 진단을 위해 서버 로그에는 남긴다. (요청 비밀번호는 절대 로깅하지 않음.)
 */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  if (!plain || !hash) {
    return false;
  }

  try {
    return await bcrypt.compare(plain, hash);
  } catch (error) {
    console.error("[verifyPassword] bcrypt.compare 실패", error);
    return false;
  }
}
