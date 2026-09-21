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
});

