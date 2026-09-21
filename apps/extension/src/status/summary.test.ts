import type { EvaluationResponse } from "@keel/contracts";
import { describe, expect, it } from "vitest";
import { formatPercent, statusHudCopy } from "./summary";

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
    expect(copy.text).toBe("Reading this page…");
    expect(copy.liveText).toBe("Reading this page on github.com");
  });

  it("announces a missed evaluation without inventing a class", () => {
    const copy = statusHudCopy({ kind: "unavailable", hostname: "news.ycombinator.com" });
    expect(copy.text).toBe("Couldn't classify");
    expect(copy.liveText).toBe("Couldn't classify news.ycombinator.com");
  });

  it("keeps visible pill text to a few words", () => {
    const copy = statusHudCopy({
      kind: "result",
      hostname: "github.com",
      evaluation: evaluation(),
    });
    expect(copy.text).toBe("On track");
    expect(copy.liveText).toBe("On track on github.com. Distraction 18%");
    expect(copy.tone).toBe("on_task");
  });

  it("labels every alignment class in plain words", () => {
    const titles: Array<[EvaluationResponse["alignment"]["value"], string]> = [
      ["on_task", "On track"],
      ["useful_detour", "Side track"],
      ["off_task", "Distracted, back to your task"],
      ["insufficient_evidence", "Unclear signal"],
    ];
    for (const [value, text] of titles) {
      expect(
        statusHudCopy({
          kind: "result",
          hostname: "example.com",
          evaluation: evaluation({
            alignment: {
              value,
              probabilities: {
                on_task: 0.1,
                useful_detour: 0.1,
                off_task: 0.7,
                insufficient_evidence: 0.1,
              },
            },
          }),
        }).text,
      ).toBe(text);
    }
  });
});
