/**
 * Prisma Json 컬럼 (`Band.snsLinks`) 의 런타임 가드.
 *
 * DB 의 Json 컬럼은 schema 상 `JsonValue` 라 누구든 (Prisma Studio, 외부 마이그레이션,
 * 잘못된 시드 등) 배열·중첩 객체·스칼라를 넣을 수 있다. 어드민 UI/Server Action 은
 * 항상 `Record<string, string>` 또는 `null` 로 다루므로, DB→UI 진입 지점에서 한 번
 * coerce 하여 잘못된 값은 안전하게 null/제거 한다.
 *
 * 컴포넌트에서 `as Record<string, string>` 같은 unchecked cast 를 쓰지 말고
 * 본 헬퍼를 통하도록 한다.
 */

export function coerceSnsLinks(
  value: unknown
): Record<string, string> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return null;
  if (Array.isArray(value)) return null;

  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key !== "string" || key.length === 0) continue;
    if (typeof val !== "string") continue;
    out[key] = val;
  }
  return Object.keys(out).length === 0 ? null : out;
}
