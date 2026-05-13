/**
 * Slug 생성 유틸.
 *
 * - `slugify(input)` — kebab-case ASCII 슬러그 생성. 비ASCII 는 제거.
 * - `ensureUniqueSlug(base, exists)` — DB 충돌 시 `-2`, `-3` ... suffix 자동 부여.
 *
 * UX_DECISIONS C8 의 자동 생성 규칙을 호출자가 조합해서 사용한다.
 */

const SLUG_MAX_LENGTH = 200;
const MAX_UNIQUE_SUFFIX_ATTEMPTS = 100;

/**
 * 입력 문자열을 URL-safe kebab-case slug 로 변환.
 *
 * 규칙:
 *  - 영문 소문자화
 *  - 어퍼스트로피(' / ’) 는 제거 (단어 경계 X) — 영문권 slug 라이브러리 관례
 *    (예: "it's" → "its", "μ's" → "s")
 *  - 그 외 비-알파뉴메릭은 단어 경계 (하이픈)
 *  - 한글/일본어 등 비-ASCII 는 빈 결과로 이어질 수 있다 — 호출자는
 *    `ensureUniqueSlug` 또는 폼 검증에서 빈 결과를 거부해야 한다.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’ʼ]/g, "") // ASCII apostrophe + curly apostrophe + modifier letter apostrophe
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH);
}

/**
 * `base` 슬러그가 이미 존재하면 `-2`, `-3` ... suffix 를 시도해
 * 첫 빈 슬러그를 반환한다.
 *
 * - `exists` 는 DB 또는 외부 저장소를 조회하는 비동기 콜백.
 * - 상한(`MAX_UNIQUE_SUFFIX_ATTEMPTS`) 까지 모두 충돌하면 에러를 throw 한다
 *   (현실적으로 도달 불가능하지만 무한 루프 방지를 위한 안전 장치).
 * - `base` 가 빈 문자열이면 즉시 throw — 호출자가 수동 입력을 강제해야 한다.
 */
export async function ensureUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  if (!base) {
    throw new Error(
      'ensureUniqueSlug: base slug is empty — 호출자가 수동 입력 필요'
    );
  }

  if (!(await exists(base))) {
    return base;
  }

  // suffix 는 2 부터 시작 (foo, foo-2, foo-3, ...).
  for (let i = 2; i <= MAX_UNIQUE_SUFFIX_ATTEMPTS; i++) {
    const candidate = `${base}-${i}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to generate a unique slug for base "${base}" after ${MAX_UNIQUE_SUFFIX_ATTEMPTS} attempts.`
  );
}
