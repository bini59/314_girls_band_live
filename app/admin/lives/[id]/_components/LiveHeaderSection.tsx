"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Live } from "@prisma/client";

import {
  createAutoSaveController,
  type AutoSaveState,
} from "@/lib/admin/auto-save";
import { utcToJstLocal } from "@/lib/admin/jst-datetime";

import {
  LiveHeaderFields,
  type LiveHeaderFieldValues,
} from "../../_components/LiveHeaderFields";

import {
  updateLiveHeaderAction,
  type UpdateLiveHeaderInput,
  type UpdateLiveHeaderResult,
} from "../actions";
import { AutoSaveIndicator } from "./AutoSaveIndicator";

/**
 * 헤더 섹션 — 자동저장.
 *
 * - createAutoSaveController 로 디바운스(800ms) + stale-guard + 백오프 재시도.
 * - 각 필드 onChange 마다 controller.submit(변경 필드 patch) 호출 (변경된 필드만 전송).
 * - Server Action 응답을 컨트롤러 형식 ({ ok, savedAt } | { ok: false, error }) 으로 매핑.
 * - 컴포넌트 unmount 시 controller.dispose() 로 잔여 타이머/리스너 정리.
 */
export function LiveHeaderSection({ live }: { live: Live }) {
  // 초기 폼 상태는 서버에서 받은 Live 를 JST datetime-local 로 변환.
  const initial = useMemo<LiveHeaderFieldValues>(
    () => ({
      titleKo: live.titleKo,
      titleJp: live.titleJp,
      titleEn: live.titleEn ?? "",
      type: live.type,
      startAtJst: utcToJstLocal(live.startAt),
      doorsOpenAtJst: live.doorsOpenAt ? utcToJstLocal(live.doorsOpenAt) : "",
      endAtJst: live.endAt ? utcToJstLocal(live.endAt) : "",
      venueName: live.venueName,
      venueAddress: live.venueAddress ?? "",
      venueUrl: live.venueUrl ?? "",
      slug: live.slug,
      notes: live.notes ?? "",
    }),
    [live]
  );

  const [form, setForm] = useState<LiveHeaderFieldValues>(initial);
  const [saveState, setSaveState] = useState<
    AutoSaveState<UpdateLiveHeaderInput>
  >({
    status: "idle",
    lastSavedAt: null,
    error: null,
    pending: null,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // 항상 최신 liveId 와 fieldErrors setter 를 컨트롤러 save 콜백에서 참조.
  const liveIdRef = useRef(live.id);
  liveIdRef.current = live.id;

  // 컨트롤러는 mount 시 단 1회 생성 — useState 의 lazy initializer 로 안정 보장.
  // (useRef + null guard 패턴은 React StrictMode 의 이중 effect 와 충돌 위험.)
  const [controller] = useState(() =>
    createAutoSaveController<UpdateLiveHeaderInput>({
      debounceMs: 800,
      save: async (input) => {
        const result: UpdateLiveHeaderResult = await updateLiveHeaderAction(
          liveIdRef.current,
          input
        );
        if (result.ok) {
          // 다음 save 호출 시 fieldErrors 클리어.
          setFieldErrors({});
          return { ok: true, savedAt: result.savedAt };
        }
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        return {
          ok: false,
          error: result.error ?? "저장 실패",
        };
      },
    })
  );

  useEffect(() => {
    const unsub = controller.subscribe((s) => setSaveState({ ...s }));
    return () => {
      unsub();
      controller.dispose();
    };
  }, [controller]);

  function setField<K extends keyof LiveHeaderFieldValues>(
    key: K,
    value: LiveHeaderFieldValues[K]
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }));
    // 변경된 필드만 patch 로 전송 (네트워크/서버 처리 최소화).
    // UpdateLiveHeaderInput 의 키는 LiveHeaderFieldValues 와 동일 — 안전 캐스트.
    controller.submit({
      [key]: value,
    } as UpdateLiveHeaderInput);
  }

  return (
    <section
      aria-labelledby="header-section"
      className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 id="header-section" className="text-lg font-semibold">
          헤더
        </h2>
        <AutoSaveIndicator
          status={saveState.status}
          lastSavedAt={saveState.lastSavedAt}
          onRetry={() => controller.retry()}
        />
      </div>

      <LiveHeaderFields
        values={form}
        onChange={setField}
        errors={fieldErrors}
        slugMode="optional"
      />
    </section>
  );
}
