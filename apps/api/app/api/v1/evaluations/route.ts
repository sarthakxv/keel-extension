import { evaluationRequestSchema } from "@focus-guardian/contracts";
import { NextResponse } from "next/server";
import { authenticateRequest } from "../../../../src/auth";
import { evaluateFocusPage } from "../../../../src/jev-evaluator";
import { checkRateLimit } from "../../../../src/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const identity = authenticateRequest(request);
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!checkRateLimit(identity)) {
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
  } catch {
    return NextResponse.json({ error: "Evaluation unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
