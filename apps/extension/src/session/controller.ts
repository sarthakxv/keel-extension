import {
  SESSION_ALARM_NAME,
  type RuntimeResponse,
  type SessionCommand,
  type SessionSnapshot,
} from "@focus-guardian/contracts";
import {
  createSession,
  endSnapshot,
  pauseSnapshot,
  reconcileSnapshot,
  resumeSnapshot,
} from "./model";
import { readSession, writeSession } from "./repository";
import { ESCALATION_WINDOW_MS } from "../evaluation/policy";
import { clearEvaluationCache } from "../evaluation/cache";

let operationQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const next = operationQueue.then(operation, operation);
  operationQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function syncAlarm(snapshot: SessionSnapshot): Promise<void> {
  await browser.alarms.clear(SESSION_ALARM_NAME);
  if (snapshot.status === "running" && snapshot.session.endsAt !== null) {
    await browser.alarms.create(SESSION_ALARM_NAME, {
      when: snapshot.session.endsAt,
    });
  }
}

async function persist(snapshot: SessionSnapshot): Promise<SessionSnapshot> {
  await writeSession(snapshot);
  await syncAlarm(snapshot);
  return snapshot;
}

export async function reconcilePersistedSession(now = Date.now()): Promise<SessionSnapshot> {
  return enqueue(async () => {
    const current = await readSession();
    const reconciled = reconcileSnapshot(current, now);
    if (reconciled !== current) {
      await clearEvaluationCache();
      return persist(reconciled);
    }
    await syncAlarm(reconciled);
    return reconciled;
  });
}

export async function executeSessionCommand(command: SessionCommand): Promise<RuntimeResponse> {
  return enqueue(async () => {
    try {
      const now = Date.now();
      const current = reconcileSnapshot(await readSession(), now);
      let next: SessionSnapshot;

      switch (command.type) {
        case "session.start":
          next = {
            status: "running",
            session: createSession(
              {
                id: crypto.randomUUID(),
                goal: command.goal,
                durationMinutes: command.durationMinutes,
              },
              now,
            ),
          };
          break;
        case "session.pause":
          next = pauseSnapshot(current, now);
          break;
        case "session.resume":
          next = resumeSnapshot(current, now);
          break;
        case "session.end":
          next = endSnapshot(current, now);
          break;
        case "session.reset":
          next = { status: "idle" };
          break;
        case "session.get":
          next = current;
          break;
      }

      if (
        command.type === "session.start" ||
        command.type === "session.end" ||
        command.type === "session.reset"
      ) {
        await clearEvaluationCache();
      }

      return { ok: true, snapshot: await persist(next) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Couldn't update the session";
      return { ok: false, error: message };
    }
  });
}

export async function recordOverride(
  expectedSessionId: string,
  example: { hostname: string; title: string },
  now = Date.now(),
): Promise<SessionSnapshot> {
  return enqueue(async () => {
    const current = reconcileSnapshot(await readSession(), now);
    if (current.status !== "running" || current.session.id !== expectedSessionId) return current;
    const withoutDuplicate = current.session.allowedExamples.filter(
      (item) => item.hostname !== example.hostname || item.title !== example.title,
    );
    const next: SessionSnapshot = {
      status: "running",
      session: {
        ...current.session,
        revision: current.session.revision + 1,
        allowedExamples: [...withoutDuplicate, example].slice(-3),
        stats: {
          ...current.session.stats,
          overrides: current.session.stats.overrides + 1,
        },
      },
    };
    await clearEvaluationCache();
    await persist(next);
    return next;
  });
}

export async function recordEvaluation(
  expectedSessionId: string,
  shouldIntervene: boolean,
  now = Date.now(),
): Promise<{ snapshot: SessionSnapshot; previousInterventions: number }> {
  return enqueue(async () => {
    const current = reconcileSnapshot(await readSession(), now);
    if (current.status !== "running" || current.session.id !== expectedSessionId) {
      return { snapshot: current, previousInterventions: 0 };
    }
    const recent = current.session.interventionTimestamps.filter(
      (timestamp) => now - timestamp < ESCALATION_WINDOW_MS,
    );
    const next: SessionSnapshot = {
      status: "running",
      session: {
        ...current.session,
        revision: current.session.revision + 1,
        interventionTimestamps: shouldIntervene ? [...recent, now] : recent,
        stats: {
          ...current.session.stats,
          pagesEvaluated: current.session.stats.pagesEvaluated + 1,
          interventionsShown:
            current.session.stats.interventionsShown + (shouldIntervene ? 1 : 0),
        },
      },
    };
    await persist(next);
    return { snapshot: next, previousInterventions: recent.length };
  });
}
