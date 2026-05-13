/**
 * URL 의 hostname 으로부터 Vendor 를 추정하는 유틸.
 *
 * 어드민이 라운드 URL 을 붙여넣을 때 자동으로 Vendor 콤보박스를 채우는 데 사용.
 * 매칭 실패 시 호출자는 사용자에게 수동 선택을 요청한다 (UX_DECISIONS C4).
 */

/**
 * 매칭에 필요한 Vendor 의 최소 필드.
 *
 * Prisma `Vendor` 모델 전체를 의존하지 않고 형태만 유지하여
 * 테스트와 호출자의 결합도를 낮춘다.
 */
export interface VendorLike {
  id: number;
  slug: string;
  baseUrl: string | null;
}

/**
 * URL → Vendor 추정.
 *
 * 규칙:
 *  1. 입력 URL 을 `new URL(...)` 로 파싱. 실패 시 `null`.
 *  2. Vendor 의 `baseUrl` 도 같은 방식으로 파싱. 실패하거나 null 이면 건너뜀.
 *  3. 입력 hostname 이 vendor hostname 과 동일하거나, 그 서브도메인이면 매칭.
 *  4. 첫 매칭을 반환. 매칭 후보 없으면 `null`.
 *
 * `URL` API 의 hostname 은 자동 소문자화되므로 대소문자는 자연스럽게 무시된다.
 */
export function inferVendorFromUrl(
  url: string,
  vendors: VendorLike[]
): VendorLike | null {
  if (!url) {
    return null;
  }

  let inputHost: string;
  try {
    inputHost = new URL(url).hostname;
  } catch {
    return null;
  }

  if (!inputHost) {
    return null;
  }

  for (const vendor of vendors) {
    if (!vendor.baseUrl) {
      continue;
    }
    let vendorHost: string;
    try {
      vendorHost = new URL(vendor.baseUrl).hostname;
    } catch {
      continue;
    }
    if (!vendorHost) {
      continue;
    }
    if (inputHost === vendorHost || inputHost.endsWith(`.${vendorHost}`)) {
      return vendor;
    }
  }

  return null;
}
