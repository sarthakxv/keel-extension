import { createHash } from "node:crypto";
import type { EvaluationRequest } from "@keel/contracts";

type LogValue = string | number | boolean | null;
type LogFields = Record<string, LogValue | undefined>;

export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function requestLogFields(input: EvaluationRequest): LogFields {
  return {
    requestId: input.requestId,
    hostname: input.page.hostname,
    titleChars: input.page.title.length,
    excerptChars: input.page.excerpt.length,
    minutesRemaining: input.minutesRemaining,
    allowedExamples: input.allowedExamples.length,
  };
}

export function serializeError(error: unknown): { name: string; message: string } {
  if (!(error instanceof Error)) {
    return { name: "UnknownError", message: String(error).slice(0, 500) };
  }

  const cause = error.cause instanceof Error ? error.cause.message : undefined;
  const message = cause ? `${error.message}: ${cause}` : error.message;
  return {
    name: error.name || "Error",
    message: message.slice(0, 500),
  };
}

export function evaluationFailureKind(
  error: unknown,
  signal: AbortSignal,
): "timeout" | "incomplete" | "error" {
  if (signal.aborted || (error instanceof Error && error.name === "AbortError")) {
    return "timeout";
  }
  if (error instanceof Error && error.message.includes("incomplete evaluation")) {
    return "incomplete";
  }
  return "error";
}

export function logEvent(level: "info" | "warn" | "error", event: string, fields: LogFields = {}) {
  const payload: Record<string, LogValue> = { level, event };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) payload[key] = value;
  }
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
