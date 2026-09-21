import { afterEach, describe, expect, it, vi } from "vitest";
import { EvaluationScheduler } from "./scheduler";

describe("EvaluationScheduler", () => {
  afterEach(() => vi.useRealTimers());

  it("runs despite continuous mutation signals", async () => {
    vi.useFakeTimers();
    const evaluate = vi.fn();
    const scheduler = new EvaluationScheduler(evaluate, {
      debounceMs: 900,
      maxWaitMs: 2_500,
      minIntervalMs: 5_000,
    });
    for (let elapsed = 0; elapsed < 3_000; elapsed += 500) {
      scheduler.schedule();
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(evaluate).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });

  it("throttles repeated settled-page evaluations", async () => {
    vi.useFakeTimers();
    const evaluate = vi.fn();
    const scheduler = new EvaluationScheduler(evaluate, {
      debounceMs: 100,
      maxWaitMs: 500,
      minIntervalMs: 1_000,
    });
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(100);
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(900);
    expect(evaluate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(evaluate).toHaveBeenCalledTimes(2);
    scheduler.dispose();
  });
});
