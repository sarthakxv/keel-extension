// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { extractVisibleText } from "./extract";

describe("page context extraction", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("keeps main content and excludes editable or navigational text", () => {
    document.body.innerHTML = `
      <nav>Distracting menu</nav>
      <main>
        <h1>Project research</h1>
        <p>Useful reference material for the current task.</p>
        <form><textarea>private draft</textarea><button>Submit secret</button></form>
        <div contenteditable="true">unfinished private note</div>
      </main>
    `;
    const text = extractVisibleText(document);
    expect(text).toContain("Project research");
    expect(text).toContain("Useful reference material");
    expect(text).not.toContain("private draft");
    expect(text).not.toContain("unfinished private note");
    expect(text).not.toContain("Distracting menu");
  });

  it("caps the excerpt", () => {
    document.body.innerHTML = `<main><p>${"work ".repeat(500)}</p></main>`;
    expect(extractVisibleText(document).length).toBe(1_500);
  });

  it("excludes contenteditable variants", () => {
    document.body.innerHTML = `
      <main>
        <p>Safe project context</p>
        <div contenteditable>private bare editor text</div>
        <div contenteditable="">private empty editor text</div>
        <div contenteditable="plaintext-only">private plaintext editor text</div>
      </main>
    `;
    const text = extractVisibleText(document);
    expect(text).toBe("Safe project context");
  });

  it("excludes Keel UI from the excerpt", () => {
    document.body.innerHTML = `
      <main>
        <h1>Project research</h1>
        <div data-keel-ui="true">Reading this page On task 84%</div>
        <p>Useful reference material for the current task.</p>
      </main>
    `;
    const text = extractVisibleText(document);
    expect(text).toContain("Project research");
    expect(text).not.toContain("Reading this page");
    expect(text).not.toContain("On task");
  });

  it("excludes content hidden by an ancestor", () => {
    document.body.innerHTML = `
      <main>
        <p>Visible project context</p>
        <section style="display: none"><p>hidden private instructions</p></section>
      </main>
    `;
    const text = extractVisibleText(document);
    expect(text).toBe("Visible project context");
  });
});
