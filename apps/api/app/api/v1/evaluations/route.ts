import { evaluationRequestSchema } from "@keel/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildJevGatewayOptions, evaluatePage } from "../../../../src/jev-evaluator";
import {
  evaluationFailureKind,
  hashIdentifier,
  logEvent,
  requestLogFields,
  serializeError,
} from "../../../../src/log";
import { checkRateLimit } from "../../../../src/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const installationId = z.string().uuid().safeParse(
    request.headers.get("x-keel-installation-id"),
  );
  if (!installationId.success) {
    logEvent("warn", "evaluation.rejected", { reason: "missing_installation_id", status: 400 });
    return NextResponse.json({ error: "Missing installation ID" }, { status: 400 });
  }
  const installHash = hashIdentifier(installationId.data);
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await checkRateLimit(installationId.data, ipAddress))) {
    logEvent("warn", "evaluation.rejected", {
      reason: "rate_limited",
      status: 429,
      installHash,
      ipHash: hashIdentifier(ipAddress),
    });
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8_192) {
    logEvent("warn", "evaluation.rejected", {
      reason: "request_too_large",
      status: 413,
      installHash,
      contentLength,
    });
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logEvent("warn", "evaluation.rejected", { reason: "invalid_json", status: 400, installHash });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = evaluationRequestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent("warn", "evaluation.rejected", {
      reason: "invalid_request",
      status: 400,
      installHash,
      issues: parsed.error.issues.map((issue) => issue.path.join(".") || "root").join(","),
    });
    return NextResponse.json({ error: "Invalid evaluation request" }, { status: 400 });
  }

  const requestFields = requestLogFields(parsed.data);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  const startedAt = Date.now();
  logEvent("info", "evaluation.started", {
    ...requestFields,
    installHash,
    zeroDataRetention: Boolean(buildJevGatewayOptions().zeroDataRetention),
  });
  try {
    const result = await evaluatePage(parsed.data, controller.signal);
    logEvent("info", "evaluation.completed", {
      ...requestFields,
      installHash,
      evaluationId: result.evaluationId,
      alignment: result.alignment.value,
      onTask: Number(result.alignment.probabilities.on_task.toFixed(3)),
      usefulDetour: Number(result.alignment.probabilities.useful_detour.toFixed(3)),
      offTask: Number(result.alignment.probabilities.off_task.toFixed(3)),
      insufficientEvidence: Number(result.alignment.probabilities.insufficient_evidence.toFixed(3)),
      distraction: result.distraction.value,
      distractionProbability: Number(result.distraction.probability.toFixed(3)),
      model: result.model,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(result);
  } catch (error) {
    const serialized = serializeError(error);
    const kind = evaluationFailureKind(error, controller.signal);
    logEvent("error", "evaluation.failed", {
      ...requestFields,
      installHash,
      kind,
      errorName: serialized.name,
      errorMessage: serialized.message,
      aborted: controller.signal.aborted,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json({ error: "Evaluation unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
