import {
  SESSION_STORAGE_KEY,
  type ExtensionRuntimeRequest,
  type ExtensionRuntimeResponse,
  type SessionSnapshot,
} from "@focus-guardian/contracts";
import { extractPageContext } from "../src/page/extract";

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main(ctx) {
    let active = false;
    let lastFingerprint = "";
    let lastUrl = location.href;
    let debounce: ReturnType<typeof setTimeout> | undefined;

    async function evaluatePage() {
      if (!active || document.visibilityState === "hidden") return;
      const page = await extractPageContext(document);
      if (!page || page.fingerprint === lastFingerprint) return;
      lastFingerprint = page.fingerprint;
      const request: ExtensionRuntimeRequest = { kind: "page.evaluate", page };
      await browser.runtime.sendMessage(request).catch(() => undefined) as ExtensionRuntimeResponse | undefined;
    }

    function scheduleEvaluation() {
      if (!active) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => void evaluatePage(), 900);
    }

    async function setSession(snapshot: SessionSnapshot) {
      const wasActive = active;
      active = snapshot.status === "running";
      if (active && !wasActive) scheduleEvaluation();
      if (!active) {
        clearTimeout(debounce);
        lastFingerprint = "";
      }
    }

    const observer = new MutationObserver(scheduleEvaluation);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    const heartbeat = setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastFingerprint = "";
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
    });
  },
});

