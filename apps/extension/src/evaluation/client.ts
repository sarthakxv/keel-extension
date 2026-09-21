import {
  evaluationResponseSchema,
  type EvaluationRequest,
  type EvaluationResponse,
  type ExtensionSettings,
} from "@focus-guardian/contracts";

const REQUEST_TIMEOUT_MS = 4_000;

export async function requestEvaluation(
  settings: ExtensionSettings,
  request: EvaluationRequest,
): Promise<EvaluationResponse | null> {
  if (!settings.accessToken || !settings.apiBaseUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${settings.apiBaseUrl.replace(/\/$/, "")}/api/v1/evaluations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${settings.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    return evaluationResponseSchema.parse(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

