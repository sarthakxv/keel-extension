import type { PageContext } from "@focus-guardian/contracts";

const EXCLUDED_SELECTOR = [
  "script",
  "style",
  "noscript",
  "form",
  "input",
  "textarea",
  "select",
  "button",
  "nav",
  "header",
  "footer",
  "[contenteditable='true']",
  "[aria-hidden='true']",
  "[hidden]",
  "[data-focus-guardian-ui]",
].join(",");

const MAX_EXCERPT_LENGTH = 1_500;

function isVisible(element: Element): boolean {
  const style = getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

export function extractVisibleText(document: Document): string {
  const root =
    document.querySelector("main, [role='main'], article") ?? document.body;
  if (!root) return "";

  const chunks: string[] = [];
  let length = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  while (walker.nextNode() && length < MAX_EXCERPT_LENGTH) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    if (!parent || parent.closest(EXCLUDED_SELECTOR) || !isVisible(parent)) continue;
    const text = node.textContent?.replace(/\s+/g, " ").trim();
    if (!text) continue;
    chunks.push(text);
    length += text.length + 1;
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_EXCERPT_LENGTH);
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function extractPageContext(document: Document): Promise<PageContext | null> {
  if (!document.body || document.visibilityState === "hidden") return null;
  const hostname = document.location.hostname;
  if (!hostname) return null;
  const title = document.title.trim().slice(0, 200);
  const excerpt = extractVisibleText(document);
  if (!title && excerpt.length < 40) return null;
  const fingerprint = await sha256(`${hostname}\n${title}\n${excerpt}`);
  return { hostname, title, excerpt, fingerprint };
}

