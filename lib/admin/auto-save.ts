/**
 * 자동저장 컨트롤러 (React 의존성 없음).
 *
 * - debounce(800ms) → save() 호출
 * - 실패 시 지수 백오프 (1s/3s/9s) — backoffMs.length 회 실제 재시도
 * - stale-guard: monotonic request id 로 늦게 도착한 이전 응답이 최신 상태를 덮어쓰지 않음
 * - 상태 머신: idle → dirty → saving → saved / error
 *
 * 본 컨트롤러는 순수 JS — useAutoSave 훅은 이 컨트롤러를 감싸는 얇은 wrapper.
 *
 * 주의: Server Action 자체는 AbortController 로 취소할 수 없다. 따라서
 *      "취소" 가 아니라 "stale response 무시" 방식으로 동시성 안전을 확보한다.
 */

/** 자동저장 상태 머신. */
export type AutoSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type AutoSaveState<TInput> = {
  status: AutoSaveStatus;
  lastSavedAt: string | null;
  error: Error | null;
  pending: TInput | null;
};

/**
 * Save 함수 결과.
 *
 * 일반적으로 discriminated union 이지만, 테스트/호출자가 boolean ok 만 채우는
 * 케이스도 허용하기 위해 느슨한 형태로 둔다.
 */
export type SaveResult = {
  ok: boolean;
  savedAt?: string;
  error?: string;
};

export type SaveFn<TInput> = (input: TInput) => Promise<SaveResult>;

export type AutoSaveOptions<TInput> = {
  save: SaveFn<TInput>;
  /** 디바운스 시간 (ms). 기본 800. */
  debounceMs?: number;
  /** 백오프 ms 배열. backoffMs.length 회 실제 재시도 수행. 기본 [1000, 3000, 9000]. */
  backoffMs?: number[];
};

export type AutoSaveController<TInput> = {
  submit: (input: TInput) => void;
  flush: () => void;
  retry: () => void;
  getState: () => AutoSaveState<TInput>;
  subscribe: (listener: (state: AutoSaveState<TInput>) => void) => () => void;
  /** 컴포넌트 unmount 시 호출 — 진행 중인 타이머/리스너 정리. */
  dispose: () => void;
};

/**
 * Auto-save controller 생성.
 *
 * 상태 전이 규약:
 *  - submit(input): 즉시 dirty 진입, 디바운스 타이머 (재)시작
 *  - 타이머 만료: saving 진입 → save() 호출
 *  - save() 성공: saved 로 전이, lastSavedAt 갱신 (stale-guard 통과 시)
 *  - save() 실패: 백오프 후 재시도. backoffMs.length 회 모두 실패하면 error.
 *  - 새 submit 도착: 진행 중인 백오프 / pending response 는 stale 로 무시.
 */
