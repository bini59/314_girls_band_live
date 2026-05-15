"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * ThumbnailField — 어드민 공용 섬네일/이미지 URL 입력.
 *
 * - URL 텍스트 입력 + 라이브 미리보기 (이미지 로드 실패 시 fallback 메시지).
 * - 빈 문자열이면 placeholder 박스만 표시 (입력 유도).
 * - DESIGN.md 토큰만 사용.
 */
export interface ThumbnailFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  /** 미리보기 가로 비율 (aspect). 기본 1:1. */
  aspect?: "square" | "16/9" | "3/4";
}

const ASPECT_CLASS: Record<NonNullable<ThumbnailFieldProps["aspect"]>, string> =
  {
    square: "aspect-square",
    "16/9": "aspect-[16/9]",
    "3/4": "aspect-[3/4]",
  };

export function ThumbnailField({
  id,
  name,
  label,
  value,
  onChange,
  hint,
  error,
  disabled,
  placeholder = "https://...",
  aspect = "square",
}: ThumbnailFieldProps) {
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    setLoadError(false);
  }, [value]);

  const trimmed = value.trim();
  const isHttp = /^https?:\/\//i.test(trimmed);
  const showPreview = isHttp && !loadError;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-start gap-3">
        <div
          className={`${ASPECT_CLASS[aspect]} w-24 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[color:var(--color-surface-2)] shadow-[var(--shadow-input)]`}
          aria-hidden={!showPreview}
        >
          {showPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={trimmed}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setLoadError(true)}
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-[color:var(--color-muted-foreground)]">
              {trimmed.length === 0
                ? "미리보기"
                : loadError
                  ? "로드 실패"
                  : "URL 확인"}
            </div>
          )}
        </div>
        <div className="flex-1">
          <Input
            id={id}
            name={name}
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            aria-invalid={!!error}
          />
          {hint && !error ? (
            <p className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">
              {hint}
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="mt-1 text-xs text-[color:var(--color-destructive)]"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
