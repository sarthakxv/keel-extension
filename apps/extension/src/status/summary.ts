import {
  alignmentSchema,
  type Alignment,
  type EvaluationResponse,
} from "@focus-guardian/contracts";

export type StatusHudState =
  | { kind: "checking"; hostname: string }
  | { kind: "unavailable"; hostname: string }
  | { kind: "result"; hostname: string; evaluation: EvaluationResponse };

export interface StatusHudCopy {
  eyebrow: string;
  title: string;
  confidence: string | null;
  detail: string;
  liveText: string;
  tone: Alignment | "checking" | "unavailable";
}

export const ALIGNMENT_LABELS: Record<Alignment, string> = {
  on_task: "On task",
  useful_detour: "Useful detour",
  off_task: "Off task",
  insufficient_evidence: "Not enough evidence",
};

export const ALIGNMENT_ORDER = alignmentSchema.options;

export function formatPercent(probability: number): string {
  const clamped = Math.max(0, Math.min(1, probability));
  return `${Math.round(clamped * 100)}%`;
}

export function alignmentSegments(evaluation: EvaluationResponse) {
  return ALIGNMENT_ORDER.map((key) => {
    const probability = evaluation.alignment.probabilities[key] ?? 0;
    return {
      key,
      label: ALIGNMENT_LABELS[key],
      probability,
      percent: formatPercent(probability),
    };
  });
}

export function statusHudCopy(state: StatusHudState): StatusHudCopy {
  if (state.kind === "checking") {
    return {
      eyebrow: "Jev",
      title: "Reading this page",
      confidence: null,
      detail: state.hostname,
      liveText: `Reading this page on ${state.hostname}`,
      tone: "checking",
    };
  }
  if (state.kind === "unavailable") {
    return {
      eyebrow: "Jev",
      title: "Couldn't classify",
      confidence: null,
      detail: state.hostname,
      liveText: `Couldn't classify ${state.hostname}`,
      tone: "unavailable",
    };
  }

  const title = ALIGNMENT_LABELS[state.evaluation.alignment.value];
  const confidence = formatPercent(
    state.evaluation.alignment.probabilities[state.evaluation.alignment.value] ?? 0,
  );
  const distraction = formatPercent(state.evaluation.distraction.probability);
  return {
    eyebrow: "Jev",
    title,
    confidence,
    detail: `${state.hostname} · distraction ${distraction}`,
    liveText: `${title}, ${confidence}. Distraction ${distraction} on ${state.hostname}`,
    tone: state.evaluation.alignment.value,
  };
}
