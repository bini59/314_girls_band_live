/**
 * TicketSale Zod 스키마 단위 테스트 (RED — 구현 전/RED 확인용).
 *
 * 검증 대상:
 *  - ticketSaleTypeSchema / ticketSaleMethodSchema   : enum
 *  - ticketSaleCreateSchema                          : 필수 필드 + JST datetime + 시간 관계 + tierIds 빈 배열 허용
 *  - ticketSaleUpdateSchema                          : partial. 입력된 값은 동일 검증.
 *  - setTicketSaleTiersSchema                        : 양의 정수 배열, 빈 배열 허용
 */
import { describe, it, expect } from "vitest";

import {
  setTicketSaleTiersSchema,
  ticketSaleCreateSchema,
  ticketSaleMethodSchema,
  ticketSaleTypeSchema,
  ticketSaleUpdateSchema,
} from "./ticket-sale";

const VALID_SALE = {
  vendorId: 1,
  type: "FC_SENKO" as const,
  method: "LOTTERY" as const,
  startsAtJst: "2026-01-10T10:00",
};

describe("ticketSaleTypeSchema", () => {
  it.each([
    ["FC_SENKO"],
    ["OFFICIAL_SENKO"],
    ["PLAYGUIDE_SENKO"],
    ["IPPAN"],
    ["TOJITSU"],
    ["LIVEVIEWING_SENKO"],
    ["LIVEVIEWING_IPPAN"],
    ["STREAMING_SALE"],
    ["OTHER"],
  ])("'%s' 허용", (t) => {
    expect(ticketSaleTypeSchema.safeParse(t).success).toBe(true);
  });

  it("외부 값 거부", () => {
    expect(ticketSaleTypeSchema.safeParse("FANCLUB").success).toBe(false);
    expect(ticketSaleTypeSchema.safeParse("fc_senko").success).toBe(false);
  });
});

describe("ticketSaleMethodSchema", () => {
  it.each([["LOTTERY"], ["FIRST_COME"]])("'%s' 허용", (m) => {
    expect(ticketSaleMethodSchema.safeParse(m).success).toBe(true);
  });

  it("외부 값 거부", () => {
    expect(ticketSaleMethodSchema.safeParse("RAFFLE").success).toBe(false);
  });
});

