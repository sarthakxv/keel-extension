import type { EvaluationResponse, FocusAction } from "@focus-guardian/contracts";

export const OFF_TASK_THRESHOLD = 0.75;
export const DISTRACTION_THRESHOLD = 0.75;
export const ESCALATION_WINDOW_MS = 10 * 60_000;

export function isConfidentDistraction(response: EvaluationResponse): boolean {
  return (
    response.alignment.value === "off_task" &&
    (response.alignment.probabilities.off_task ?? 0) >= OFF_TASK_THRESHOLD &&
    response.distraction.value &&
    response.distraction.probability >= DISTRACTION_THRESHOLD
  );
}

export function decideIntervention(
  response: EvaluationResponse,
  previousInterventions: number,
): FocusAction {
  if (!isConfidentDistraction(response)) {
    return { type: "allow" };
  }
  if (previousInterventions === 0) {
    return { type: "toast", evaluationId: response.evaluationId };
  }
  return {
    type: "interstitial",
    evaluationId: response.evaluationId,
    delaySeconds: previousInterventions === 1 ? 5 : 15,
  };
}

