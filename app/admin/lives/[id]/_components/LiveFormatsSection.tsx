/**
 * LiveFormatsSection — Live 의 포맷 목록을 표시하는 SectionCard.
 *
 * - useSectionList 로 낙관적 add/remove/replace 관리.
 * - "+ 포맷 추가" 버튼 → LiveFormatDialog (create mode).
 * - 각 카드의 편집 → Dialog (edit mode), 삭제 → 낙관 제거 후 실패 시 롤백.
 * - LiveFormatCard 가 format.tiers 데이터를 받아 자체적으로 TicketTiersSubSection
 *   을 렌더한다. (renderTierSlot 함수 prop 은 RSC 호환을 위해 제거됨.)
 */
"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { useSectionList } from "@/lib/admin/section-state";

import { SectionCard } from "./SectionCard";
import { LiveFormatCard } from "./LiveFormatCard";
import {
  LiveFormatDialog,
  type LiveFormatDialogValues,
  type LiveFormatLike,
} from "./LiveFormatDialog";
import {
  createLiveFormatAction,
  deleteLiveFormatAction,
  updateLiveFormatAction,
  type LiveFormatActionResult,
} from "../live-format-actions";

export interface LiveFormatsSectionProps {
  liveId: number;
  initialFormats: LiveFormatLike[];
}

const EMPTY_MESSAGE =
  "포맷을 1개 이상 등록해주세요. (현지 공연·라이브뷰잉·배포)";

type DialogState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; format: LiveFormatLike };

export function LiveFormatsSection({
  liveId,
  initialFormats,
}: LiveFormatsSectionProps) {
  const list = useSectionList<LiveFormatLike>(initialFormats, (f) =>
    f.id ?? "__pending__"
  );
  const [dialog, setDialog] = React.useState<DialogState>({ mode: "closed" });
  const [error, setError] = React.useState<string | null>(null);

  function openCreate(): void {
    setError(null);
    setDialog({ mode: "create" });
  }

  function openEdit(format: LiveFormatLike): void {
    setError(null);
    setDialog({ mode: "edit", format });
  }

  function closeDialog(): void {
    setDialog({ mode: "closed" });
  }

  async function handleCreate(
    values: LiveFormatDialogValues
  ): Promise<LiveFormatActionResult> {
    const result = await createLiveFormatAction(liveId, {
      type: values.type,
      label: values.label,
      venueName: values.venueName,
      url: values.url,
    });
    if (result.ok && result.format) {
      list.add({
        id: result.format.id,
        type: result.format.type,
        label: result.format.label,
        venueName: result.format.venueName,
        url: result.format.url,
        tiers: [],
      });
    }
    return result;
  }

  async function handleEdit(
    values: LiveFormatDialogValues
  ): Promise<LiveFormatActionResult> {
    if (dialog.mode !== "edit" || dialog.format.id === undefined) {
      return { ok: false, error: "편집할 포맷을 찾지 못했습니다." };
    }
    const formatId = dialog.format.id;
    const result = await updateLiveFormatAction(formatId, {
      type: values.type,
      label: values.label,
      venueName: values.venueName,
      url: values.url,
    });
    if (result.ok) {
      list.replace(formatId, {
        id: formatId,
        type: values.type,
        label: values.label === "" ? null : values.label,
        venueName: values.venueName === "" ? null : values.venueName,
        url: values.url === "" ? null : values.url,
      });
    }
    return result;
  }

  async function handleDelete(format: LiveFormatLike): Promise<void> {
    if (format.id === undefined) return;
    const formatId = format.id;
    const snapshot = [...list.items];
    list.remove(formatId);
    setError(null);
    try {
      const result = await deleteLiveFormatAction(formatId);
      if (!result.ok) {
        list.reset(snapshot);
        setError(result.error ?? "포맷 삭제에 실패했습니다.");
      }
    } catch (err) {
      console.error("[LiveFormatsSection:handleDelete]", err);
      list.reset(snapshot);
      setError("포맷 삭제에 실패했습니다.");
    }
  }

  const action = (
    <Button size="sm" onClick={openCreate}>
      + 포맷 추가
    </Button>
  );

  return (
    <SectionCard
      title="포맷"
      description="현지 공연 · 라이브뷰잉 · 배포를 자유롭게 조합하세요."
      action={action}
    >
      {error ? (
        <p
          role="alert"
          className="mb-3 text-sm text-[color:var(--color-destructive)]"
        >
          {error}
        </p>
      ) : null}

      {list.items.length === 0 ? (
        <p className="text-sm text-[color:var(--color-muted-foreground)]">
          {EMPTY_MESSAGE}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.items.map((format) => {
            const key = format.id ?? `pending-${format.type}`;
            return (
              <li key={key}>
                <LiveFormatCard
                  format={format}
                  onEdit={() => openEdit(format)}
                  onDelete={() => handleDelete(format)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <LiveFormatDialog
        open={dialog.mode !== "closed"}
        onOpenChange={(next) => {
          if (!next) closeDialog();
        }}
        mode={dialog.mode === "edit" ? "edit" : "create"}
        initial={dialog.mode === "edit" ? dialog.format : undefined}
        onSubmit={dialog.mode === "edit" ? handleEdit : handleCreate}
      />
    </SectionCard>
  );
}
