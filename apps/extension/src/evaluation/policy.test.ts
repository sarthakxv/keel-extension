import type { EvaluationResponse } from "@keel/contracts";
import { describe, expect, it } from "vitest";
import { decideIntervention, isConfidentDistraction } from "./policy";

function response(offTask: number, distraction: number): EvaluationResponse {
  return {
    evaluationId: "0f38665e-597c-4d25-96ff-1ce47fbad98f",
    alignment: {
      value: "off_task",
      probabilities: {
        on_task: 0.05,
        useful_detour: 0.05,
        off_task: offTask,
        insufficient_evidence: 0,
      },
    },
    distraction: { value: distraction >= 0.5, probability: distraction },
    model: "typesafe-ai/jev",
    evaluatedAt: new Date(0).toISOString(),
  };
}

describe("distraction policy", () => {
  it("fails open below either threshold", () => {
    expect(isConfidentDistraction(response(0.74, 0.9))).toBe(false);
    expect(isConfidentDistraction(response(0.9, 0.74))).toBe(false);
  });

  it("escalates only confident distractions", () => {
    const confident = response(0.9, 0.9);
    expect(decideIntervention(confident, 0).type).toBe("toast");
    expect(decideIntervention(confident, 1)).toEqual({
      type: "interstitial",
      evaluationId: confident.evaluationId,
      delaySeconds: 5,
    });
    expect(decideIntervention(confident, 2)).toEqual({
      type: "interstitial",
      evaluationId: confident.evaluationId,
      delaySeconds: 15,
    });
  });
});

