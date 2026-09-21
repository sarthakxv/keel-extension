import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function authenticateRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return null;

  if (process.env.NODE_ENV !== "production" && token === process.env.FOCUS_GUARDIAN_DEV_TOKEN) {
    return digest(token).toString("hex");
  }

  const candidate = digest(token);
  const hashes = (process.env.FOCUS_GUARDIAN_DEVICE_TOKEN_HASHES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const hash of hashes) {
    const expected = Buffer.from(hash, "hex");
    if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) {
      return hash;
    }
  }
  return null;
}

