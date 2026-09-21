import { z } from "zod";

export const goalSchema = z.string().trim().min(3).max(280);
export const durationMinutesSchema = z.number().int().min(5).max(180);

export type SessionStatus = "idle" | "running" | "paused" | "completed";

export interface FocusSession {
  id: string;
  goal: string;
  durationMinutes: number;
  status: Exclude<SessionStatus, "idle">;
  startedAt: number;
  endsAt: number | null;
  pausedRemainingMs: number | null;
  completedAt: number | null;
  revision: number;
  interventionTimestamps: number[];
  allowedExamples: Array<{ hostname: string; title: string }>;
  stats: {
    pagesEvaluated: number;
    interventionsShown: number;
    overrides: number;
  };
}

export type SessionSnapshot =
  | { status: "idle" }
  | { status: "running" | "paused" | "completed"; session: FocusSession };

export type SessionCommand =
  | { type: "session.start"; goal: string; durationMinutes: number }
  | { type: "session.pause" }
  | { type: "session.resume" }
  | { type: "session.end" }
  | { type: "session.get" };

export type RuntimeRequest = {
  kind: "session.command";
  command: SessionCommand;
};

export type RuntimeResponse =
  | { ok: true; snapshot: SessionSnapshot }
  | { ok: false; error: string };

export const SESSION_STORAGE_KEY = "focus-guardian:session";
export const SESSION_ALARM_NAME = "focus-guardian:session-end";
