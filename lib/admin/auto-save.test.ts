/**
 * 자동저장 컨트롤러 단위 테스트 (RED — 구현 전).
 *
 * 본 파일은 React 의존성 없이 **순수 컨트롤러** 를 검증한다.
 * (`useAutoSave` 훅은 이 컨트롤러를 감싸는 thin wrapper — 훅 자체는 E2E 로 통합 검증)
 *
 * 검증 대상:
 *  - createAutoSaveController({ save, debounceMs, backoff }):
 *      .submit(input)      : 새 입력 큐 (디바운스)
 *      .flush()            : 즉시 저장
 *      .retry()            : 수동 재시도
 *      .getState()         : 현재 상태 스냅샷
 *      .subscribe(listener): 상태 변경 알림
 *  - withRetry(fn, opts): 지수 백오프 (1s/3s/9s, max 3회)
 *
 * 핵심 행동:
 *  - 디바운스: 800ms 동안 추가 입력 시 타이머 리셋, 마지막 입력만 저장
 *  - 재시도: save() throw 시 백오프 후 재시도, 3회 초과 시 error 상태
 *  - stale-guard: 늦게 끝난 이전 응답이 최신 결과를 덮어쓰지 않음 (monotonic request-id)
 *  - 상태 머신: idle → dirty → saving → saved(idle) / error
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";

import { createAutoSaveController, withRetry } from "./auto-save";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("withRetry — 지수 백오프 재시도", () => {
  it("1회 실패 후 1s 대기 → 성공", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("transient");
      return "ok";
    });

    const promise = withRetry(fn, { maxRetries: 3, backoffMs: [1000, 3000, 9000] });
    // 첫 호출은 즉시
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // 1s 후 재시도
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("2회 실패 후 3s 대기 → 성공 (총 1+3=4s 대기)", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error("transient");
      return "ok";
    });

    const promise = withRetry(fn, { maxRetries: 3, backoffMs: [1000, 3000, 9000] });
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(3000);
    const result = await promise;
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("3회 모두 실패 시 마지막 에러 throw", async () => {
    const fn = vi.fn(async () => {
      throw new Error("permanent");
    });

    const promise = withRetry(fn, { maxRetries: 3, backoffMs: [1000, 3000, 9000] });

    // promise 가 reject 되도록 명시적 catch
    const rejection = expect(promise).rejects.toThrow("permanent");

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(9000);

    await rejection;
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("createAutoSaveController — 디바운스", () => {
  it("초기 상태는 idle", () => {
    const controller = createAutoSaveController({
      save: vi.fn(),
      debounceMs: 800,
    });
    expect(controller.getState().status).toBe("idle");
  });

  it("submit 직후 상태가 dirty 로 전이", () => {
    const controller = createAutoSaveController({
      save: vi.fn().mockResolvedValue({ ok: true, savedAt: new Date().toISOString() }),
      debounceMs: 800,
    });
    controller.submit({ titleKo: "변경" });
    expect(controller.getState().status).toBe("dirty");
  });

  it("800ms 후 save 가 1회 호출", async () => {
    const save = vi
      .fn()
      .mockResolvedValue({ ok: true, savedAt: new Date().toISOString() });
    const controller = createAutoSaveController({
      save,
      debounceMs: 800,
    });

    controller.submit({ titleKo: "변경" });

    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ titleKo: "변경" });
  });

  it("디바운스 동안 추가 입력 시 타이머 리셋, 마지막 값만 저장", async () => {
    const save = vi
      .fn()
      .mockResolvedValue({ ok: true, savedAt: new Date().toISOString() });
    const controller = createAutoSaveController({ save, debounceMs: 800 });

    controller.submit({ titleKo: "v1" });
    await vi.advanceTimersByTimeAsync(500);
    controller.submit({ titleKo: "v2" });
    await vi.advanceTimersByTimeAsync(500);
    controller.submit({ titleKo: "v3" });

    // v3 submit 시점부터 800ms 가 지나야 save 호출
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ titleKo: "v3" });
  });

  it("save 성공 시 status: saved, lastSavedAt 갱신", async () => {
    const savedAtIso = "2026-03-15T09:00:00.000Z";
    const save = vi.fn().mockResolvedValue({ ok: true, savedAt: savedAtIso });
    const controller = createAutoSaveController({ save, debounceMs: 800 });

    controller.submit({ titleKo: "변경" });
    await vi.advanceTimersByTimeAsync(800);
    // microtask flush
    await vi.advanceTimersByTimeAsync(0);

    const state = controller.getState();
    expect(state.status).toBe("saved");
    expect(state.lastSavedAt).toBe(savedAtIso);
  });

  it("flush() 호출 시 디바운스 무시하고 즉시 저장", async () => {
    const save = vi
      .fn()
      .mockResolvedValue({ ok: true, savedAt: new Date().toISOString() });
    const controller = createAutoSaveController({ save, debounceMs: 800 });

    controller.submit({ titleKo: "v1" });
    controller.flush();
    await vi.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ titleKo: "v1" });
  });
});

describe("createAutoSaveController — 재시도", () => {
  it("save throw 시 백오프 후 재시도", async () => {
    let calls = 0;
    const save = vi.fn(async (input: unknown) => {
      calls += 1;
      if (calls < 2) throw new Error("network");
      return { ok: true, savedAt: "2026-03-15T09:00:00.000Z" };
    });
    const controller = createAutoSaveController({
      save,
      debounceMs: 800,
      backoffMs: [1000, 3000, 9000],
    });

    controller.submit({ titleKo: "변경" });
    await vi.advanceTimersByTimeAsync(800);
    // 첫 호출 (실패)
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);

    // 1s 대기 → 재시도 → 성공
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(2);
    expect(controller.getState().status).toBe("saved");
  });

  it("backoffMs.length 회 재시도 모두 실패 시 status: error", async () => {
    // backoffMs=[1000, 3000, 9000] → 첫 시도 + 3회 재시도 = 총 4회 save 호출.
    // 각 실패 후 backoffMs[attempt] 만큼 대기. 마지막 시도 실패 시 error 상태.
    const save = vi.fn().mockRejectedValue(new Error("permanent"));
    const controller = createAutoSaveController({
      save,
      debounceMs: 800,
      backoffMs: [1000, 3000, 9000],
    });

    controller.submit({ titleKo: "변경" });

    // 디바운스 → 첫 시도 (attempt=0)
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);

    // 1000ms 대기 → 2번째 시도 (attempt=1)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);

    // 3000ms 대기 → 3번째 시도 (attempt=2)
    await vi.advanceTimersByTimeAsync(3000);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(3);

    // 9000ms 대기 → 4번째 시도 (attempt=3) — 마지막
    await vi.advanceTimersByTimeAsync(9000);
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(4);

    // 마지막 시도 실패 → error 상태로 종료.
    expect(controller.getState().status).toBe("error");
    expect(controller.getState().error).toBeTruthy();
  });

  it("retry() 호출 시 백오프 무시하고 즉시 재시도", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockResolvedValueOnce({ ok: true, savedAt: "2026-03-15T09:00:00.000Z" });
    const controller = createAutoSaveController({
      save,
      debounceMs: 800,
      backoffMs: [1000, 3000, 9000],
    });

    controller.submit({ titleKo: "변경" });
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(0);
    // 첫 시도 실패. 백오프 대기 중...
    expect(save).toHaveBeenCalledTimes(1);

    // 사용자 즉시 재시도
    controller.retry();
    await vi.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(2);
    expect(controller.getState().status).toBe("saved");
  });
});

describe("createAutoSaveController — stale-guard (monotonic request id)", () => {
  it("늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않는다", async () => {
    // 첫 save 는 의도적으로 느리게 응답 (200ms),
    // 두 번째 save 는 빠르게 응답 (10ms).
    let resolveFirst!: (v: { ok: true; savedAt: string }) => void;
    const firstPromise = new Promise<{ ok: true; savedAt: string }>(
      (resolve) => {
        resolveFirst = resolve;
      }
    );

    const save = vi
      .fn()
      // 1번째 호출: 대기 promise
      .mockImplementationOnce(() => firstPromise)
      // 2번째 호출: 즉시 응답
      .mockResolvedValueOnce({
        ok: true,
        savedAt: "2026-03-15T09:00:02.000Z",
      });

    const controller = createAutoSaveController({ save, debounceMs: 800 });

    // 첫 submit → 첫 save 호출
    controller.submit({ titleKo: "v1" });
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(1);

    // 새 submit (이전 in-flight 동안)
    controller.submit({ titleKo: "v2" });
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledTimes(2);

    // 2번째 save 의 응답이 먼저 dispatch
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.getState().lastSavedAt).toBe(
      "2026-03-15T09:00:02.000Z"
    );

    // 이제 1번째 save 응답이 도착 (늦게)
    resolveFirst({ ok: true, savedAt: "2026-03-15T09:00:01.000Z" });
    await vi.advanceTimersByTimeAsync(0);

    // stale-guard 가 동작하여 lastSavedAt 은 최신(2초)이 유지된다
    expect(controller.getState().lastSavedAt).toBe(
      "2026-03-15T09:00:02.000Z"
    );
  });
});

describe("createAutoSaveController — subscribe", () => {
  it("상태 변경 시 listener 호출", async () => {
    const save = vi
      .fn()
      .mockResolvedValue({ ok: true, savedAt: "2026-03-15T09:00:00.000Z" });
    const controller = createAutoSaveController({ save, debounceMs: 800 });

    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    controller.submit({ titleKo: "변경" });
    // 최소 1회 (dirty 진입) 호출됨
    expect(listener).toHaveBeenCalled();

    listener.mockClear();
    await vi.advanceTimersByTimeAsync(800);
    await vi.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalled();

    unsubscribe();
    listener.mockClear();
    controller.submit({ titleKo: "다시" });
    expect(listener).not.toHaveBeenCalled();
  });
});