describe("ticketSaleCreateSchema — 성공 케이스", () => {
  it("필수 필드만 + tierIds 기본값([]) 통과", () => {
    const parsed = ticketSaleCreateSchema.safeParse(VALID_SALE);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tierIds).toEqual([]);
    }
  });

  it("tierIds 빈 배열 명시도 통과", () => {
    const parsed = ticketSaleCreateSchema.safeParse({
      ...VALID_SALE,
      tierIds: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("모든 datetime + tierIds + 부가 필드 풀 페이로드 통과", () => {
    const parsed = ticketSaleCreateSchema.safeParse({
      ...VALID_SALE,
      label: "FC 最速先行",
      startsAtJst: "2026-01-10T10:00",
      endsAtJst: "2026-01-15T23:59",
      announceAtJst: "2026-01-20T18:00",
      paymentDeadlineAtJst: "2026-01-25T23:59",
      url: "https://example.com/sale",
      notes: "선착 1인 4매까지",
      tierIds: [1, 2, 3],
    });
    expect(parsed.success).toBe(true);
  });

  it("optional datetime 들이 빈 문자열이어도 통과", () => {
    const parsed = ticketSaleCreateSchema.safeParse({
      ...VALID_SALE,
      endsAtJst: "",
      announceAtJst: "",
      paymentDeadlineAtJst: "",
      url: "",
      notes: "",
      label: "",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("ticketSaleCreateSchema — 필수 필드 누락", () => {
  it.each([["vendorId"], ["type"], ["method"], ["startsAtJst"]])(
    "'%s' 누락 시 실패",
    (field) => {
      const input = { ...VALID_SALE } as Record<string, unknown>;
      delete input[field];
      expect(ticketSaleCreateSchema.safeParse(input).success).toBe(false);
    }
  );
});

describe("ticketSaleCreateSchema — vendorId 검증", () => {
  it("vendorId 가 0 또는 음수면 실패", () => {
    expect(
      ticketSaleCreateSchema.safeParse({ ...VALID_SALE, vendorId: 0 }).success
    ).toBe(false);
    expect(
      ticketSaleCreateSchema.safeParse({ ...VALID_SALE, vendorId: -1 }).success
    ).toBe(false);
  });

  it("vendorId 가 소수면 실패", () => {
    expect(
      ticketSaleCreateSchema.safeParse({ ...VALID_SALE, vendorId: 1.5 })
        .success
    ).toBe(false);
  });

  it("vendorId 가 문자열이면 실패", () => {
    expect(
      ticketSaleCreateSchema.safeParse({ ...VALID_SALE, vendorId: "1" }).success
    ).toBe(false);
  });
});

describe("ticketSaleCreateSchema — JST datetime 형식 검증", () => {
  it("startsAtJst 가 공백 구분자면 실패", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        startsAtJst: "2026-01-10 10:00",
      }).success
    ).toBe(false);
  });

  it("startsAtJst 가 초 포함이면 실패", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        startsAtJst: "2026-01-10T10:00:00",
      }).success
    ).toBe(false);
  });

  it("startsAtJst 가 의미상 무효(`2026-13-99T25:99`) 면 실패", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        startsAtJst: "2026-13-99T25:99",
      }).success
    ).toBe(false);
  });

  it("startsAtJst 가 존재하지 않는 날짜(`2026-02-30T10:00`) 면 실패", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        startsAtJst: "2026-02-30T10:00",
      }).success
    ).toBe(false);
  });

  it("endsAtJst 가 잘못된 형식이면 실패", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        endsAtJst: "2026-01-15",
      }).success
    ).toBe(false);
  });

  it("announceAtJst / paymentDeadlineAtJst 가 잘못된 형식이면 실패", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        announceAtJst: "not-a-date",
      }).success
    ).toBe(false);
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        paymentDeadlineAtJst: "2026/01/25T23:59",
      }).success
    ).toBe(false);
  });
});

describe("ticketSaleCreateSchema — 시간 관계 검증", () => {
  it("endsAt <= startsAt 이면 실패 (endsAtJst path)", () => {
    const parsed = ticketSaleCreateSchema.safeParse({
      ...VALID_SALE,
      startsAtJst: "2026-01-10T10:00",
      endsAtJst: "2026-01-10T10:00",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      expect(flat.endsAtJst).toBeDefined();
    }
  });

  it("endsAt < startsAt 이면 실패", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        startsAtJst: "2026-01-10T10:00",
        endsAtJst: "2026-01-09T10:00",
      }).success
    ).toBe(false);
  });

  it("announceAt < endsAt 이면 실패 (announceAtJst path)", () => {
    const parsed = ticketSaleCreateSchema.safeParse({
      ...VALID_SALE,
      startsAtJst: "2026-01-10T10:00",
      endsAtJst: "2026-01-15T23:59",
      announceAtJst: "2026-01-12T10:00",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      expect(flat.announceAtJst).toBeDefined();
    }
  });

  it("announceAt == endsAt 은 통과 (>= 정책)", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        startsAtJst: "2026-01-10T10:00",
        endsAtJst: "2026-01-15T23:59",
        announceAtJst: "2026-01-15T23:59",
      }).success
    ).toBe(true);
  });

  it("paymentDeadlineAt < announceAt 이면 실패 (paymentDeadlineAtJst path)", () => {
    const parsed = ticketSaleCreateSchema.safeParse({
      ...VALID_SALE,
      startsAtJst: "2026-01-10T10:00",
      endsAtJst: "2026-01-15T23:59",
      announceAtJst: "2026-01-20T18:00",
      paymentDeadlineAtJst: "2026-01-18T23:59",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      expect(flat.paymentDeadlineAtJst).toBeDefined();
    }
  });

  it("한쪽이 비어있으면 시간관계 검증을 우회한다", () => {
    // ends 없고 announce 만 있어도 통과 (선착 라운드의 경우)
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        startsAtJst: "2026-01-10T10:00",
        announceAtJst: "2026-01-20T18:00",
      }).success
    ).toBe(true);
  });
});

