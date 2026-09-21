import {
  SESSION_STORAGE_KEY,
  type ExtensionRuntimeRequest,
  type ExtensionRuntimeResponse,
  type RuntimeRequest,
  type RuntimeResponse,
  type SessionCommand,
  type SessionSnapshot,
} from "@focus-guardian/contracts";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { remainingMs } from "../../src/session/model";

const durationOptions = [25, 50] as const;

async function sendCommand(command: SessionCommand): Promise<SessionSnapshot> {
  const request: RuntimeRequest = { kind: "session.command", command };
  const response = (await browser.runtime.sendMessage(request)) as RuntimeResponse;
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.snapshot;
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function App() {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({ status: "idle" });
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState(25);
  const [accessToken, setAccessToken] = useState("");
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSnapshot(await sendCommand({ type: "session.get" }));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your focus session");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const settingsRequest: ExtensionRuntimeRequest = { kind: "settings.get" };
    void browser.runtime.sendMessage(settingsRequest).then((response: ExtensionRuntimeResponse) => {
      if (response.ok && "settings" in response) setAccessToken(response.settings.accessToken);
    });
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    const handleStorageChange = (changes: Record<string, Browser.storage.StorageChange>) => {
      const change = changes[SESSION_STORAGE_KEY];
      if (change?.newValue) {
        setSnapshot(change.newValue as SessionSnapshot);
      }
    };
    browser.storage.local.onChanged.addListener(handleStorageChange);
    return () => {
      window.clearInterval(clock);
      browser.storage.local.onChanged.removeListener(handleStorageChange);
    };
  }, [refresh]);

  const activeRemaining = snapshot.status === "idle" ? 0 : remainingMs(snapshot.session, now);
  const progress = useMemo(() => {
    if (snapshot.status === "idle") return 0;
    const total = snapshot.session.durationMinutes * 60_000;
    return total === 0 ? 0 : Math.min(1, activeRemaining / total);
  }, [activeRemaining, snapshot]);

  async function run(command: SessionCommand) {
    setBusy(true);
    try {
      setSnapshot(await sendCommand(command));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something interrupted the timer");
    } finally {
      setBusy(false);
    }
  }

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (accessToken.trim()) {
      const settingsRequest: ExtensionRuntimeRequest = {
        kind: "settings.update",
        settings: { accessToken: accessToken.trim() },
      };
      await browser.runtime.sendMessage(settingsRequest);
    }
    await run({ type: "session.start", goal, durationMinutes: duration });
  }

  if (snapshot.status === "idle") {
    return (
      <main className="popup-shell idle-view">
        <header className="brand-row">
          <span className="brand-mark" aria-hidden="true" />
          <p className="eyebrow">Focus Guardian</p>
        </header>
        <section className="intro">
          <p className="kicker">One interval. One promise.</p>
          <h1>What deserves your full attention?</h1>
        </section>
        <form className="session-form" onSubmit={(event) => void handleStart(event)}>
          <label htmlFor="goal">Focus goal</label>
          <textarea
            id="goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            minLength={3}
            maxLength={280}
            placeholder="Finish the launch brief"
            required
          />
          <fieldset>
            <legend>Focus length</legend>
            <div className="duration-row">
              {durationOptions.map((minutes) => (
                <button
                  className={duration === minutes ? "duration active" : "duration"}
                  key={minutes}
                  type="button"
                  onClick={() => setDuration(minutes)}
                >
                  <strong>{minutes}</strong>
                  <span>min</span>
                </button>
              ))}
              <label className="custom-duration">
                <span>Custom</span>
                <input
                  aria-label="Custom duration in minutes"
                  type="number"
                  min={5}
                  max={180}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                />
              </label>
            </div>
          </fieldset>
          <details className="beta-access">
            <summary>Jev distraction guard</summary>
            <label htmlFor="access-token">Beta access key</label>
            <input
              id="access-token"
              type="password"
              autoComplete="off"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder="Paste your invite key"
            />
            <p>The timer works without a key. Page checks stay off until one is added.</p>
          </details>
          {error ? <p className="error" role="alert">{error}</p> : null}
          <button className="primary-action" type="submit" disabled={busy || goal.trim().length < 3}>
            Begin focus
          </button>
        </form>
      </main>
    );
  }

  const session = snapshot.session;
  const isComplete = snapshot.status === "completed";
  const isPaused = snapshot.status === "paused";
  const ringStyle = { "--progress": progress } as React.CSSProperties;

  return (
    <main className={`popup-shell timer-view state-${snapshot.status}`}>
      <header className="brand-row">
        <span className="brand-mark" aria-hidden="true" />
        <p className="eyebrow">{isComplete ? "Interval complete" : isPaused ? "Focus paused" : "Focus protected"}</p>
      </header>
      <section className="focus-seal" style={ringStyle} aria-label={`${formatTime(activeRemaining)} remaining`}>
        <svg viewBox="0 0 220 220" aria-hidden="true">
          <circle className="ring-track" cx="110" cy="110" r="96" />
          <circle className="ring-progress" cx="110" cy="110" r="96" pathLength="1" />
          <g className="tick-marks">
            {Array.from({ length: 12 }, (_, index) => (
              <line key={index} x1="110" y1="18" x2="110" y2="25" transform={`rotate(${index * 30} 110 110)`} />
            ))}
          </g>
        </svg>
        <div className="seal-content">
          <span className="timer-digits">{isComplete ? "Done" : formatTime(activeRemaining)}</span>
          <span className="timer-state">{isPaused ? "time held" : isComplete ? "promise kept" : "remaining"}</span>
        </div>
      </section>
      <section className="goal-card">
        <span>Your one intention</span>
        <h1>{session.goal}</h1>
      </section>
      <div className="session-meta" aria-label="Session statistics">
        <span>{session.durationMinutes} min interval</span>
        <span>{session.stats.interventionsShown} returns</span>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <div className="timer-actions">
        {isComplete ? (
          <button
            className="primary-action"
            type="button"
            onClick={() => void run({ type: "session.reset" })}
          >
            Start another
          </button>
        ) : (
          <>
            <button
              className="primary-action"
              type="button"
              disabled={busy}
              onClick={() => void run({ type: isPaused ? "session.resume" : "session.pause" })}
            >
              {isPaused ? "Resume focus" : "Pause"}
            </button>
            <button className="quiet-action" type="button" disabled={busy} onClick={() => void run({ type: "session.end" })}>
              End interval
            </button>
          </>
        )}
      </div>
    </main>
  );
}
