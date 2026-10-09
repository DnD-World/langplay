import { describe, expect, it } from "vitest";
import { cleanMath, markdownToDom, parseMarkdown } from "@/runner/markdown";

describe("answer formatting", () => {
  it("reads bold, lists, headings and code", () => {
    const blocks = parseMarkdown(
      "## Steps\n1. **Find** the `discount`\n2. Subtract\n\n- a\n- b\n\nDone *now*.",
    );
    expect(blocks.map((b) => b.type)).toEqual(["h", "ol", "ul", "p"]);
    expect(blocks[1]).toMatchObject({
      items: [
        [{ text: "Find", bold: true }, { text: " the " }, { text: "discount", code: true }],
        [{ text: "Subtract" }],
      ],
    });
  });
  it("keeps list numbering across interruptions", () => {
    const blocks = parseMarkdown(["1. First", "- detail", "2. Second"].join("\n"));
    expect(blocks.map((b) => (b.type === "ol" ? `ol@${b.start}` : b.type))).toEqual([
      "ol@1",
      "ul",
      "ol@2",
    ]);
  });
  it("cleans maths markup", () => {
    expect(cleanMath(String.raw`\( 84 \times 0.25 = 21 \text{ euros} \)`)).toBe(
      " 84 × 0.25 = 21  euros ",
    );
  });
  it("never turns model text into HTML", () => {
    const frag = markdownToDom('<img src=x onerror="alert(1)"> **<b>hi</b>**');
    const div = document.createElement("div");
    div.append(frag);
    expect(div.querySelector("img")).toBeNull();
    expect(div.querySelector("b")).toBeNull();
    expect(div.textContent).toContain("<img src=x");
  });
});
