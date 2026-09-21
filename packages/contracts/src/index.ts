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
export const SETTINGS_STORAGE_KEY = "focus-guardian:settings";

export const allowedExampleSchema = z.object({
  hostname: z.string().trim().min(1).max(253),
  title: z.string().trim().max(200),
});

export const pageContextSchema = z.object({
  hostname: z.string().trim().min(1).max(253),
  title: z.string().trim().max(200),
  excerpt: z.string().trim().max(1_500),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});

export type PageContext = z.infer<typeof pageContextSchema>;

export const alignmentSchema = z.enum([
  "on_task",
  "useful_detour",
  "off_task",
  "insufficient_evidence",
]);

export const evaluationRequestSchema = z
  .object({
    requestId: z.string().uuid(),
    goal: goalSchema,
    minutesRemaining: z.number().min(0).max(180),
    page: pageContextSchema.omit({ fingerprint: true }),
    allowedExamples: z.array(allowedExampleSchema).max(3),
  })
  .strict();

export const evaluationResponseSchema = z
  .object({
    evaluationId: z.string().uuid(),
    alignment: z.object({
      value: alignmentSchema,
      probabilities: z.record(alignmentSchema, z.number().min(0).max(1)),
    }),
    distraction: z.object({
      value: z.boolean(),
      probability: z.number().min(0).max(1),
    }),
    model: z.string().min(1),
    evaluatedAt: z.string().datetime(),
  })
  .strict();

export type EvaluationRequest = z.infer<typeof evaluationRequestSchema>;
export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;

export type FocusAction =
  | { type: "allow" }
  | { type: "toast"; evaluationId: string }
  | { type: "interstitial"; evaluationId: string; delaySeconds: 5 | 15 };

export interface ExtensionSettings {
  apiBaseUrl: string;
  accessToken: string;
}

export type ExtensionRuntimeRequest =
  | RuntimeRequest
  | { kind: "page.evaluate"; page: PageContext }
  | { kind: "settings.get" }
  | { kind: "settings.update"; settings: Partial<ExtensionSettings> };

export type ExtensionRuntimeResponse =
  | RuntimeResponse
  | { ok: true; action: FocusAction }
  | { ok: true; settings: ExtensionSettings }
  | { ok: false; error: string };
