/**
 * Vitest 용 어드민 세션 mock 헬퍼.
 *
 * 사용 패턴:
 *
 *   import { mockAdminSession, mockNoSession, redirectMock, cookieMocks }
 *     from "@/test/helpers/admin-session";
 *
 *   vi.mock("next/headers", () => ({ cookies: async () => cookieMocks.api }));
 *   vi.mock("next/navigation", () => ({ redirect: redirectMock }));
 *
 * 각 테스트 beforeEach 에서 mockAdminSession() 또는 mockNoSession() 호출.
 *
 * 본 헬퍼는 실제 JWT signing 까지 수행하므로 `verifySession` 의 라운드트립이
 * 정상 동작한다 (즉, guard.ts 가 실제 검증 흐름을 그대로 거치게 한다).
 */
import { vi } from "vitest";

export const TEST_JWT_SECRET =
  "test-secret-test-secret-test-secret-test-secret-32bytes-min";

/** redirect mock — 호출 시 throw 하여 흐름 종료를 모사 (Next.js 동작). */
export const redirectMock = vi.fn((url: string) => {
  const err = new Error(`NEXT_REDIRECT:${url}`);
  (err as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${url};307;`;
  throw err;
});

/** revalidatePath mock — Server Action 가 호출하는지 검증용. */
export const revalidatePathMock = vi.fn();

/** cookies() mock API. */
export const cookieMocks = {
  getMock: vi.fn(),
  setMock: vi.fn(),
  deleteMock: vi.fn(),
  api: {
    get: (...args: unknown[]) => cookieMocks.getMock(...args),
    set: (...args: unknown[]) => cookieMocks.setMock(...args),
    delete: (...args: unknown[]) => cookieMocks.deleteMock(...args),
  },
};

/** 모든 mock 초기화. beforeEach 에서 호출. */
export function resetAdminSessionMocks(): void {
  redirectMock.mockClear();
  revalidatePathMock.mockClear();
  cookieMocks.getMock.mockReset();
  cookieMocks.setMock.mockReset();
  cookieMocks.deleteMock.mockReset();
}

/**
 * 어드민 세션이 있는 상태로 mock 한다.
 * 내부에서 실제 JWT 를 signSession 으로 발급해 쿠키 mock 에 주입.
 */
export async function mockAdminSession(): Promise<void> {
  // session 모듈 동적 import — 환경변수 stub 이후 모듈이 fresh 로드되어야 함.
  const { signSession, SESSION_COOKIE_NAME } = await import("@/lib/auth/session");
  const token = await signSession({ sub: "admin", role: "ADMIN" });
  cookieMocks.getMock.mockImplementation((name: string) => {
    if (name === SESSION_COOKIE_NAME) {
      return { name, value: token };
    }
    return undefined;
  });
}

/** 세션 쿠키가 없는 상태로 mock 한다. */
export function mockNoSession(): void {
  cookieMocks.getMock.mockReturnValue(undefined);
}
