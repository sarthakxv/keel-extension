// @vitest-environment happy-dom

import type { EvaluationResponse } from "@keel/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { createStatusHudView, mountStatusHud } from "./mount";

function evaluation(): EvaluationResponse {
  return {
    evaluationId: "0f38665e-597c-4d25-96ff-1ce47fbad98f",
    alignment: {
      value: "off_task",
      probabilities: {
        on_task: 0.05,
        useful_detour: 0.05,
        off_task: 0.88,
        insufficient_evidence: 0.02,
      },
    },
    distraction: { value: true, probability: 0.91 },
    model: "typesafe-ai/jev",
    evaluatedAt: new Date(0).toISOString(),
  };
}

describe("status HUD mount", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.replaceChildren(document.body);
  });

  it("renders a pill with a dot and a few words", () => {
    const view = createStatusHudView({
      kind: "result",
      hostname: "github.com",
      evaluation: evaluation(),
    });
    expect(view.className).toBe("fg-status");
    expect(view.textContent).toBe("Distracted, back to your task");
    expect(view.querySelector(".fg-dot")).not.toBeNull();
    expect(view.textContent).not.toContain("github.com");
    expect(view.textContent).not.toContain("91%");
    expect(view.querySelectorAll("[data-alignment]")).toHaveLength(0);
    expect(view.getAttribute("role")).toBe("status");
    expect(view.getAttribute("aria-label")).toBe(
      "Distracted, back to your task on github.com. Distraction 91%",
    );
  });

  it("marks the host so page extraction can ignore the pill", () => {
    const hud = mountStatusHud();
    hud.render({ kind: "checking", hostname: "github.com" });
    const host = document.querySelector("[data-keel-ui]");
    expect(host?.getAttribute("data-keel-ui")).toBe("true");
    hud.remove();
  });

  it("removes the pill when the session is no longer running", () => {
    const hud = mountStatusHud();
    hud.render({ kind: "checking", hostname: "github.com" });
    expect(document.querySelector("[data-keel-ui]")).not.toBeNull();
    hud.render(null);
    expect(document.querySelector("[data-keel-ui]")).toBeNull();
  });
});
