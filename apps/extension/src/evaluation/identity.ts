import type { FocusSession, SessionSnapshot } from "@focus-guardian/contracts";

export function matchesSession(snapshot: SessionSnapshot, sessionId: string): boolean {
  return snapshot.status === "running" && snapshot.session.id === sessionId;
}

export function evaluationCacheKey(session: FocusSession, fingerprint: string): string {
  return `${session.id}:${session.stats.overrides}:${fingerprint}`;
}

