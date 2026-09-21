import {
  SESSION_STORAGE_KEY,
  type ExtensionRuntimeRequest,
  type ExtensionRuntimeResponse,
  type SessionSnapshot,
} from "@focus-guardian/contracts";
import { extractPageContext } from "../src/page/extract";
import { mountIntervention } from "../src/intervention/mount";
import { EvaluationScheduler } from "../src/page/scheduler";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main(ctx) {
    let active = false;
    let currentSessionId = "";
    let currentGoal = "";
    let lastFingerprint = "";
    let lastUrl = location.href;
    let removeIntervention: (() => void) | undefined;
    let observing = false;

    async function evaluatePage() {
      if (!active || document.visibilityState === "hidden") return;
      const page = await extractPageContext(document);
      if (!page || page.fingerprint === lastFingerprint) return;
      lastFingerprint = page.fingerprint;
      const request: ExtensionRuntimeRequest = { kind: "page.evaluate", page };
      const response = (await browser.runtime
        .sendMessage(request)
        .catch(() => undefined)) as ExtensionRuntimeResponse | undefined;
      if (!response?.ok || !("action" in response) || response.action.type === "allow") return;
      if (
        !active ||
        response.sessionId !== currentSessionId ||
        response.fingerprint !== page.fingerprint ||
        page.fingerprint !== lastFingerprint
      ) return;
      const action = response.action;
      removeIntervention?.();
      removeIntervention = mountIntervention({
        action,
        goal: currentGoal,
        onReturn: () => {
          if (history.length > 1) {
            history.back();
          } else {
            location.replace("about:blank");
          }
          removeIntervention = undefined;
          return true;
        },
        onAllow: () => {
          removeIntervention = undefined;
          const allowRequest: ExtensionRuntimeRequest = {
            kind: "intervention.allow",
            evaluationId: action.evaluationId,
            sessionId: currentSessionId,
            page: { hostname: page.hostname, title: page.title },
          };
          void browser.runtime.sendMessage(allowRequest);
        },
      });
      const shownRequest: ExtensionRuntimeRequest = {
        kind: "intervention.shown",
        evaluationId: action.evaluationId,
        sessionId: currentSessionId,
      };
      void browser.runtime.sendMessage(shownRequest);
    }

    const scheduler = new EvaluationScheduler(evaluatePage, {
      debounceMs: 900,
      maxWaitMs: 2_500,
      minIntervalMs: 5_000,
    });

    function scheduleEvaluation() {
      if (!active) return;
      scheduler.schedule();
    }

    async function setSession(snapshot: SessionSnapshot) {
      const wasActive = active;
      const previousSessionId = currentSessionId;
      active = snapshot.status === "running";
      currentSessionId = snapshot.status === "running" ? snapshot.session.id : "";
      currentGoal = snapshot.status === "idle" ? "" : snapshot.session.goal;
      if (active && !observing) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
        observing = true;
      }
      if (active && (!wasActive || previousSessionId !== currentSessionId)) {
        lastFingerprint = "";
        scheduleEvaluation();
      }
      if (!active) {
        scheduler.cancel();
        observer.disconnect();
        observing = false;
        lastFingerprint = "";
        removeIntervention?.();
        removeIntervention = undefined;
      }
    }

    const observer = new MutationObserver(scheduleEvaluation);

    const heartbeat = setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastFingerprint = "";
        removeIntervention?.();
        removeIntervention = undefined;
        scheduleEvaluation();
      }
    }, 1_000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleEvaluation();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleStorage = (changes: Record<string, Browser.storage.StorageChange>) => {
      const value = changes[SESSION_STORAGE_KEY]?.newValue as SessionSnapshot | undefined;
      if (value) void setSession(value);
    };
    browser.storage.local.onChanged.addListener(handleStorage);

    void browser.runtime
      .sendMessage({ kind: "session.command", command: { type: "session.get" } })
      .then((response: ExtensionRuntimeResponse) => {
        if (response.ok && "snapshot" in response) return setSession(response.snapshot);
      });

    ctx.onInvalidated(() => {
      observer.disconnect();
      clearInterval(heartbeat);
      scheduler.dispose();
      document.removeEventListener("visibilitychange", handleVisibility);
      browser.storage.local.onChanged.removeListener(handleStorage);
      removeIntervention?.();
    });
  },
});
