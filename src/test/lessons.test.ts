import { afterEach, describe, expect, it, vi } from "vitest";
import { runRecipe, simulatorChat, chunkPages, searchChunks, type Recipe } from "@/engine";
import { LESSONS, type LessonEvent } from "@/lib/lp-lessons";
import { defaultRecipe } from "@/lib/lp-recipes";

const lesson = (id: string) => LESSONS.find((l) => l.id === id)!;
const sim = { chat: simulatorChat, simulated: true };
const ctx = (
  recipe: Recipe,
  run?: Awaited<ReturnType<typeof runRecipe>>,
  events: LessonEvent[] = [],
) => ({
  recipe,
  run,
  events: new Set(events),
});

afterEach(() => vi.unstubAllGlobals());

describe("lessons are earned by doing", () => {
  it("has twelve lessons with unique ids and a goal for each", () => {
    expect(LESSONS).toHaveLength(12);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(12);
  });

  it("first run and haiku prompt", async () => {
    const r = defaultRecipe();
    expect(lesson("l-run").check(ctx(r))).toBe(false);
    const run = await runRecipe(r, "rain", {
      ...sim,
      tools: { wikipedia: async () => ({ text: "x", sources: [] }) },
    });
    expect(lesson("l-run").check(ctx(r, run))).toBe(true);
    expect(lesson("l-prompt").check(ctx(r, run))).toBe(false);
    const haiku = {
      ...r,
      nodes: r.nodes.map((n) =>
        n.kind === "input" ? { ...n, instruction: "Answer as a haiku: {question}" } : n,
      ),
    };
    const run2 = await runRecipe(haiku, "rain", {
      ...sim,
      tools: { wikipedia: async () => ({ text: "x", sources: [] }) },
    });
    expect(lesson("l-prompt").check(ctx(haiku, run2))).toBe(true);
  });

  it("calculator, router and loop starters pass with the Simulator", async () => {
    for (const [id, question] of [
      ["l-calc", "What is 17% of 2,340?"],
      ["l-route", "I was charged twice, can I get my money back?"],
      ["l-loop", "a limerick about tax law"],
    ] as const) {
      const recipe = lesson(id).starter!();
      const run = await runRecipe(recipe, question, sim);
      expect(lesson(id).check(ctx(recipe, run)), id).toBe(true);
    }
  });

  it("Wikipedia and documents need real results, not practice data", async () => {
    const fact = lesson("l-wiki").starter!();
    const practice = await runRecipe(fact, "x", {
      ...sim,
      tools: { wikipedia: async () => ({ text: "", sources: [] }) },
    });
    expect(lesson("l-wiki").check(ctx(fact, practice))).toBe(false);
    const real = await runRecipe(fact, "x", {
      ...sim,
      tools: {
        wikipedia: async () => ({ text: "A", sources: [{ title: "Wikipedia: A", snippet: "A" }] }),
      },
    });
    expect(lesson("l-wiki").check(ctx(fact, real))).toBe(true);

    const pdf = lesson("l-rag").starter!();
    const none = await runRecipe(pdf, "goldfish", sim);
    expect(lesson("l-rag").check(ctx(pdf, none))).toBe(false);
    const chunks = chunkPages("pets.txt", ["Goldfish need a big tank."]);
    const found = await runRecipe(pdf, "goldfish tank", {
      ...sim,
      searchDocs: (q, k) => searchChunks(chunks, q, k),
    });
    expect(lesson("l-rag").check(ctx(pdf, found))).toBe(true);
  });

  it("a third router path counts only when the run takes it", async () => {
    const base = lesson("l-route").starter!();
    const router = base.nodes.find((n) => n.kind === "router")!;
    const three = {
      ...base,
      nodes: base.nodes.map((n) =>
        n.id === router.id ? { ...n, routes: [...(n.routes ?? []), { label: "shipping" }] } : n,
      ),
    };
    const run = await runRecipe(three, "Where is my shipping parcel?", sim);
    expect(lesson("l-route3").check(ctx(three, run))).toBe(true);
    const run2 = await runRecipe(three, "refund please", sim);
    expect(lesson("l-route3").check(ctx(three, run2))).toBe(false);
  });

  it("graph edge, compare, python and spin-out", () => {
    const r = defaultRecipe();
    expect(lesson("l-graph").check(ctx(r))).toBe(false);
    const jumped = {
      ...r,
      nodes: r.nodes.map((n, i) => (i === 0 ? { ...n, next: r.nodes[2]!.id } : n)),
    };
    expect(lesson("l-graph").check(ctx(jumped))).toBe(true);
    expect(lesson("l-compare").check(ctx(r, undefined, ["compared"]))).toBe(true);
    expect(lesson("l-python").check(ctx(r, undefined, ["python"]))).toBe(true);
    expect(lesson("l-spinout").check(ctx(r, undefined, ["spinout"]))).toBe(true);
  });
});
