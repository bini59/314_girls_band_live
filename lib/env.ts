import { z } from "zod";

/**
 * 환경변수 스키마.
 *
 * 보안 강화 (production fail-fast):
 *  - production 환경에서는 JWT_SECRET (>=32자) + ADMIN_PASSWORD_HASH (>=1자) 가 필수.
 *  - development / test 에서는 둘 다 optional (로컬 개발 편의).
 *
 * 누락/부적합 시 throw 되는 메시지에는 누락된 키 이름이 포함되어
 * 외부에서 regex 로 식별할 수 있다. (env.test.ts 참고)
 */
const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    ADMIN_PASSWORD_HASH: z.string().optional(),
    JWT_SECRET: z.string().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== "production") {
      return;
    }

    if (!data.JWT_SECRET || data.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message:
          "JWT_SECRET 은 production 환경에서 필수이며 32자 이상이어야 합니다.",
      });
    }

    if (!data.ADMIN_PASSWORD_HASH || data.ADMIN_PASSWORD_HASH.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ADMIN_PASSWORD_HASH"],
        message:
          "ADMIN_PASSWORD_HASH 는 production 환경에서 필수입니다.",
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

/**
 * `process.env` 를 검증하여 타입 안전한 환경변수 객체를 반환한다.
 *
 * named export 인 이유:
 *  - 테스트에서 NODE_ENV 별 분기 동작을 검증하기 위해 호출 시점마다
 *    `process.env` 를 재평가할 수 있어야 한다.
 *  - production 부팅 검증은 모듈 로드 시점의 `env` 가 담당.
 */
export function parseEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

/**
 * Lazy 평가되는 환경변수 객체.
 *
 * 모듈 import 시점에 즉시 평가하면 production stub 을 사용하는 테스트가
 * 모듈을 로드하는 것만으로 throw 되어 분기별 동작을 검증할 수 없다.
 * 첫 접근 시점에 한 번만 검증/캐시한다.
 *
 * 사용처에서는 `env.DATABASE_URL` 처럼 평소처럼 접근하면 된다.
 */
let _env: AppEnv | undefined;
export const env: AppEnv = new Proxy({} as AppEnv, {
  get(_target, key: string) {
    if (!_env) {
      _env = parseEnv();
    }
    return _env[key as keyof AppEnv];
  },
});
