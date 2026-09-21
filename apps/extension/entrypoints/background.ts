import {
  evaluationRequestSchema,
  pageContextSchema,
  type ExtensionRuntimeRequest,
  type ExtensionRuntimeResponse,
  type RuntimeResponse,
} from "@focus-guardian/contracts";
import { getCachedEvaluation, setCachedEvaluation } from "../src/evaluation/cache";
import { requestEvaluation } from "../src/evaluation/client";
import { decideIntervention } from "../src/evaluation/policy";
import { evaluationCacheKey, matchesSession } from "../src/evaluation/identity";
import { readSettings } from "../src/settings/repository";
import {
  executeSessionCommand,
  recordEvaluation,
  recordOverride,
  reconcilePersistedSession,
} from "../src/session/controller";
import { remainingMs } from "../src/session/model";

async function evaluatePage(pageInput: unknown): Promise<ExtensionRuntimeResponse> {
  const page = pageContextSchema.safeParse(pageInput);
  if (!page.success) {
    return { ok: true, action: { type: "allow" }, sessionId: null, fingerprint: "" };
  }

  const snapshotResponse = await executeSessionCommand({ type: "session.get" });
  if (!snapshotResponse.ok || snapshotResponse.snapshot.status !== "running") {
    return {
      ok: true,
      action: { type: "allow" },
      sessionId: null,
      fingerprint: page.data.fingerprint,
    };
  }

  const session = snapshotResponse.snapshot.session;
  const cacheKey = evaluationCacheKey(session, page.data.fingerprint);
  const cached = await getCachedEvaluation(cacheKey);
  const request = evaluationRequestSchema.parse({
    requestId: crypto.randomUUID(),
    goal: session.goal,
    minutesRemaining: remainingMs(session, Date.now()) / 60_000,
    page: {
      hostname: page.data.hostname,
      title: page.data.title,
      excerpt: page.data.excerpt,
    },
    allowedExamples: session.allowedExamples,
  });
  const response = cached ?? (await requestEvaluation(await readSettings(), request));
  if (!response) {
    return {
      ok: true,
      action: { type: "allow" },
      sessionId: session.id,
      fingerprint: page.data.fingerprint,
    };
  }
  if (!cached) await setCachedEvaluation(cacheKey, response);

  const latest = await executeSessionCommand({ type: "session.get" });
  if (!latest.ok || !matchesSession(latest.snapshot, session.id)) {
    return {
      ok: true,
      action: { type: "allow" },
      sessionId: null,
      fingerprint: page.data.fingerprint,
    };
  }

  const recentCount = session.interventionTimestamps.filter(
    (timestamp) => Date.now() - timestamp < 10 * 60_000,
  ).length;
  const action = decideIntervention(response, recentCount);
  return { ok: true, action, sessionId: session.id, fingerprint: page.data.fingerprint };
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) => {
    const request = message as Partial<ExtensionRuntimeRequest>;
    if (request.kind === "session.command" && request.command) {
      return executeSessionCommand(request.command) satisfies Promise<RuntimeResponse>;
    }
    if (request.kind === "page.evaluate") {
      return evaluatePage(request.page);
    }
    if (request.kind === "intervention.shown") {
      if (typeof request.sessionId !== "string" || typeof request.evaluationId !== "string") {
        return Promise.resolve({ ok: false, error: "Invalid intervention" } satisfies ExtensionRuntimeResponse);
      }
      const sessionId = request.sessionId;
      return recordEvaluation(sessionId, true).then(
        () => ({
          ok: true,
          action: { type: "allow" },
          sessionId,
          fingerprint: "",
        }) satisfies ExtensionRuntimeResponse,
      );
    }
    if (request.kind === "intervention.allow") {
      const page = pageContextSchema.pick({ hostname: true, title: true }).safeParse(request.page);
      if (!page.success || typeof request.evaluationId !== "string") {
        return Promise.resolve({ ok: false, error: "Invalid override" } satisfies ExtensionRuntimeResponse);
      }
      if (typeof request.sessionId !== "string") {
        return Promise.resolve({ ok: false, error: "Invalid session" } satisfies ExtensionRuntimeResponse);
      }
      const sessionId = request.sessionId;
      return recordOverride(sessionId, page.data).then(
        () => ({
          ok: true,
          action: { type: "allow" },
          sessionId,
          fingerprint: "",
        }) satisfies ExtensionRuntimeResponse,
      );
    }
    return undefined;
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "focus-guardian:session-end") {
      void reconcilePersistedSession();
    }
  });

  browser.runtime.onStartup.addListener(() => {
    void reconcilePersistedSession();
  });

  browser.runtime.onInstalled.addListener(() => {
    void reconcilePersistedSession();
  });
});
