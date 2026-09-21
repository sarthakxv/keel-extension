import { describe, expect, it, vi } from "vitest";
import {
  evaluationFailureKind,
  hashIdentifier,
  logEvent,
  requestLogFields,
  serializeError,
} from "./log";

const request = {
  requestId: "11111111-1111-4111-8111-111111111111",
  goal: "Write the quarterly report",
  minutesRemaining: 18,
  page: {
    hostname: "docs.example.com",
    title: "Secret draft",
    excerpt: "Do not log this excerpt at all",
  },
  allowedExamples: [{ hostname: "linear.app", title: "Issues" }],
};

describe("API diagnostic log fields", () => {
  it("keeps request metadata and drops goal, title, and excerpt", () => {
    const fields = requestLogFields(request);
    expect(fields).toEqual({
      requestId: request.requestId,
      hostname: "docs.example.com",
      titleChars: 12,
      excerptChars: 30,
      minutesRemaining: 18,
      allowedExamples: 1,
    });
    const serialized = JSON.stringify(fields);
    expect(serialized).not.toContain(request.goal);
    expect(serialized).not.toContain(request.page.title);
    expect(serialized).not.toContain(request.page.excerpt);
  });

  it("hashes identifiers instead of logging them raw", () => {
    const hashed = hashIdentifier("9c0e1d02-5a7b-4c3d-91e8-abcdef123456");
    expect(hashed).toMatch(/^[a-f0-9]{12}$/);
    expect(hashed).not.toContain("9c0e1d02");
  });

  it("classifies timeouts and incomplete Jev answers", () => {
    const controller = new AbortController();
    controller.abort();
    expect(evaluationFailureKind(new Error("aborted"), controller.signal)).toBe("timeout");
    const abortError = new Error("Aborted");
    abortError.name = "AbortError";
    expect(evaluationFailureKind(abortError, new AbortController().signal)).toBe("timeout");
    expect(evaluationFailureKind(new Error("Jev returned an incomplete evaluation"), new AbortController().signal)).toBe(
      "incomplete",
    );
    expect(evaluationFailureKind(new Error("Gateway 403"), new AbortController().signal)).toBe("error");
  });

  it("serializes nested causes without dumping a huge payload", () => {
    const error = new Error("Jev failed");
    error.cause = new Error("zero data retention is not supported on this plan");
    expect(serializeError(error)).toEqual({
      name: "Error",
      message: "Jev failed: zero data retention is not supported on this plan",
    });
    expect(serializeError({ surprise: true })).toEqual({
      name: "UnknownError",
      message: "[object Object]",
    });
    expect(serializeError(new Error("x".repeat(600))).message).toHaveLength(500);
  });

  it("writes one JSON object per event", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logEvent("error", "evaluation.failed", { kind: "timeout", requestId: "abc" });
    expect(JSON.parse(String(spy.mock.calls[0]?.[0]))).toEqual({
      level: "error",
      event: "evaluation.failed",
      kind: "timeout",
      requestId: "abc",
    });
    spy.mockRestore();
  });
});