export function createAutoSaveController<TInput>(
  options: AutoSaveOptions<TInput>
): AutoSaveController<TInput> {
  const debounceMs = options.debounceMs ?? 800;
  const backoffMs = options.backoffMs ?? [1000, 3000, 9000];

  let state: AutoSaveState<TInput> = {
    status: "idle",
    lastSavedAt: null,
    error: null,
    pending: null,
  };
  const listeners = new Set<(state: AutoSaveState<TInput>) => void>();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let backoffTimer: ReturnType<typeof setTimeout> | null = null;

  // monotonic request id. 새 submit / retry 가 발생할 때마다 증가.
  let currentRequestId = 0;
  let attemptCount = 0;
  let disposed = false;

  function setState(patch: Partial<AutoSaveState<TInput>>): void {
    state = { ...state, ...patch };
    for (const fn of listeners) fn(state);
  }

  /**
   * 현재 pending 값을 1회 저장 시도.
   * `requestId` 는 현재 큐의 식별자. save() 도중 새 submit 이 발생해
   * currentRequestId 가 바뀌면 이 호출의 응답은 stale 로 폐기된다.
   */
  async function performSave(
    requestId: number,
    attempt: number
  ): Promise<void> {
    // stale-guard: 디바운스/백오프 timer 가 미처 clear 되지 못한 잔여 콜백 차단.
    if (disposed || requestId !== currentRequestId) return;

    const input = state.pending;
    if (input === null) {
      // 저장할 게 없는데 호출됐다면 — 방어적으로 idle 복귀.
      setState({ status: "idle" });
      return;
    }

    setState({ status: "saving", error: null });
    try {
      const result = await options.save(input);

      // 응답 도착 시점에 currentRequestId 가 바뀌었다면 무시.
      if (disposed || requestId !== currentRequestId) {
        return;
      }

      if (result.ok) {
        setState({
          status: "saved",
          lastSavedAt: result.savedAt ?? new Date().toISOString(),
          error: null,
          pending: null,
        });
        attemptCount = 0;
      } else {
        // 의미상 실패 — 재시도 대상.
        await handleFailure(
          requestId,
          attempt,
          new Error(result.error ?? "save failed")
        );
      }
    } catch (err) {
      if (disposed || requestId !== currentRequestId) {
        return;
      }
      await handleFailure(
        requestId,
        attempt,
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }

  async function handleFailure(
    requestId: number,
    attempt: number,
    error: Error
  ): Promise<void> {
    // backoffMs.length 회 모두 실패하면 더 이상 재시도 없음.
    // attempt 인덱스가 마지막을 넘어서면 (= 마지막 시도였다면) error 상태로 종료.
    if (attempt + 1 > backoffMs.length) {
      setState({ status: "error", error });
      attemptCount = 0;
      return;
    }
    // 다음 백오프 대기 후 재시도. backoffMs[attempt] 사용.
    const delay = backoffMs[attempt];
    setState({ status: "error", error });
    backoffTimer = setTimeout(() => {
      backoffTimer = null;
      // 그 사이 currentRequestId 가 바뀌었다면 (= 새 submit) 이 콜백은 stale.
      if (disposed || requestId !== currentRequestId) return;
      attemptCount = attempt + 1;
      void performSave(requestId, attempt + 1);
    }, delay);
  }

  function submit(input: TInput): void {
    if (disposed) return;
    // 새 입력 발생 — 이전 진행 중 응답/백오프 invalidate.
    currentRequestId += 1;
    attemptCount = 0;
    if (backoffTimer !== null) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    setState({ status: "dirty", pending: input, error: null });

    const reqId = currentRequestId;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void performSave(reqId, 0);
    }, debounceMs);
  }

  function flush(): void {
    if (disposed) return;
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (state.pending === null) {
      return;
    }
    const reqId = currentRequestId;
    void performSave(reqId, 0);
  }

  function retry(): void {
    if (disposed) return;
    if (state.pending === null) {
      return;
    }
    if (backoffTimer !== null) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }
    currentRequestId += 1;
    attemptCount = 0;
    const reqId = currentRequestId;
    void performSave(reqId, 0);
  }

  function getState(): AutoSaveState<TInput> {
    return state;
  }

  function subscribe(
    listener: (state: AutoSaveState<TInput>) => void
  ): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function dispose(): void {
    disposed = true;
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (backoffTimer !== null) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }
    listeners.clear();
  }

  return { submit, flush, retry, getState, subscribe, dispose };
}

/**
 * withRetry — 외부 비동기 함수에 지수 백오프 재시도를 적용.
 *
 * - 첫 호출은 즉시.
 * - 실패 시 `backoffMs[attempt]` 만큼 대기 후 재시도.
 * - `maxRetries` 회 이상 실패하면 마지막 에러를 throw.
 *
 * createAutoSaveController 내부에서도 사용 가능하나, 컨트롤러는 stale-guard 와
 * 상태 머신 통합을 위해 별도 구현을 사용한다.
 */
export type WithRetryOptions = {
  maxRetries: number;
  backoffMs: number[];
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // 마지막 시도면 더 대기하지 않고 즉시 throw.
      if (attempt + 1 >= options.maxRetries) {
        break;
      }
      const delay = options.backoffMs[attempt];
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError));
}
