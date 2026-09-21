import type { RuntimeRequest } from "@focus-guardian/contracts";
import {
  executeSessionCommand,
  reconcilePersistedSession,
} from "../src/session/controller";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) => {
    const request = message as Partial<RuntimeRequest>;
    if (request.kind !== "session.command" || !request.command) {
      return undefined;
    }
    return executeSessionCommand(request.command);
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
