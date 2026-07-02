/**
 * 도메인 공유 에러 타입.
 *
 * repo 가 Prisma unique/FK 위반을 사용자 메시지로 감싸 던질 때 사용한다.
 * Error 를 상속하므로 기존 `.message` 소비자(어드민 액션)는 그대로 동작하고,
 * API 라우트는 `instanceof ConflictError` 로 409 로 매핑할 수 있다.
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/** Prisma unique 제약 위반(P2002) 인지 판별 (raw Prisma 에러용). */
export function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
