"use client";

/**
 * TicketSaleCard — 단일 판매 라운드의 카드 표시.
 *
 * - 유형(type) / 방식(method) 배지 + 라벨 + 발매처.
 * - JST 표시: 시작/마감/발표.
 * - 적용 티어 chip ("S석 ¥9,800").
 * - 액션: 편집 / 삭제 (삭제는 confirm).
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatJstDateTime } from "@/lib/admin/format-jst";

import type { SerializedTicketSale } from "../ticket-sale-actions";
import {
  TICKET_SALE_METHOD_LABELS,
  TICKET_SALE_TYPE_LABELS,
  formatJpy,
} from "./ticket-sale-labels";

export interface TicketSaleCardProps {
  sale: SerializedTicketSale;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function TicketSaleCard({
  sale,
  onEdit,
  onDelete,
  disabled = false,
}: TicketSaleCardProps): React.JSX.Element {
  return (
    <article
      data-testid={`ticket-sale-card-${sale.id}`}
      className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4"
    >
      <header className="flex flex-wrap items-center gap-2">
        <Badge variant="default">
          {TICKET_SALE_TYPE_LABELS[sale.type]}
        </Badge>
        <Badge variant="secondary">
          {TICKET_SALE_METHOD_LABELS[sale.method]}
        </Badge>
        <span className="text-sm font-medium">
          {sale.label && sale.label.length > 0
            ? sale.label
            : TICKET_SALE_TYPE_LABELS[sale.type]}
        </span>
        <span className="text-xs text-[color:var(--color-muted-foreground)]">
          · {sale.vendor.name}
        </span>
      </header>

      <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
        <div className="flex gap-1">
          <dt className="text-[color:var(--color-muted-foreground)]">시작</dt>
          <dd>{formatJstDateTime(sale.startsAt)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-[color:var(--color-muted-foreground)]">마감</dt>
          <dd>{formatJstDateTime(sale.endsAt)}</dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-[color:var(--color-muted-foreground)]">발표</dt>
          <dd>{formatJstDateTime(sale.announceAt)}</dd>
        </div>
      </dl>

      {sale.tiers.length > 0 ? (
        <ul
          data-testid={`tier-chips-${sale.id}`}
          className="flex flex-wrap gap-1.5"
        >
          {sale.tiers.map((tier) => (
            <li key={tier.id}>
              <Badge variant="outline">
                {tier.name} {formatJpy(tier.priceJpy)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[color:var(--color-muted-foreground)]">
          연결된 티어 없음
        </p>
      )}

      <footer className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEdit}
          disabled={disabled}
        >
          편집
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => {
            if (typeof window !== "undefined") {
              const ok = window.confirm("이 라운드를 삭제하시겠습니까?");
              if (!ok) return;
            }
            onDelete();
          }}
          disabled={disabled}
        >
          삭제
        </Button>
      </footer>
    </article>
  );
}
