const minuteBuckets = new Map<string, number[]>();
const dayBuckets = new Map<string, { day: string; count: number }>();

export function checkRateLimit(identity: string, now = Date.now()): boolean {
  const minuteAgo = now - 60_000;
  const recent = (minuteBuckets.get(identity) ?? []).filter((value) => value > minuteAgo);
  if (recent.length >= 30) return false;

  const day = new Date(now).toISOString().slice(0, 10);
  const daily = dayBuckets.get(identity);
  const dailyCount = daily?.day === day ? daily.count : 0;
  if (dailyCount >= 300) return false;

  recent.push(now);
  minuteBuckets.set(identity, recent);
  dayBuckets.set(identity, { day, count: dailyCount + 1 });
  return true;
}

