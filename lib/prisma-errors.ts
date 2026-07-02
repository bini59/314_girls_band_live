/**
 * Prisma 에러 코드 공용 가드.
 *
 * 여러 repo / server action 이 중복 정의하던 raw error-code 판별을 한 곳에 모은다.
 * 도메인 특화 가드(메시지/target 검사)는 여기의 base 가드를 호출해 코드 부분만 재사용한다.
 */

/** Prisma 에러 객체에서 code 문자열을 안전하게 추출. */
export function getPrismaErrorCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    return (err as { code?: string }).code;
  }
  return undefined;
}

/** P2025 — record-to-update/delete not found. */
export function isNotFoundError(err: unknown): boolean {
  return getPrismaErrorCode(err) === "P2025";
}

/** P2002 — unique constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  return getPrismaErrorCode(err) === "P2002";
}

/** P2003 — foreign key constraint violation. */
export function isForeignKeyViolation(err: unknown): boolean {
  return getPrismaErrorCode(err) === "P2003";
}
