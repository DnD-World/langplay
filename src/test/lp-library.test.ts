import { describe, it, expect } from "vitest";
import { LIBRARY, parseRecipe, describeExample, humanize } from "@/lib/lp-library";
describe("reviewable library imports", () => {
  it("accepts plain text steps without trusting execution metadata", () => {
    const r = parseRecipe(
      JSON.stringify({
        title: "Example",
        steps: [{ kind: "agent", instruction: "Answer {question}", execute: "evil" }],
      }),
    );
    expect(r.nodes).toEqual([
      { id: "n1", kind: "agent", label: "AI Thinking (Agent)", instruction: "Answer {question}" },
    ]);
  });
  it("rejects unknown and inherited step types, missing instructions and empty recipes", () => {
    for (const steps of [
      [{ kind: "toString", instruction: "x" }],
      [{ kind: "exec", instruction: "x" }],
      [{ kind: "agent" }],
      [],
    ])
      expect(() => parseRecipe(JSON.stringify({ steps }))).toThrow();
  });
  it("provides clear provenance and requirements across all extension types", () => {
    expect(new Set(LIBRARY.map((e) => e.kind)).size).toBe(4);
    for (const entry of LIBRARY) {
      expect(entry.url).toMatch(/^https:\/\//);
      expect(entry.needs.length).toBeGreaterThan(20);
      expect(entry.next.length).toBeGreaterThan(20);
    }
  });
  it("gives learning-oriented topic hints, not raw paths alone", () => {
    expect(describeExample("rag_agent.ipynb").category).toBe("Document Q&A");
    expect(humanize("examples/writer_critic.ipynb")).toBe("Writer Critic");
  });
});
