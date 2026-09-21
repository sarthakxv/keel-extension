// @vitest-environment happy-dom

import type { EvaluationResponse } from "@focus-guardian/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { createStatusHudView, mountStatusHud } from "./mount";

function evaluation(): EvaluationResponse {
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
  };
}

describe("status HUD mount", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.replaceChildren(document.body);
  });

  it("renders Jev alignment, mix, and distraction for the current host", () => {
    const view = createStatusHudView({
      kind: "result",
      hostname: "github.com",
      evaluation: evaluation(),
    });
    expect(view.textContent).toContain("On task");
    expect(view.textContent).toContain("84%");
    expect(view.textContent).toContain("github.com");
    expect(view.textContent).toContain("distraction 18%");
    expect(view.querySelectorAll("[data-alignment]")).toHaveLength(4);
    expect(view.getAttribute("role")).toBe("status");
    expect(view.getAttribute("aria-label")).toBe("On task, 84%. Distraction 18% on github.com");
  });

  it("marks the host so page extraction can ignore the bar", () => {
    const hud = mountStatusHud();
    hud.render({ kind: "checking", hostname: "github.com" });
    const host = document.querySelector("[data-focus-guardian-ui]");
    expect(host?.getAttribute("data-focus-guardian-ui")).toBe("true");
    hud.remove();
  });

  it("removes the bar when the session is no longer running", () => {
    const hud = mountStatusHud();
    hud.render({ kind: "checking", hostname: "github.com" });
    expect(document.querySelector("[data-focus-guardian-ui]")).not.toBeNull();
    hud.render(null);
    expect(document.querySelector("[data-focus-guardian-ui]")).toBeNull();
  });
});
