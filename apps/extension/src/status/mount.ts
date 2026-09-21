import { alignmentSegments, statusHudCopy, type StatusHudState } from "./summary";

const styles = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .fg-status {
    --paper: #f4efe5;
    --paper-raised: #faf6ee;
    --graphite: #292522;
    --graphite-soft: #665e57;
    --graphite-faint: #6f655d;
    --tomato: #ad4436;
    --olive: #65704c;
    --warning: #a86f2d;
    --line: rgba(56, 47, 40, 0.18);
    --tone: var(--graphite-faint);
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 2147483646;
    width: min(320px, calc(100vw - 32px));
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px 14px 13px;
    color: var(--graphite);
    background: var(--paper-raised);
    box-shadow: 0 14px 40px rgba(22, 18, 15, 0.16);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }
  .fg-status::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: var(--tone);
  }
  .fg-status[data-tone="on_task"] { --tone: var(--olive); }
  .fg-status[data-tone="useful_detour"] { --tone: var(--warning); }
  .fg-status[data-tone="off_task"] { --tone: var(--tomato); }
  .fg-eyebrow {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--tone);
    font-size: 10px;
    font-weight: 750;
    letter-spacing: .14em;
    text-transform: uppercase;
  }
  .fg-dot {
    width: 7px;
    height: 7px;
    border: 2px solid var(--tone);
    border-radius: 50%;
  }
  .fg-status[data-tone="checking"] .fg-dot {
    background: var(--tone);
    animation: fg-pulse 1.4s ease-in-out infinite;
  }
  .fg-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-top: 6px;
  }
  .fg-title {
    margin: 0;
    color: var(--graphite);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 20px;
    font-weight: 500;
    line-height: 1.15;
    letter-spacing: -.02em;
  }
  .fg-confidence {
    color: var(--tone);
    font-family: Georgia, "Times New Roman", serif;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
    letter-spacing: -.03em;
  }
  p {
    margin: 6px 0 0;
    color: var(--graphite-soft);
    font-size: 12px;
    line-height: 1.4;
  }
  .fg-mix {
    display: flex;
    overflow: hidden;
    height: 5px;
    margin-top: 10px;
    border-radius: 999px;
    background: rgba(56, 47, 40, 0.08);
  }
  .fg-mix span { min-width: 0; }
  .fg-mix [data-alignment="on_task"] { background: var(--olive); }
  .fg-mix [data-alignment="useful_detour"] { background: var(--warning); }
  .fg-mix [data-alignment="off_task"] { background: var(--tomato); }
  .fg-mix [data-alignment="insufficient_evidence"] { background: var(--graphite-faint); }
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

  const eyebrow = document.createElement("div");
  eyebrow.className = "fg-eyebrow";
  const dot = document.createElement("span");
  dot.className = "fg-dot";
  dot.setAttribute("aria-hidden", "true");
  eyebrow.append(dot, document.createTextNode(copy.eyebrow));

  const row = document.createElement("div");
  row.className = "fg-row";
  const title = document.createElement("div");
  title.className = "fg-title";
  title.textContent = copy.title;
  row.append(title);
  if (copy.confidence) {
    const confidence = document.createElement("span");
    confidence.className = "fg-confidence";
    confidence.textContent = copy.confidence;
    row.append(confidence);
  }

  const detail = document.createElement("p");
  detail.textContent = copy.detail;

  layer.append(eyebrow, row, detail);

  if (state.kind === "result") {
    const mix = document.createElement("div");
    mix.className = "fg-mix";
    mix.setAttribute("aria-hidden", "true");
    for (const segment of alignmentSegments(state.evaluation)) {
      const tick = document.createElement("span");
      tick.dataset.alignment = segment.key;
      tick.style.flexGrow = String(segment.probability);
      tick.title = `${segment.label} ${segment.percent}`;
      mix.append(tick);
    }
    layer.append(mix);
  }

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
