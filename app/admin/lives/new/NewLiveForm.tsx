"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import {
  LiveHeaderFields,
  type LiveHeaderFieldValues,
} from "../_components/LiveHeaderFields";

import {
  createLiveHeaderAction,
  type CreateLiveHeaderState,
} from "./actions";

/**
 * 신규 라이브 헤더 등록 폼.
 *
 * - controlled inputs: React 19 의 `<form action>` 가 폼을 재렌더할 때 입력값이
 *   유실되는 케이스를 피하기 위해 useState 로 폼 값을 관리한다.
 * - `useActionState` 로 Server Action 결과를 폼에 연결.
 * - 성공 시 Server Action 측에서 redirect → 클라이언트 코드는 도달하지 않음.
 * - 실패 시 fieldErrors 를 인라인으로 표시.
 *
 * 폼 필드 자체는 `LiveHeaderFields` 공용 컴포넌트로 추출 — 자동저장 섹션과 공유.
 */
const INITIAL_STATE: CreateLiveHeaderState = undefined;

const INITIAL_FORM: LiveHeaderFieldValues = {
  titleKo: "",
  titleJp: "",
  titleEn: "",
  type: "SOLO",
  startAtJst: "",
  doorsOpenAtJst: "",
  endAtJst: "",
  venueName: "",
  venueAddress: "",
  venueUrl: "",
  slug: "",
  notes: "",
};

export default function NewLiveForm() {
  const [form, setForm] = useState<LiveHeaderFieldValues>(INITIAL_FORM);
  const [state, formAction, isPending] = useActionState<
    CreateLiveHeaderState,
    FormData
  >(createLiveHeaderAction, INITIAL_STATE);

  const errors = state?.ok === false ? state.fieldErrors ?? {} : {};

  function update<K extends keyof LiveHeaderFieldValues>(
    key: K,
    value: LiveHeaderFieldValues[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <LiveHeaderFields
        values={form}
        onChange={update}
        errors={errors}
        slugMode="required"
        includeNotes
      />

      {state?.ok === false && state.error ? (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-destructive)]"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "저장 중..." : "저장"}
        </Button>
        <Link
          href="/admin/lives"
          className="text-sm text-[color:var(--color-muted-foreground)] hover:underline"
        >
          취소
        </Link>
      </div>
    </form>
  );
}
