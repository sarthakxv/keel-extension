import {
  SESSION_STORAGE_KEY,
  type ExtensionRuntimeRequest,
  type ExtensionRuntimeResponse,
  type SessionSnapshot,
} from "@focus-guardian/contracts";
import { extractPageContext } from "../src/page/extract";
import { mountIntervention } from "../src/intervention/mount";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main(ctx) {
    let active = false;
    let currentGoal = "";
    let lastFingerprint = "";
    let lastUrl = location.href;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let removeIntervention: (() => void) | undefined;

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
      if (!active || page.fingerprint !== lastFingerprint) return;
      const action = response.action;
      removeIntervention?.();
      removeIntervention = mountIntervention({
        action,
        goal: currentGoal,
        onReturn: () => {
          removeIntervention = undefined;
          if (history.length > 1) history.back();
        },
        onAllow: () => {
          removeIntervention = undefined;
          const allowRequest: ExtensionRuntimeRequest = {
            kind: "intervention.allow",
            evaluationId: action.evaluationId,
            page: { hostname: page.hostname, title: page.title },
          };
          void browser.runtime.sendMessage(allowRequest);
        },
      });
    }

    function scheduleEvaluation() {
      if (!active) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => void evaluatePage(), 900);
    }

    async function setSession(snapshot: SessionSnapshot) {
      const wasActive = active;
      active = snapshot.status === "running";
      currentGoal = snapshot.status === "idle" ? "" : snapshot.session.goal;
      if (active && !wasActive) scheduleEvaluation();
      if (!active) {
        clearTimeout(debounce);
        lastFingerprint = "";
        removeIntervention?.();
        removeIntervention = undefined;
      }
    }

    const observer = new MutationObserver(scheduleEvaluation);
    observer.observe(document.documentElement, { childList: true, subtree: true });

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
      clearTimeout(debounce);
      document.removeEventListener("visibilitychange", handleVisibility);
      browser.storage.local.onChanged.removeListener(handleStorage);
      removeIntervention?.();
    });
  },
});
