import { describe, it, expect } from "vitest";
import {
  inferVendorFromUrl,
  type VendorLike,
} from "./domain-match";

const vendors: VendorLike[] = [
  { id: 1, slug: "eplus", baseUrl: "https://eplus.jp" },
  { id: 2, slug: "lawson-ticket", baseUrl: "https://l-tike.com" },
  { id: 3, slug: "ticket-pia", baseUrl: "https://t.pia.jp" },
  { id: 4, slug: "cn-playguide", baseUrl: "https://cnplayguide.com" },
  { id: 5, slug: "rakuten-ticket", baseUrl: "https://ticket.rakuten.co.jp" },
  {
    id: 6,
    slug: "bushiroad-music",
    baseUrl: "https://bushi-road-music.bushimo.jp",
  },
];

describe("inferVendorFromUrl - 정상 매칭", () => {
  it("eplus.jp 도메인은 eplus vendor", () => {
    const v = inferVendorFromUrl("https://eplus.jp/sf/detail/123", vendors);
    expect(v?.slug).toBe("eplus");
  });

  it("l-tike.com 도메인은 lawson-ticket vendor", () => {
    const v = inferVendorFromUrl("https://l-tike.com/concert/abc", vendors);
    expect(v?.slug).toBe("lawson-ticket");
  });

  it("t.pia.jp 도메인은 ticket-pia vendor", () => {
    const v = inferVendorFromUrl(
      "https://t.pia.jp/pia/event/event.do?eventCd=001",
      vendors
    );
    expect(v?.slug).toBe("ticket-pia");
  });

  it("cnplayguide.com 도메인은 cn-playguide vendor", () => {
    const v = inferVendorFromUrl("https://cnplayguide.com/event/123", vendors);
    expect(v?.slug).toBe("cn-playguide");
  });

  it("ticket.rakuten.co.jp 도메인은 rakuten-ticket vendor", () => {
    const v = inferVendorFromUrl(
      "https://ticket.rakuten.co.jp/event/foo",
      vendors
    );
    expect(v?.slug).toBe("rakuten-ticket");
  });
});

describe("inferVendorFromUrl - 서브도메인 매칭", () => {
  it("www.eplus.jp 도 eplus vendor (서브도메인 → 같은 hostname suffix)", () => {
    const v = inferVendorFromUrl("https://www.eplus.jp/ad/event/123", vendors);
    expect(v?.slug).toBe("eplus");
  });

  it("sf.eplus.jp 도 eplus vendor", () => {
    const v = inferVendorFromUrl(
      "https://sf.eplus.jp/sf/detail/xxx",
      vendors
    );
    expect(v?.slug).toBe("eplus");
  });
});

describe("inferVendorFromUrl - 쿼리스트링 / 경로", () => {
  it("쿼리스트링이 있어도 매칭", () => {
    const v = inferVendorFromUrl("https://eplus.jp?foo=bar&baz=1", vendors);
    expect(v?.slug).toBe("eplus");
  });
});

describe("inferVendorFromUrl - 대소문자 무시", () => {
  it("도메인이 대문자여도 매칭 (정상 URL parse 후 hostname 은 소문자화됨)", () => {
    const v = inferVendorFromUrl("https://EPLUS.JP/sf/detail", vendors);
    expect(v?.slug).toBe("eplus");
  });
});

describe("inferVendorFromUrl - 매칭 실패", () => {
  it("알려지지 않은 도메인은 null", () => {
    expect(
      inferVendorFromUrl("https://random-vendor.example/event/1", vendors)
    ).toBeNull();
  });

  it("빈 문자열은 null", () => {
    expect(inferVendorFromUrl("", vendors)).toBeNull();
  });

  it("URL 형식이 아니면 null (parse 실패)", () => {
    expect(inferVendorFromUrl("not-a-url", vendors)).toBeNull();
  });

  it("vendors 배열이 비어있으면 null", () => {
    expect(inferVendorFromUrl("https://eplus.jp", [])).toBeNull();
  });
});

describe("inferVendorFromUrl - baseUrl null 처리", () => {
  it("baseUrl 이 null 인 vendor 는 매칭 후보에서 제외", () => {
    const vendorsWithNull: VendorLike[] = [
      { id: 99, slug: "no-base-url", baseUrl: null },
      { id: 1, slug: "eplus", baseUrl: "https://eplus.jp" },
    ];
    const v = inferVendorFromUrl("https://eplus.jp/x", vendorsWithNull);
    expect(v?.slug).toBe("eplus");
  });

  it("모든 vendor 의 baseUrl 이 null 이면 null", () => {
    const all: VendorLike[] = [
      { id: 1, slug: "a", baseUrl: null },
      { id: 2, slug: "b", baseUrl: null },
    ];
    expect(inferVendorFromUrl("https://eplus.jp/x", all)).toBeNull();
  });
});
