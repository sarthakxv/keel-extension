import type { FocusAction } from "@focus-guardian/contracts";

interface InterventionOptions {
  action: Exclude<FocusAction, { type: "allow" }>;
  goal: string;
  onAllow: () => void;
  onReturn: () => boolean;
}

const styles = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .fg-layer {
    --paper: #f4efe5;
    --paper-raised: #faf6ee;
    --graphite: #292522;
    --graphite-soft: #665e57;
    --tomato: #ad4436;
    --tomato-deep: #8e352b;
    --line: rgba(56, 47, 40, 0.18);
    position: fixed;
    z-index: 2147483647;
    color: var(--graphite);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }
  .fg-layer.toast {
    right: 24px;
    bottom: 24px;
    width: min(380px, calc(100vw - 32px));
  }
  .fg-layer.interstitial {
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(31, 27, 24, 0.54);
    backdrop-filter: blur(3px);
    overflow-y: auto;
  }
  .fg-sheet {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 22px;
    background: var(--paper-raised);
    box-shadow: 0 18px 60px rgba(22, 18, 15, 0.18);
  }
  .interstitial .fg-sheet {
    width: min(440px, 100%);
    max-height: calc(100vh - 48px);
    margin: auto;
    overflow-y: auto;
    padding: 32px;
  }
  .fg-seal {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
    color: var(--tomato-deep);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .fg-dot { width: 9px; height: 9px; border: 2px solid var(--tomato); border-radius: 50%; }
  h2 {
    margin: 0;
    color: var(--graphite);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 27px;
    font-weight: 500;
    line-height: 1.12;
    letter-spacing: -.015em;
  }
  .interstitial h2 { font-size: 36px; }
  p { margin: 10px 0 20px; color: var(--graphite-soft); font-size: 14px; line-height: 1.5; }
  .fg-goal {
    margin: 14px 0 24px;
    border-left: 2px solid var(--tomato);
    padding-left: 12px;
    color: var(--graphite);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    line-height: 1.35;
  }
  .fg-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  button {
    min-height: 42px;
    border-radius: 8px;
    padding: 0 15px;
    font: 700 13px/1 Inter, ui-sans-serif, system-ui, sans-serif;
    cursor: pointer;
  }
  button:focus-visible { outline: 3px solid rgba(173, 68, 54, .28); outline-offset: 2px; }
  .fg-return { border: 1px solid var(--tomato-deep); color: #fffaf2; background: var(--tomato); }
  .fg-return:hover { background: var(--tomato-deep); }
  .fg-allow { border: 1px solid var(--line); color: var(--graphite-soft); background: transparent; }
  .fg-allow:disabled { cursor: wait; opacity: .55; }
  .fg-crack { position: absolute; top: -10px; right: 42px; width: 1px; height: 70px; background: var(--tomato); transform: rotate(31deg); opacity: .5; }
  .fg-crack::after { content: ""; position: absolute; top: 34px; left: 0; width: 30px; height: 1px; background: var(--tomato); transform: rotate(-48deg); transform-origin: left; }
  .fg-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  @media (prefers-reduced-motion: reduce) { .fg-layer { backdrop-filter: none; } }
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
  host.dataset.focusGuardianUi = "true";
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
  seal.append(dot, document.createTextNode("Focus check"));

  const title = document.createElement("h2");
  title.id = "fg-title";
  title.textContent = "This looks outside your interval.";
  const copy = document.createElement("p");
  copy.textContent = "You made one promise for this block of time:";
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
  announcement.textContent = `Focus check. This page looks outside your goal: ${options.goal}`;

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

  if (options.action.type === "interstitial") {
    const crack = document.createElement("span");
    crack.className = "fg-crack";
    crack.setAttribute("aria-hidden", "true");
    sheet.append(crack);
  }
  sheet.append(announcement, seal, title, copy, goal, actions);
  layer.append(sheet);
  shadow.append(style, layer);
  document.documentElement.append(host);
  if (options.action.type === "interstitial") returnButton.focus();
  return cleanup;
}