describe("ticketSaleCreateSchema — url / notes / label 길이", () => {
  it("url 잘못된 형식 거부", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        url: "not-a-url",
      }).success
    ).toBe(false);
  });

  it("url 500자 초과 거부", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        url: "https://example.com/" + "a".repeat(500),
      }).success
    ).toBe(false);
  });

  it("notes 2000자 초과 거부", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        notes: "a".repeat(2001),
      }).success
    ).toBe(false);
  });

  it("label 200자 초과 거부", () => {
    expect(
      ticketSaleCreateSchema.safeParse({
        ...VALID_SALE,
        label: "a".repeat(201),
      }).success
    ).toBe(false);
  });
});

describe("ticketSaleCreateSchema — tierIds", () => {
  it("음수/0 tier id 포함 시 거부", () => {
    expect(
      ticketSaleCreateSchema.safeParse({ ...VALID_SALE, tierIds: [1, 0] })
        .success
    ).toBe(false);
    expect(
      ticketSaleCreateSchema.safeParse({ ...VALID_SALE, tierIds: [-1] })
        .success
    ).toBe(false);
  });

  it("소수 tier id 포함 시 거부", () => {
    expect(
      ticketSaleCreateSchema.safeParse({ ...VALID_SALE, tierIds: [1, 2.5] })
        .success
    ).toBe(false);
  });
});

describe("ticketSaleUpdateSchema — partial", () => {
  it("빈 객체 통과", () => {
    expect(ticketSaleUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("label 만 변경", () => {
    expect(
      ticketSaleUpdateSchema.safeParse({ label: "수정" }).success
    ).toBe(true);
  });

  it("입력된 startsAtJst 는 동일 형식 검증", () => {
    expect(
      ticketSaleUpdateSchema.safeParse({ startsAtJst: "2026-01-10 10:00" })
        .success
    ).toBe(false);
  });

  it("입력된 type 은 enum 검증", () => {
    expect(
      ticketSaleUpdateSchema.safeParse({ type: "INVALID" }).success
    ).toBe(false);
  });

  it("입력된 vendorId 음수 거부", () => {
    expect(
      ticketSaleUpdateSchema.safeParse({ vendorId: -1 }).success
    ).toBe(false);
  });

  it("시간 관계 위반 거부 (들어온 값끼리)", () => {
    expect(
      ticketSaleUpdateSchema.safeParse({
        startsAtJst: "2026-01-10T10:00",
        endsAtJst: "2026-01-09T10:00",
      }).success
    ).toBe(false);
  });

  it("tierIds 필드는 update 스키마에 포함되지 않는다 (passthrough 없이 무시되거나 stripped — 어쨌든 schema 성공)", () => {
    // tierIds 는 ticketSaleUpdateSchema 에 정의되지 않음 → strip 되어도 success.
    const parsed = ticketSaleUpdateSchema.safeParse({ tierIds: [1, 2] });
    expect(parsed.success).toBe(true);
  });
});

describe("setTicketSaleTiersSchema", () => {
  it("정렬된 tier id 배열 통과", () => {
    expect(setTicketSaleTiersSchema.safeParse([1, 2, 3]).success).toBe(true);
  });

  it("빈 배열도 통과 (모든 매핑 제거)", () => {
    expect(setTicketSaleTiersSchema.safeParse([]).success).toBe(true);
  });

  it("음수/0 ID 거부", () => {
    expect(setTicketSaleTiersSchema.safeParse([1, 0]).success).toBe(false);
    expect(setTicketSaleTiersSchema.safeParse([-1]).success).toBe(false);
  });

  it("소수 ID 거부", () => {
    expect(setTicketSaleTiersSchema.safeParse([1, 2.5]).success).toBe(false);
  });

  it("문자열 ID 거부", () => {
    expect(setTicketSaleTiersSchema.safeParse(["1"]).success).toBe(false);
  });
});
