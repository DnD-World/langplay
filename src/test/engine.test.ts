import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculate,
  chunkPages,
  extractExpression,
  normalizeRecipe,
  runRecipe,
  searchChunks,
  simulatorChat,
  costOf,
  outgoing,
  type ChatFn,
  type Msg,
  type Recipe,
} from "@/engine";
import { wikipedia, websearch } from "@/engine/tools";

const reply =
  (fn: (messages: Msg[]) => string): ChatFn =>
  async (messages) => ({
    text: fn(messages),
    usage: { prompt: 10, completion: 5, estimated: false },
    provider: "test",
    model: "m",
  });

const recipe = (nodes: Recipe["nodes"]): Recipe => ({
  version: 2,
  title: "t",
  summary: "s",
  nodes,
});

afterEach(() => vi.unstubAllGlobals());

describe("engine: running recipes", () => {
  it("runs a linear recipe in order and returns the final answer with a full trace", async () => {
    const r = recipe([
      { id: "a", kind: "input", label: "In", instruction: "Explain: {question}" },
      { id: "b", kind: "agent", label: "Think", instruction: "Draft it" },
      { id: "c", kind: "final", label: "Done", instruction: "Polish" },
    ]);
    const seen: string[] = [];
    const result = await runRecipe(
      r,
      "rainbows",
      { chat: reply((m) => `out:${m[0]?.content.split(" ")[0]}`) },
      (e) => e.type === "step" && seen.push(e.trace.nodeId),
    );
    expect(seen).toEqual(["a", "b", "c"]);
    expect(result.steps[0]?.output).toBe("Explain: rainbows");
    expect(result.answer).toBe("out:Polish");
    expect(result.steps[1]?.messages?.[1]?.content).toContain("Explain: rainbows");
    expect(result.steps[2]?.messages?.[1]?.content).toContain("Current draft:\nout:Draft");
    expect(result.usage).toEqual({ prompt: 20, completion: 10, estimated: false });
  });

  it("lets the AI pick a route and jumps to that route's step", async () => {
    const r = recipe([
      { id: "in", kind: "input", label: "In", instruction: "{question}" },
      {
        id: "r",
        kind: "router",
        label: "Router",
        instruction: "Billing or tech?",
        routes: [
          { label: "billing", to: "bill" },
          { label: "tech", to: "tech" },
        ],
      },
      { id: "bill", kind: "final", label: "Billing desk", instruction: "Billing answer" },
      { id: "tech", kind: "final", label: "Tech desk", instruction: "Tech answer" },
    ]);
    const result = await runRecipe(r, "my app crashes", {
      chat: reply((m) => (m[0]?.content.includes("router") ? "Tech." : m[0]!.content)),
    });
    expect(result.steps.map((s) => s.nodeId)).toEqual(["in", "r", "tech"]);
    expect(result.steps[1]?.decision).toContain('Chose "tech"');
  });

  it("loops a critic back until PASS, and never past its loop limit", async () => {
    const r = recipe([
      { id: "w", kind: "agent", label: "Writer", instruction: "Write" },
      { id: "c", kind: "critic", label: "Critic", instruction: "Check", retryTo: "w", maxLoops: 2 },
      { id: "f", kind: "final", label: "Final", instruction: "Finish" },
    ]);
    const neverHappy = await runRecipe(r, "q", {
      chat: reply((m) => (m[0]?.content.includes("Reply PASS") ? "REVISE: more detail" : "draft")),
    });
    expect(neverHappy.steps.map((s) => s.nodeId)).toEqual(["w", "c", "w", "c", "w", "c", "f"]);
    expect(neverHappy.steps[2]?.messages?.[1]?.content).toContain(
      "Reviewer feedback to fix:\nmore detail",
    );
    expect(neverHappy.steps[5]?.decision).toContain("loop limit");

    let checks = 0;
    const happySecondTime = await runRecipe(r, "q", {
      chat: reply((m) =>
        m[0]?.content.includes("Reply PASS") ? (++checks > 1 ? "PASS" : "REVISE: x") : "draft",
      ),
    });
    expect(happySecondTime.steps.map((s) => s.nodeId)).toEqual(["w", "c", "w", "c", "f"]);
  });

  it("stops runaway loops with the step guard", async () => {
    const r = recipe([
      { id: "a", kind: "agent", label: "A", instruction: "x", next: "b" },
      { id: "b", kind: "agent", label: "B", instruction: "y", next: "a" },
    ]);
    const result = await runRecipe(r, "q", { chat: reply(() => "ok") });
    expect(result.stoppedByGuard).toBe(true);
    expect(result.steps).toHaveLength(50);
  });

  it("falls back to the Simulator when the AI service fails, and says so", async () => {
    const r = recipe([{ id: "a", kind: "agent", label: "A", instruction: "x" }]);
    const result = await runRecipe(r, "q", {
      chat: async () => {
        throw new Error("The AI service replied (429): busy");
      },
      fallbackChat: simulatorChat,
    });
    expect(result.fallbacks).toBe(1);
    expect(result.steps[0]?.note).toContain("429");
    expect(result.answer).toContain("practice answer");
  });

  it("uses the calculator tool with an AI-written expression and records sources", async () => {
    const r = recipe([
      { id: "t", kind: "tool", label: "Calc", instruction: "Work it out", tool: "calculator" },
      { id: "f", kind: "final", label: "F", instruction: "Answer" },
    ]);
    const result = await runRecipe(r, "what is 12 times 7?", {
      chat: reply((m) => (m[0]?.content.includes("tool input only") ? "12*7" : "84")),
    });
    expect(result.steps[0]?.input).toBe("12*7");
    expect(result.steps[0]?.output).toBe("12*7 = 84");
    expect(result.steps[1]?.messages?.[1]?.content).toContain("Calculator: 12*7 = 84");
  });

  it("derives tool input without an extra AI call when simulated", async () => {
    const chat = vi.fn(simulatorChat);
    const r = recipe([
      { id: "t", kind: "tool", label: "Calc", instruction: "", tool: "calculator" },
    ]);
    const result = await runRecipe(r, "What is 15% of 80?", { chat, simulated: true });
    expect(chat).not.toHaveBeenCalled();
    expect(result.steps[0]?.output).toBe("(15/100*80) = 12");
  });

  it("searches uploaded documents and cites file and page", async () => {
    const chunks = chunkPages("guide.pdf", [
      "Cats sleep a lot.",
      "Photosynthesis turns light into sugar.",
    ]);
    const r = recipe([{ id: "d", kind: "retriever", label: "Docs", instruction: "" }]);
    const result = await runRecipe(r, "how does photosynthesis work", {
      chat: reply(() => ""),
      searchDocs: (q, k) => searchChunks(chunks, q, k),
    });
    expect(result.steps[0]?.sources?.[0]?.title).toBe("guide.pdf · p.2");
    expect(result.steps[0]?.practice).toBeUndefined();
  });

  it("labels practice data when no documents are added", async () => {
    const r = recipe([{ id: "d", kind: "retriever", label: "Docs", instruction: "" }]);
    const result = await runRecipe(r, "q", { chat: reply(() => "") });
    expect(result.steps[0]?.practice).toBe(true);
    expect(result.steps[0]?.note).toContain("No documents");
  });

  it("keeps a v1 critic without a loop as a rewriter", async () => {
    const r = normalizeRecipe({
      steps: [
        { kind: "agent", instruction: "Write" },
        { kind: "critic", instruction: "Rewrite better" },
      ],
    });
    const result = await runRecipe(r, "q", { chat: reply((m) => m[0]!.content.slice(0, 7)) });
    expect(result.answer).toBe("Rewrite");
  });
});

