import type { EvaluationResponse } from "@keel/contracts";

const CACHE_KEY = "keel:evaluation-cache";
const CACHE_TTL_MS = 30 * 60_000;

interface CacheEntry {
  expiresAt: number;
  response: EvaluationResponse;
}

type EvaluationCache = Record<string, CacheEntry>;

export async function getCachedEvaluation(key: string, now = Date.now()): Promise<EvaluationResponse | null> {
  const stored = await browser.storage.session.get(CACHE_KEY);
  const cache = (stored[CACHE_KEY] as EvaluationCache | undefined) ?? {};
  const entry = cache[key];
  return entry && entry.expiresAt > now ? entry.response : null;
}

export async function setCachedEvaluation(
  key: string,
  response: EvaluationResponse,
  now = Date.now(),
): Promise<void> {
  const stored = await browser.storage.session.get(CACHE_KEY);
  const cache = (stored[CACHE_KEY] as EvaluationCache | undefined) ?? {};
  const freshCache = Object.fromEntries(
    Object.entries(cache).filter(([, entry]) => entry.expiresAt > now),
  );
  freshCache[key] = { expiresAt: now + CACHE_TTL_MS, response };
  await browser.storage.session.set({ [CACHE_KEY]: freshCache });
}

export async function clearEvaluationCache(): Promise<void> {
  await browser.storage.session.remove(CACHE_KEY);
}

