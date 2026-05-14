/**
 * useSectionList — 어드민 섹션 리스트 낙관적(optimistic) 상태 훅.
 *
 * 서버 액션 호출 전 UI 를 즉시 업데이트하고, 성공 후 `reset(serverItems)` 으로
 * 서버 진실(server truth)과 재동기화한다. 실패 시 동일하게 `reset` 으로 롤백.
 */
"use client";

import { useCallback, useState } from "react";

export interface UseSectionListResult<T> {
  items: T[];
  add: (item: T) => void;
  remove: (key: string | number) => void;
  replace: (key: string | number, next: T) => void;
  reset: (next: T[]) => void;
  reorder: (keys: (string | number)[]) => void;
}

export function useSectionList<T>(
  initial: T[],
  getKey: (item: T) => string | number
): UseSectionListResult<T> {
  const [items, setItems] = useState<T[]>(initial);

  const add = useCallback((item: T) => {
    setItems((prev) => [...prev, item]);
  }, []);

  const remove = useCallback(
    (key: string | number) => {
      setItems((prev) => prev.filter((item) => getKey(item) !== key));
    },
    [getKey]
  );

  const replace = useCallback(
    (key: string | number, next: T) => {
      setItems((prev) =>
        prev.map((item) => (getKey(item) === key ? next : item))
      );
    },
    [getKey]
  );

  const reset = useCallback((next: T[]) => {
    setItems(next);
  }, []);

  const reorder = useCallback(
    (keys: (string | number)[]) => {
      setItems((prev) => {
        const byKey = new Map<string | number, T>();
        for (const item of prev) {
          byKey.set(getKey(item), item);
        }

        const ordered: T[] = [];
        const usedKeys = new Set<string | number>();
        for (const key of keys) {
          const item = byKey.get(key);
          if (item !== undefined) {
            ordered.push(item);
            usedKeys.add(key);
          }
        }

        // keys 에 포함되지 않은 항목은 원래 순서대로 뒤에 보존
        for (const item of prev) {
          if (!usedKeys.has(getKey(item))) {
            ordered.push(item);
          }
        }

        return ordered;
      });
    },
    [getKey]
  );

  return { items, add, remove, replace, reset, reorder };
}