describe("engine: recipe validation", () => {
  it("converts v1 steps and drops unknown properties", () => {
    const r = normalizeRecipe({
      title: "X",
      steps: [{ kind: "agent", instruction: "Hi", execute: "evil" }],
    });
    expect(r.version).toBe(2);
    expect(r.nodes[0]).toEqual({
      id: "n1",
      kind: "agent",
      label: "AI Thinking (Agent)",
      instruction: "Hi",
    });
  });
  it("rejects unknown kinds, inherited names, missing text and empty recipes", () => {
    for (const steps of [
      [{ kind: "toString", instruction: "x" }],
      [{ kind: "exec", instruction: "x" }],
      [{ kind: "agent" }],
      [],
    ])
      expect(() => normalizeRecipe({ steps })).toThrow();
  });
  it("removes references to steps that do not exist", () => {
    const r = normalizeRecipe({
      nodes: [
        { id: "a", kind: "critic", instruction: "", retryTo: "ghost", next: "nowhere" },
        { id: "b", kind: "router", instruction: "", routes: [{ label: "x", to: "ghost" }] },
      ],
    });
    expect(r.nodes[0]?.retryTo).toBeUndefined();
    expect(r.nodes[0]?.next).toBeUndefined();
    expect(r.nodes[1]?.routes).toEqual([{ label: "x" }]);
  });
  it("describes outgoing paths for routers and critics", () => {
    const r = recipe([
      { id: "w", kind: "agent", label: "W", instruction: "" },
      { id: "c", kind: "critic", label: "C", instruction: "", retryTo: "w" },
      { id: "f", kind: "final", label: "F", instruction: "" },
    ]);
    expect(outgoing(r, r.nodes[1]!)).toEqual([
      { label: "good", to: "f" },
      { label: "needs work", to: "w" },
    ]);
  });
});

