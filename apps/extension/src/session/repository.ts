import {
  SESSION_STORAGE_KEY,
  type SessionSnapshot,
} from "@keel/contracts";

const idleSnapshot: SessionSnapshot = { status: "idle" };

export async function readSession(): Promise<SessionSnapshot> {
  const stored = await browser.storage.local.get(SESSION_STORAGE_KEY);
  return (stored[SESSION_STORAGE_KEY] as SessionSnapshot | undefined) ?? idleSnapshot;
}

export async function writeSession(snapshot: SessionSnapshot): Promise<void> {
  await browser.storage.local.set({ [SESSION_STORAGE_KEY]: snapshot });
}

