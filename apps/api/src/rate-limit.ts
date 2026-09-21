import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const installationMinute = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "focus-guardian:install:minute",
    })
  : null;
const installationDay = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(300, "1 d"),
      prefix: "focus-guardian:install:day",
    })
  : null;
const ipMinute = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(90, "1 m"),
      prefix: "focus-guardian:ip:minute",
    })
  : null;
const ipDay = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(900, "1 d"),
      prefix: "focus-guardian:ip:day",
    })
  : null;

function privateIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function checkRateLimit(installationId: string, ipAddress: string): Promise<boolean> {
  if (!installationMinute || !installationDay || !ipMinute || !ipDay) {
    return process.env.NODE_ENV !== "production";
  }

  try {
    const installation = privateIdentifier(installationId);
    const ip = privateIdentifier(ipAddress);
    const results = await Promise.all([
      installationMinute.limit(installation),
      installationDay.limit(installation),
      ipMinute.limit(ip),
      ipDay.limit(ip),
    ]);
    await Promise.all(results.map((result) => result.pending));
    return results.every((result) => result.success);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown rate-limit error";
    console.error(`Rate-limit check failed: ${message}`);
    return false;
  }
}