describe("engine: calculator, search, cost", () => {
  it("calculates without eval and refuses code", () => {
    expect(calculate("2+3*4^2")).toBe(50);
    expect(calculate("sqrt(16)+abs(-2)")).toBe(6);
    expect(calculate("-(2+3)*2")).toBe(-10);
    expect(() => calculate("alert(1)")).toThrow();
    expect(() => calculate("1/0")).toThrow();
    expect(extractExpression("What is 1,200 divided by 4?")).toBe("1200 / 4");
  });
  it("ranks the most relevant passage first", () => {
    const chunks = chunkPages("a.txt", [
      "Dogs bark loudly.\n\nThe moon orbits the earth every month.",
    ]);
    expect(searchChunks(chunks, "moon orbit", 1)[0]?.snippet).toContain("moon");
    expect(searchChunks(chunks, "zzz", 1)).toEqual([]);
  });
  it("only shows money when the price is known", () => {
    const u = { prompt: 1000, completion: 500, estimated: false };
    expect(costOf({ provider: "pollinations" }, u).kind).toBe("free");
    expect(costOf({ provider: "openai" }, u).kind).toBe("unknown");
    expect(
      costOf({ provider: "openrouter", pricing: { prompt: 1e-6, completion: 2e-6 } }, u),
    ).toEqual({
      kind: "priced",
      usd: 0.002,
    });
  });
  it("reads Wikipedia results into cited sources", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            query: {
              pages: {
                "2": {
                  title: "Second",
                  extract: "B text",
                  fullurl: "https://en.wikipedia.org/wiki/B",
                  index: 2,
                },
                "1": {
                  title: "First",
                  extract: "A text",
                  fullurl: "https://en.wikipedia.org/wiki/A",
                  index: 1,
                },
              },
            },
          }),
        ),
      ),
    );
    const result = await wikipedia("x");
    expect(result.sources.map((s) => s.title)).toEqual(["Wikipedia: First", "Wikipedia: Second"]);
  });
  it("falls back from an empty web answer to Wikipedia", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ RelatedTopics: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ query: { pages: {} } })));
    vi.stubGlobal("fetch", fetchMock);
    const result = await websearch("obscure");
    expect(result.text).toContain("Wikipedia was searched instead");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
