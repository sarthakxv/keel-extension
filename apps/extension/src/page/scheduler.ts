interface SchedulerOptions {
  debounceMs: number;
  maxWaitMs: number;
  minIntervalMs: number;
}

export class EvaluationScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private firstSignalAt: number | undefined;
  private lastRunAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly evaluate: () => void | Promise<void>,
    private readonly options: SchedulerOptions,
  ) {}

  schedule(): void {
    const now = Date.now();
    this.firstSignalAt ??= now;
    const debounceAt = now + this.options.debounceMs;
    const maxWaitAt = this.firstSignalAt + this.options.maxWaitMs;
    const throttleAt = this.lastRunAt + this.options.minIntervalMs;
    const runAt = Math.max(now, throttleAt, Math.min(debounceAt, maxWaitAt));
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), runAt - now);
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.firstSignalAt = undefined;
  }

  dispose(): void {
    this.cancel();
  }

  private flush(): void {
    this.timer = undefined;
    this.firstSignalAt = undefined;
    this.lastRunAt = Date.now();
    void this.evaluate();
  }
}
