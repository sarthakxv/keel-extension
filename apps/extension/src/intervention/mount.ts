import type { InterventionAction } from "@keel/contracts";

interface InterventionOptions {
  action: Exclude<InterventionAction, { type: "allow" }>;
  goal: string;
  onAllow: () => void;
  onReturn: () => boolean;
}

const styles = `
  /* Hallmark · overlay: quiet sheet · tone: friendly-serious */
  :host { all: initial; }
  * { box-sizing: border-box; }
  .fg-layer {
    --ink: #1b1e20;
    --ink-soft: #5c6267;
    --ink-faint: #878d92;
    --paper: #ffffff;
    --inset: #f4f4f1;
    --line: #e4e3de;
    --red: #b3372b;
    --red-deep: #8f2a21;
    position: fixed;
    z-index: 2147483647;
    color: var(--ink);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  .fg-layer.toast {
    right: 16px;
    bottom: 16px;
    width: min(360px, calc(100vw - 32px));
  }
  .fg-layer.interstitial {
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(20, 19, 17, 0.5);
    overflow-y: auto;
  }
  .fg-sheet {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 20px;
    background: var(--paper);
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  }
  .interstitial .fg-sheet {
    width: min(420px, 100%);
    max-height: calc(100vh - 48px);
    margin: auto;
    overflow-y: auto;
    padding: 28px;
  }
  .fg-seal {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 12px;
    color: var(--ink-faint);
    font-size: 12.5px;
    font-weight: 600;
  }
  .fg-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); }
  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 650;
    line-height: 1.25;
    letter-spacing: -0.01em;
  }
  .interstitial h2 { font-size: 24px; }
  p { margin: 8px 0 0; color: var(--ink-soft); font-size: 13.5px; line-height: 1.5; }
  .fg-goal {
    margin: 12px 0 20px;
    border-radius: 8px;
    padding: 10px 12px;
    background: var(--inset);
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
  }
  .fg-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  button {
    min-height: 40px;
    border-radius: 8px;
    padding: 0 14px;
    font: 700 13px/1 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    cursor: pointer;
  }
  button:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
  .fg-return { border: 1px solid var(--red-deep); color: #fff; background: var(--red); }
  .fg-return:hover { background: var(--red-deep); }
  .fg-allow { border: 1px solid var(--line); color: var(--ink-soft); background: transparent; }
  .fg-allow:hover { border-color: #d3d2cb; color: var(--ink); }
  .fg-allow:disabled { cursor: wait; opacity: .55; }
  .fg-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

function button(label: string, className: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  return element;
}

export function mountIntervention(options: InterventionOptions): () => void {
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const host = document.createElement("div");
  host.dataset.keelUi = "true";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = styles;

  const layer = document.createElement("div");
  layer.className = `fg-layer ${options.action.type}`;
  const sheet = document.createElement("section");
  sheet.className = "fg-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", options.action.type === "interstitial" ? "true" : "false");
  sheet.setAttribute("aria-labelledby", "fg-title");

  const seal = document.createElement("div");
  seal.className = "fg-seal";
  const dot = document.createElement("span");
  dot.className = "fg-dot";
  dot.setAttribute("aria-hidden", "true");
  seal.append(dot, document.createTextNode("Keel"));

  const title = document.createElement("h2");
  title.id = "fg-title";
  title.textContent = "This page doesn't match your goal.";
  const copy = document.createElement("p");
  copy.textContent = "Your goal:";
  const goal = document.createElement("div");
  goal.className = "fg-goal";
  goal.textContent = options.goal;

  const actions = document.createElement("div");
  actions.className = "fg-actions";
  const returnButton = button("Return to goal", "fg-return");
  const allowButton = button("Continue anyway", "fg-allow");
  actions.append(returnButton, allowButton);

  const announcement = document.createElement("div");
  announcement.className = "fg-sr-only";
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", "polite");
  announcement.textContent = `This page doesn't match your goal: ${options.goal}`;

  let remaining = options.action.type === "interstitial" ? options.action.delaySeconds : 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  if (remaining > 0) {
    allowButton.disabled = true;
    allowButton.textContent = `Continue in ${remaining}s`;
    timer = setInterval(() => {
      remaining -= 1;
      allowButton.textContent = remaining > 0 ? `Continue in ${remaining}s` : "Continue anyway";
      if (remaining <= 0) {
        allowButton.disabled = false;
        if (timer) clearInterval(timer);
      }
    }, 1_000);
  }

  const cleanup = () => {
    if (timer) clearInterval(timer);
    host.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  returnButton.addEventListener("click", () => {
    if (options.onReturn()) cleanup();
  });
  allowButton.addEventListener("click", () => {
    if (allowButton.disabled) return;
    cleanup();
    options.onAllow();
  });

  if (options.action.type === "interstitial") {
    shadow.addEventListener("keydown", (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault();
        if (options.onReturn()) cleanup();
        return;
      }
      if (keyboardEvent.key !== "Tab") return;
      const available = [returnButton, allowButton].filter((item) => !item.disabled);
      const currentIndex = available.indexOf(shadow.activeElement as HTMLButtonElement);
      const direction = keyboardEvent.shiftKey ? -1 : 1;
      const nextIndex = (currentIndex + direction + available.length) % available.length;
      keyboardEvent.preventDefault();
      available[nextIndex]?.focus();
    });
  }

  sheet.append(announcement, seal, title, copy, goal, actions);
  layer.append(sheet);
  shadow.append(style, layer);
  document.documentElement.append(host);
  if (options.action.type === "interstitial") returnButton.focus();
  return cleanup;
}
