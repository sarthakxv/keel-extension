import type { Alignment, EvaluationResponse } from "@keel/contracts";

export type StatusHudState =
  | { kind: "checking"; hostname: string }
  | { kind: "unavailable"; hostname: string }
  | { kind: "result"; hostname: string; evaluation: EvaluationResponse };

export interface StatusHudCopy {
  /** Visible pill text: a few words, no numbers. */
  text: string;
  /** Full context for screen readers and tooltips. */
  liveText: string;
  tone: Alignment | "checking" | "unavailable";
}

const PILL_TEXT: Record<Alignment, string> = {
  on_task: "On track",
  useful_detour: "Side track",
  off_task: "Distracted, back to your task",
  insufficient_evidence: "Unclear signal",
};

export function formatPercent(probability: number): string {
  const clamped = Math.max(0, Math.min(1, probability));
  return `${Math.round(clamped * 100)}%`;
}

export function statusHudCopy(state: StatusHudState): StatusHudCopy {
  if (state.kind === "checking") {
    return {
      text: "Reading this page…",
      liveText: `Reading this page on ${state.hostname}`,
      tone: "checking",
    };
  }
  if (state.kind === "unavailable") {
    return {
      text: "Couldn't classify",
      liveText: `Couldn't classify ${state.hostname}`,
      tone: "unavailable",
    };
  }

  const text = PILL_TEXT[state.evaluation.alignment.value];
  const distraction = formatPercent(state.evaluation.distraction.probability);
  return {
    text,
    liveText: `${text} on ${state.hostname}. Distraction ${distraction}`,
    tone: state.evaluation.alignment.value,
  };
}
