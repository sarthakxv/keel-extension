import { evaluationRequestSchema } from "@focus-guardian/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateFocusPage } from "../../../../src/jev-evaluator";
import { checkRateLimit } from "../../../../src/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const installationId = z.string().uuid().safeParse(
    request.headers.get("x-focus-installation-id"),
  );
  if (!installationId.success) {
    return NextResponse.json({ error: "Missing installation ID" }, { status: 400 });
  }
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await checkRateLimit(installationId.data, ipAddress))) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = evaluationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid evaluation request" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    return NextResponse.json(await evaluateFocusPage(parsed.data, controller.signal));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown evaluation error";
    console.error(`Focus evaluation failed: ${message}`);
    return NextResponse.json({ error: "Evaluation unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
