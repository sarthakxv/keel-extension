import type { EvaluationResponse } from "@keel/contracts";
import { describe, expect, it } from "vitest";
import { alignmentSegments, formatPercent, statusHudCopy } from "./summary";

function evaluation(overrides?: Partial<EvaluationResponse>): EvaluationResponse {
  return {
    evaluationId: "0f38665e-597c-4d25-96ff-1ce47fbad98f",
    alignment: {
      value: "on_task",
      probabilities: {
        on_task: 0.84,
        useful_detour: 0.12,
        off_task: 0.03,
        insufficient_evidence: 0.01,
      },
    },
    distraction: { value: false, probability: 0.18 },
    model: "typesafe-ai/jev",
    evaluatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("status HUD copy", () => {
  it("rounds probabilities to whole percents", () => {
    expect(formatPercent(0.844)).toBe("84%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
  });

  it("announces a checking state for the current host", () => {
    const copy = statusHudCopy({ kind: "checking", hostname: "github.com" });
    expect(copy.title).toBe("Reading this page");
    expect(copy.detail).toBe("github.com");
    expect(copy.liveText).toBe("Reading this page on github.com");
  });

  it("announces a missed evaluation without inventing a class", () => {
    const copy = statusHudCopy({ kind: "unavailable", hostname: "news.ycombinator.com" });
    expect(copy.title).toBe("Couldn't classify");
    expect(copy.detail).toBe("news.ycombinator.com");
    expect(copy.liveText).toBe("Couldn't classify news.ycombinator.com");
  });

  it("surfaces Jev alignment, confidence, and distraction", () => {
    const copy = statusHudCopy({
      kind: "result",
      hostname: "github.com",
      evaluation: evaluation(),
    });
    expect(copy.title).toBe("On task");
    expect(copy.confidence).toBe("84%");
    expect(copy.detail).toBe("github.com · distraction 18%");
    expect(copy.liveText).toBe("On task, 84%. Distraction 18% on github.com");
    expect(copy.tone).toBe("on_task");
  });

  it("labels every alignment class", () => {
    expect(
      statusHudCopy({
        kind: "result",
        hostname: "example.com",
        evaluation: evaluation({
          alignment: {
            value: "useful_detour",
            probabilities: {
              on_task: 0.1,
              useful_detour: 0.7,
              off_task: 0.1,
              insufficient_evidence: 0.1,
            },
          },
        }),
      }).title,
    ).toBe("Useful detour");
    expect(
      statusHudCopy({
        kind: "result",
        hostname: "example.com",
        evaluation: evaluation({
          alignment: {
            value: "off_task",
            probabilities: {
              on_task: 0.05,
              useful_detour: 0.05,
              off_task: 0.88,
              insufficient_evidence: 0.02,
            },
          },
        }),
      }).title,
    ).toBe("Off task");
    expect(
      statusHudCopy({
        kind: "result",
        hostname: "example.com",
        evaluation: evaluation({
          alignment: {
            value: "insufficient_evidence",
            probabilities: {
              on_task: 0.1,
              useful_detour: 0.1,
              off_task: 0.1,
              insufficient_evidence: 0.7,
            },
          },
        }),
      }).title,
    ).toBe("Not enough evidence");
  });

  it("keeps alignment mix in a stable order", () => {
    expect(alignmentSegments(evaluation()).map((segment) => segment.key)).toEqual([
      "on_task",
      "useful_detour",
      "off_task",
      "insufficient_evidence",
    ]);
    expect(alignmentSegments(evaluation())[0]).toEqual({
      key: "on_task",
      label: "On task",
      probability: 0.84,
      percent: "84%",
    });
  });
});
