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
