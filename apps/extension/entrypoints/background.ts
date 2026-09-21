import {
  evaluationRequestSchema,
  pageContextSchema,
  type ExtensionRuntimeRequest,
  type ExtensionRuntimeResponse,
  type FocusAction,
  type RuntimeResponse,
} from "@focus-guardian/contracts";
import { getCachedEvaluation, setCachedEvaluation } from "../src/evaluation/cache";
import { requestEvaluation } from "../src/evaluation/client";
import { decideIntervention, isConfidentDistraction } from "../src/evaluation/policy";
import { readSettings, updateSettings } from "../src/settings/repository";
import {
  executeSessionCommand,
  recordEvaluation,
  recordOverride,
  reconcilePersistedSession,
} from "../src/session/controller";
import { remainingMs } from "../src/session/model";

async function evaluatePage(pageInput: unknown): Promise<ExtensionRuntimeResponse> {
  const page = pageContextSchema.safeParse(pageInput);
  if (!page.success) return { ok: true, action: { type: "allow" } };

  const snapshotResponse = await executeSessionCommand({ type: "session.get" });
  if (!snapshotResponse.ok || snapshotResponse.snapshot.status !== "running") {
    return { ok: true, action: { type: "allow" } };
  }

  const session = snapshotResponse.snapshot.session;
  const cacheKey = `${session.id}:${page.data.fingerprint}`;
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
  if (!response) return { ok: true, action: { type: "allow" } };
  if (!cached) await setCachedEvaluation(cacheKey, response);

  const distraction = isConfidentDistraction(response);
  const recorded = await recordEvaluation(distraction);
  const action: FocusAction = decideIntervention(response, recorded.previousInterventions);
  return { ok: true, action };
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
    if (request.kind === "intervention.allow") {
      const page = pageContextSchema.pick({ hostname: true, title: true }).safeParse(request.page);
      if (!page.success || typeof request.evaluationId !== "string") {
        return Promise.resolve({ ok: false, error: "Invalid override" } satisfies ExtensionRuntimeResponse);
      }
      return recordOverride(page.data).then(
        () => ({ ok: true, action: { type: "allow" } } satisfies ExtensionRuntimeResponse),
      );
    }
    if (request.kind === "settings.get") {
      return readSettings().then((settings) => ({ ok: true, settings }) satisfies ExtensionRuntimeResponse);
    }
    if (request.kind === "settings.update") {
      return updateSettings(request.settings ?? {}).then(
        (settings) => ({ ok: true, settings }) satisfies ExtensionRuntimeResponse,
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
