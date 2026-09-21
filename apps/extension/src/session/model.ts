import {
  durationMinutesSchema,
  goalSchema,
  type FocusSession,
  type SessionSnapshot,
} from "@focus-guardian/contracts";

const MINUTE_MS = 60_000;

export function createSession(
  input: { id: string; goal: string; durationMinutes: number },
  now: number,
): FocusSession {
  const goal = goalSchema.parse(input.goal);
  const durationMinutes = durationMinutesSchema.parse(input.durationMinutes);

  return {
    id: input.id,
    goal,
    durationMinutes,
    status: "running",
    startedAt: now,
    endsAt: now + durationMinutes * MINUTE_MS,
    pausedRemainingMs: null,
    completedAt: null,
    revision: 1,
    interventionTimestamps: [],
    allowedExamples: [],
    stats: {
      pagesEvaluated: 0,
      interventionsShown: 0,
      overrides: 0,
    },
  };
}

export function remainingMs(session: FocusSession, now: number): number {
  if (session.status === "paused") {
    return Math.max(0, session.pausedRemainingMs ?? 0);
  }

  if (session.status === "completed" || session.endsAt === null) {
    return 0;
  }

  return Math.max(0, session.endsAt - now);
}

export function reconcileSnapshot(snapshot: SessionSnapshot, now: number): SessionSnapshot {
  if (snapshot.status !== "running" || remainingMs(snapshot.session, now) > 0) {
    return snapshot;
  }

  return {
    status: "completed",
    session: {
      ...snapshot.session,
      goal: "",
      status: "completed",
      endsAt: null,
      pausedRemainingMs: null,
      completedAt: now,
      revision: snapshot.session.revision + 1,
      allowedExamples: [],
      interventionTimestamps: [],
    },
  };
}

export function pauseSnapshot(snapshot: SessionSnapshot, now: number): SessionSnapshot {
  const reconciled = reconcileSnapshot(snapshot, now);
  if (reconciled.status !== "running") {
    return reconciled;
  }

  return {
    status: "paused",
    session: {
      ...reconciled.session,
      status: "paused",
      endsAt: null,
      pausedRemainingMs: remainingMs(reconciled.session, now),
      revision: reconciled.session.revision + 1,
    },
  };
}

export function resumeSnapshot(snapshot: SessionSnapshot, now: number): SessionSnapshot {
  if (snapshot.status !== "paused") {
    return reconcileSnapshot(snapshot, now);
  }

  const remaining = Math.max(0, snapshot.session.pausedRemainingMs ?? 0);
  if (remaining === 0) {
    return reconcileSnapshot(
      {
        status: "running",
        session: { ...snapshot.session, status: "running", endsAt: now },
      },
      now,
    );
  }

  return {
    status: "running",
    session: {
      ...snapshot.session,
      status: "running",
      endsAt: now + remaining,
      pausedRemainingMs: null,
      revision: snapshot.session.revision + 1,
    },
  };
}

export function endSnapshot(snapshot: SessionSnapshot, now: number): SessionSnapshot {
  if (snapshot.status === "idle") {
    return snapshot;
  }

  return {
    status: "completed",
    session: {
      ...snapshot.session,
      goal: "",
      status: "completed",
      endsAt: null,
      pausedRemainingMs: null,
      completedAt: now,
      revision: snapshot.session.revision + 1,
      allowedExamples: [],
      interventionTimestamps: [],
    },
  };
}
