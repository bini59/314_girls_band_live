/**
 * Combobox — 디바운스 비동기 검색 콤보박스. 밴드 picker 등에 사용.
 * ARIA combobox/listbox 패턴, 키보드 네비게이션 지원.
 */
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface ComboboxProps<T> {
  value: T | null;
  onChange: (item: T | null) => void;
  onSearch: (query: string) => Promise<T[]>;
  getKey: (item: T) => string | number;
  getLabel: (item: T) => string;
  getDescription?: (item: T) => string;
  debounceMs?: number;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
  className?: string;
}

export function Combobox<T>({
  value,
  onChange,
  onSearch,
  getKey,
  getLabel,
  getDescription,
  debounceMs = 300,
  placeholder = "검색…",
  disabled = false,
  emptyText = "결과 없음",
  className,
}: ComboboxProps<T>): React.ReactElement {
  const reactId = React.useId();
  const listboxId = `${reactId}-listbox`;
  const optionIdPrefix = `${reactId}-option`;

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [focused, setFocused] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const requestIdRef = React.useRef(0);

  // outside click → close
  React.useEffect(() => {
    if (!open) return;

    function handleClick(event: MouseEvent): void {
      const target = event.target as Node | null;
      if (target && containerRef.current && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // 디바운스 검색
  React.useEffect(() => {
    if (!open) return;

    const handle = setTimeout(() => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      onSearch(query)
        .then((items) => {
          if (requestId !== requestIdRef.current) return;
          setResults(items);
          setActiveIndex(items.length > 0 ? 0 : -1);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setResults([]);
          setActiveIndex(-1);
        })
        .finally(() => {
          if (requestId !== requestIdRef.current) return;
          setLoading(false);
        });
    }, debounceMs);

    return () => clearTimeout(handle);
  }, [query, open, debounceMs, onSearch]);

  function handleSelect(item: T): void {
    onChange(item);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((prev) =>
        results.length === 0 ? -1 : (prev + 1) % results.length
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((prev) =>
        results.length === 0 ? -1 : (prev - 1 + results.length) % results.length
      );
    } else if (event.key === "Enter") {
      if (open && activeIndex >= 0 && activeIndex < results.length) {
        event.preventDefault();
        handleSelect(results[activeIndex]);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    } else if (event.key === "Backspace" && query === "" && value) {
      // 빈 쿼리에서 백스페이스 → 선택 해제
      onChange(null);
    }
  }

  // input 표시값: focus 중이거나 선택 없음 → query, 아니면 선택된 라벨
  const displayValue = focused || !value ? query : getLabel(value);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", className)}
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? `${optionIdPrefix}-${activeIndex}` : undefined
        }
        disabled={disabled}
        placeholder={placeholder}
        value={displayValue}
        onChange={(event) => {
          setQuery(event.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-10 w-full rounded-[var(--radius-sm)] bg-[color:var(--color-surface-2)] px-3 py-2 text-sm text-[color:var(--color-foreground)] outline-none transition-shadow placeholder:text-[color:var(--color-muted-foreground)] shadow-[var(--shadow-input)] focus-visible:shadow-[var(--shadow-input-focus)] disabled:cursor-not-allowed disabled:opacity-60"
        )}
      />

      {loading ? (
        <span
          data-testid="combobox-loading"
          aria-hidden="true"
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--color-muted-foreground)] border-t-transparent"
        />
      ) : null}

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-[var(--radius-lg)] bg-[color:var(--color-surface-2)] py-1 text-sm shadow-[var(--shadow-dialog)]"
        >
          {results.length === 0 && !loading ? (
            <li
              role="option"
              aria-selected="false"
              aria-disabled="true"
              className="px-3 py-2 text-[color:var(--color-muted-foreground)]"
            >
              {emptyText}
            </li>
          ) : (
            results.map((item, index) => {
              const isActive = index === activeIndex;
              return (
                <li
                  key={getKey(item)}
                  id={`${optionIdPrefix}-${index}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseDown={(event) => {
                    // input blur 보다 먼저 selection 처리
                    event.preventDefault();
                    handleSelect(item);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "cursor-pointer px-3 py-2",
                    isActive
                      ? "bg-[color:var(--color-muted)] text-[color:var(--color-foreground)]"
                      : "text-[color:var(--color-foreground)]"
                  )}
                >
                  <div className="font-medium">{getLabel(item)}</div>
                  {getDescription ? (
                    <div className="text-xs text-[color:var(--color-muted-foreground)]">
                      {getDescription(item)}
                    </div>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
