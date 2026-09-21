import { describe, expect, it } from "vitest";
import { createSession } from "../session/model";
import { evaluationCacheKey, matchesSession } from "./identity";

describe("evaluation identity", () => {
  it("rejects a result from a previous focus session", () => {
    const current = {
      status: "running" as const,
      session: createSession({ id: "new", goal: "New goal", durationMinutes: 25 }, 0),
    };
    expect(matchesSession(current, "old")).toBe(false);
    expect(matchesSession(current, "new")).toBe(true);
  });

  it("changes the cache key after an override", () => {
    const session = createSession({ id: "one", goal: "Write", durationMinutes: 25 }, 0);
    const before = evaluationCacheKey(session, "page");
    const after = evaluationCacheKey(
      { ...session, stats: { ...session.stats, overrides: 1 } },
      "page",
    );
    expect(after).not.toBe(before);
  });
});
