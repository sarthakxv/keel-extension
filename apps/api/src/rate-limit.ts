import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { hashIdentifier, logEvent, serializeError } from "./log";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

const installationMinute = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      prefix: "keel:install:minute",
    })
  : null;
const installationDay = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(300, "1 d"),
      prefix: "keel:install:day",
    })
  : null;
const ipMinute = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(90, "1 m"),
      prefix: "keel:ip:minute",
    })
  : null;
const ipDay = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(900, "1 d"),
      prefix: "keel:ip:day",
    })
  : null;

function privateIdentifier(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const limiterNames = ["install_minute", "install_day", "ip_minute", "ip_day"] as const;
const redisConfigured = Boolean(installationMinute && installationDay && ipMinute && ipDay);
if (!redisConfigured) {
  logEvent(process.env.NODE_ENV === "production" ? "error" : "info", "rate_limit.unconfigured", {
    allow: process.env.NODE_ENV !== "production",
    env: process.env.NODE_ENV ?? "unknown",
  });
}

export async function checkRateLimit(installationId: string, ipAddress: string): Promise<boolean> {
  if (!installationMinute || !installationDay || !ipMinute || !ipDay) {
    return process.env.NODE_ENV !== "production";
  }

  const installHash = hashIdentifier(installationId);
  const ipHash = hashIdentifier(ipAddress);
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
    const denied = limiterNames.filter((_, index) => !results[index]?.success);
    if (denied.length > 0) {
      logEvent("warn", "rate_limit.denied", {
        installHash,
        ipHash,
        limits: denied.join(","),
      });
      return false;
    }
    return true;
  } catch (error) {
    const serialized = serializeError(error);
    logEvent("error", "rate_limit.failed", {
      installHash,
      ipHash,
      errorName: serialized.name,
      errorMessage: serialized.message,
    });
    return false;
  }
}
