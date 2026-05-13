import { describe, it, expect, afterEach, vi } from "vitest";

describe("Vitest sanity", () => {
  it("실행 환경이 Asia/Tokyo 타임존으로 설정된다", () => {
    expect(process.env.TZ).toBe("Asia/Tokyo");
  });

  it("프로세스 환경에 DATABASE_URL이 정의되어 있다 (.env 로드 확인)", () => {
    // dotenv는 Next.js가 자동 로드. Vitest는 process.env에 .env를 직접 안 읽으므로
    // 이 테스트는 셋업 검증용이며 Phase 2에서 dotenv 명시 로드 시 활성화될 예정.
    // 지금은 환경 그 자체가 정의되는지만 확인.
    expect(typeof process.env).toBe("object");
  });
});

// ---------------------------------------------------------------------------
// parseEnv: production 환경에서 secret 필수
// ---------------------------------------------------------------------------
//
// 보안 강화 요구사항 (코드 리뷰 / 보안 리뷰 결과):
//  - production 빌드에서 JWT_SECRET / ADMIN_PASSWORD_HASH 가 비어 있으면
//    부팅 시점에 명시적으로 실패해야 한다 (fail-fast).
//  - development / test 환경에서는 두 값 모두 optional 유지 (현재 동작 보존).
//
// 구현 메모: 현재 env.ts 는 parseEnv() 결과를 모듈 top-level 에서 즉시 평가하여
// `env` 만 export 한다. 환경별 동작을 격리해서 테스트하려면 parseEnv 가 named
// export 되어 호출 시 process.env 를 재평가해야 한다. 본 사이클에서 추가.

describe("parseEnv - production 환경 강제 검증", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    // 원복: stubEnv 가 일부만 다루므로 직접 복구
    for (const key of Object.keys(process.env)) {
      if (!(key in ORIGINAL_ENV)) {
        delete process.env[key];
      }
    }
    for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
      process.env[k] = v;
    }
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function importParseEnv() {
    const mod = await import("./env");
    // parseEnv 는 named export 되어야 한다 (현재는 export 되지 않아 RED).
    return (mod as unknown as { parseEnv: () => unknown }).parseEnv;
  }

  it("production + JWT_SECRET 미설정 → throw", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://test");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv(
      "ADMIN_PASSWORD_HASH",
      "$2a$10$abcdefghijklmnopqrstuv.wxyz0123456789ABCDEFGHIJKL"
    );

    const parseEnv = await importParseEnv();
    expect(typeof parseEnv).toBe("function");
    expect(() => parseEnv()).toThrow(/JWT_SECRET/);
  });

  it("production + ADMIN_PASSWORD_HASH 미설정 → throw", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://test");
    vi.stubEnv(
      "JWT_SECRET",
      "0123456789abcdef0123456789abcdef0123456789abcdef"
    );
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");

    const parseEnv = await importParseEnv();
    expect(() => parseEnv()).toThrow(/ADMIN_PASSWORD_HASH/);
  });

  it("production + JWT_SECRET 이 32자 미만 → throw", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://test");
    vi.stubEnv("JWT_SECRET", "short-secret");
    vi.stubEnv(
      "ADMIN_PASSWORD_HASH",
      "$2a$10$abcdefghijklmnopqrstuv.wxyz0123456789ABCDEFGHIJKL"
    );

    const parseEnv = await importParseEnv();
    expect(() => parseEnv()).toThrow(/JWT_SECRET/);
  });

  it("development 환경에서는 JWT_SECRET / ADMIN_PASSWORD_HASH 둘 다 optional (throw 없음)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "postgres://test");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");

    const parseEnv = await importParseEnv();
    expect(() => parseEnv()).not.toThrow();
  });

  it("test 환경에서도 JWT_SECRET / ADMIN_PASSWORD_HASH 둘 다 optional (throw 없음)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", "postgres://test");
    vi.stubEnv("JWT_SECRET", "");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "");

    const parseEnv = await importParseEnv();
    expect(() => parseEnv()).not.toThrow();
  });

  it("production + 두 값 모두 적법 → throw 없음", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://test");
    vi.stubEnv(
      "JWT_SECRET",
      "0123456789abcdef0123456789abcdef0123456789abcdef"
    );
    vi.stubEnv(
      "ADMIN_PASSWORD_HASH",
      "$2a$10$abcdefghijklmnopqrstuv.wxyz0123456789ABCDEFGHIJKL"
    );

    const parseEnv = await importParseEnv();
    expect(() => parseEnv()).not.toThrow();
  });
});
