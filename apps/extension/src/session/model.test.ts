import { describe, expect, it } from "vitest";
import {
  createSession,
  endSnapshot,
  pauseSnapshot,
  reconcileSnapshot,
  remainingMs,
  resumeSnapshot,
} from "./model";

describe("focus session model", () => {
  it("derives remaining time from the absolute deadline", () => {
    const session = createSession({ id: "one", goal: "Write the brief", durationMinutes: 25 }, 1_000);
    expect(remainingMs(session, 61_000)).toBe(24 * 60_000);
  });

  it("preserves remaining time through pause and resume", () => {
    const session = createSession({ id: "one", goal: "Write the brief", durationMinutes: 25 }, 0);
    const paused = pauseSnapshot({ status: "running", session }, 5 * 60_000);
    expect(paused.status).toBe("paused");
    if (paused.status !== "paused") throw new Error("Expected paused session");
    expect(paused.session.pausedRemainingMs).toBe(20 * 60_000);

    const resumed = resumeSnapshot(paused, 10 * 60_000);
    expect(resumed.status).toBe("running");
    if (resumed.status !== "running") throw new Error("Expected running session");
    expect(resumed.session.endsAt).toBe(30 * 60_000);
  });

  it("completes an expired running session", () => {
    const session = createSession({ id: "one", goal: "Write the brief", durationMinutes: 5 }, 0);
    const completed = reconcileSnapshot({ status: "running", session }, 5 * 60_000 + 1);
    expect(completed.status).toBe("completed");
    if (completed.status !== "completed") throw new Error("Expected completed session");
    expect(completed.session.goal).toBe("");
  });

  it("ends a session without preserving temporary examples", () => {
    const session = {
      ...createSession({ id: "one", goal: "Write the brief", durationMinutes: 25 }, 0),
      allowedExamples: [{ hostname: "example.com", title: "Reference" }],
    };
    const ended = endSnapshot({ status: "running", session }, 2_000);
    expect(ended.status).toBe("completed");
    if (ended.status !== "completed") throw new Error("Expected completed session");
    expect(ended.session.allowedExamples).toEqual([]);
    expect(ended.session.goal).toBe("");
  });
});
