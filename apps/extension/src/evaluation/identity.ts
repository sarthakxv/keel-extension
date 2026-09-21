import type { Session, SessionSnapshot } from "@keel/contracts";

export function matchesSession(snapshot: SessionSnapshot, sessionId: string): boolean {
  return snapshot.status === "running" && snapshot.session.id === sessionId;
}

export function evaluationCacheKey(session: Session, fingerprint: string): string {
  return `${session.id}:${session.stats.overrides}:${fingerprint}`;
}

