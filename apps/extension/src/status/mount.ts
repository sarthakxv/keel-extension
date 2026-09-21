import { statusHudCopy, type StatusHudState } from "./summary";

const styles = `
  /* Hallmark · pill: dot + words · tone: friendly-serious */
  :host { all: initial; }
  * { box-sizing: border-box; }
  .fg-status {
    --dot: #9aa0a6;
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483646;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: min(280px, calc(100vw - 32px));
    border-radius: 999px;
    padding: 8px 14px 8px 12px;
    color: #f7f7f5;
    background: rgba(27, 30, 32, 0.92);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.22);
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.35;
    white-space: nowrap;
  }
  .fg-status[data-tone="on_task"] { --dot: #5fb483; }
  .fg-status[data-tone="useful_detour"] { --dot: #e0a44a; }
  .fg-status[data-tone="off_task"] { --dot: #e4695e; }
  .fg-status[data-tone="checking"] { --dot: #c9cdd1; }
  .fg-dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--dot);
  }
  .fg-status[data-tone="checking"] .fg-dot {
    animation: fg-pulse 1.4s ease-in-out infinite;
  }
  .fg-text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @keyframes fg-pulse {
    50% { opacity: .35; }
  }
  @media (prefers-reduced-motion: reduce) {
    .fg-status[data-tone="checking"] .fg-dot { animation: none; }
  }
`;

export function createStatusHudView(state: StatusHudState): HTMLElement {
  const copy = statusHudCopy(state);
  const layer = document.createElement("div");
  layer.className = "fg-status";
  layer.dataset.tone = copy.tone;
  layer.setAttribute("role", "status");
  layer.setAttribute("aria-live", "polite");
  layer.setAttribute("aria-atomic", "true");
  layer.setAttribute("aria-label", copy.liveText);
  layer.title = copy.liveText;

  const dot = document.createElement("span");
  dot.className = "fg-dot";
  dot.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.className = "fg-text";
  text.textContent = copy.text;

  layer.append(dot, text);
  return layer;
}

export function mountStatusHud() {
  let host: HTMLDivElement | undefined;
  let shadow: ShadowRoot | undefined;

  function ensureHost() {
    if (host && shadow) return;
    host = document.createElement("div");
    host.dataset.keelUi = "true";
    shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = styles;
    shadow.append(style);
    document.documentElement.append(host);
  }

  function remove() {
    host?.remove();
    host = undefined;
    shadow = undefined;
  }

  function render(state: StatusHudState | null) {
    if (!state) {
      remove();
      return;
    }
    ensureHost();
    shadow?.querySelector(".fg-status")?.remove();
    shadow?.append(createStatusHudView(state));
  }

  return { render, remove };
}
