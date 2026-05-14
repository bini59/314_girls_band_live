/**
 * TicketSaleType / TicketSaleMethod 의 한국어 라벨.
 *
 * 어드민 UI 전반에서 동일 라벨을 쓰도록 단일 소스화한다.
 *  - Select 옵션
 *  - Card 배지
 *  - 테스트 비교
 */
import type {
  TicketSaleTypeInput,
  TicketSaleMethodInput,
} from "@/lib/admin/schemas/ticket-sale";
import type { LiveFormatType } from "@prisma/client";

export const TICKET_SALE_TYPE_LABELS: Record<TicketSaleTypeInput, string> = {
  FC_SENKO: "FC 선행",
  OFFICIAL_SENKO: "공식 선행",
  PLAYGUIDE_SENKO: "플레이가이드 선행",
  IPPAN: "일반 발매",
  TOJITSU: "당일권",
  LIVEVIEWING_SENKO: "LV 선행",
  LIVEVIEWING_IPPAN: "LV 일반",
  STREAMING_SALE: "배포 티켓",
  OTHER: "기타",
};

export const TICKET_SALE_METHOD_LABELS: Record<TicketSaleMethodInput, string> = {
  LOTTERY: "추첨",
  FIRST_COME: "선착",
};

/** Select 옵션 순회용 (key 안정 보장). */
export const TICKET_SALE_TYPE_OPTIONS: Array<{
  value: TicketSaleTypeInput;
  label: string;
}> = [
  { value: "FC_SENKO", label: TICKET_SALE_TYPE_LABELS.FC_SENKO },
  { value: "OFFICIAL_SENKO", label: TICKET_SALE_TYPE_LABELS.OFFICIAL_SENKO },
  { value: "PLAYGUIDE_SENKO", label: TICKET_SALE_TYPE_LABELS.PLAYGUIDE_SENKO },
  { value: "IPPAN", label: TICKET_SALE_TYPE_LABELS.IPPAN },
  { value: "TOJITSU", label: TICKET_SALE_TYPE_LABELS.TOJITSU },
  {
    value: "LIVEVIEWING_SENKO",
    label: TICKET_SALE_TYPE_LABELS.LIVEVIEWING_SENKO,
  },
  {
    value: "LIVEVIEWING_IPPAN",
    label: TICKET_SALE_TYPE_LABELS.LIVEVIEWING_IPPAN,
  },
  { value: "STREAMING_SALE", label: TICKET_SALE_TYPE_LABELS.STREAMING_SALE },
  { value: "OTHER", label: TICKET_SALE_TYPE_LABELS.OTHER },
];

export const TICKET_SALE_METHOD_OPTIONS: Array<{
  value: TicketSaleMethodInput;
  label: string;
}> = [
  { value: "LOTTERY", label: TICKET_SALE_METHOD_LABELS.LOTTERY },
  { value: "FIRST_COME", label: TICKET_SALE_METHOD_LABELS.FIRST_COME },
];

export const LIVE_FORMAT_TYPE_LABELS: Record<LiveFormatType, string> = {
  LIVE_VENUE: "현지 공연",
  LIVE_VIEWING: "라이브 뷰잉",
  STREAMING: "배포",
};

/**
 * ¥ 가격 포맷.
 * - 음수/0 도 그대로 표기. 천 단위 콤마.
 */
export function formatJpy(price: number): string {
  return `¥${price.toLocaleString("ja-JP")}`;
}
