/**
 * 공통 유틸리티.
 *
 * `cn()`: clsx + tailwind-merge 조합. Tailwind 클래스 충돌 시 후순위 우선.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 값이 양의 정수인지 판별 (id 검증 등에 사용). */
export function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** 장소명(+주소)으로 구글맵 검색 URL 생성. */
export function googleMapsSearchUrl(...parts: (string | null | undefined)[]): string {
  const query = parts.filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
