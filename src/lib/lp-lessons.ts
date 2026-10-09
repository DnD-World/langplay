import { isLinear, type Recipe, type RunResult } from "@/engine";
import { RECIPES, cloneRecipe } from "./lp-recipes";

// The lesson path: small challenges that each teach one LangChain / LangGraph idea.
// Every check looks only at the recipe and the latest run, so progress is earned by doing.

export type LessonEvent = "compared" | "python" | "spinout" | "shared" | "edge";

export interface LessonContext {
  recipe: Recipe;
  run?: RunResult | undefined;
  events: Set<LessonEvent>;
}

export interface Lesson {
  id: string;
  title: string;
  goal: string;
  concept: string;
  hint: string;
  xp: number;
  starter?: () => Recipe;
  check: (ctx: LessonContext) => boolean;
}

const library = (id: string) => () => cloneRecipe(RECIPES.find((r) => r.id === id)!);
const stepsOf = (ctx: LessonContext) => ctx.run?.steps ?? [];
const nodeOf = (ctx: LessonContext, id: string) => ctx.recipe.nodes.find((n) => n.id === id);

export const LESSONS: Lesson[] = [
  {
    id: "l-run",
    title: "Your first chain",
    goal: "Ask any question and press Run.",
    concept: "A chain is steps that run one after another, each passing its result on.",
    hint: "Type a question at the bottom of Live Run and press Run.",
    xp: 30,
    check: (ctx) => !!ctx.run,
  },
  {
    id: "l-prompt",
    title: "Prompt templates",
    goal: "Edit the Input Prompt so the answer comes back as a haiku, then run it.",
    concept:
      "A prompt template is a sentence with a blank ({question}) that your question fills in.",
    hint: 'Click the first step and change its instructions to something like "Answer as a haiku: {question}".',
    xp: 40,
    check: (ctx) =>
      !!ctx.run &&
      ctx.recipe.nodes.some((n) => n.kind === "input" && /haiku/i.test(n.instruction)) &&
      stepsOf(ctx).some((s) => s.kind === "input" && /haiku/i.test(s.output)),
  },
  {
    id: "l-wiki",
    title: "Tools: look it up",
    goal: "Run a recipe whose Tool step searches Wikipedia.",
    concept:
      "Models only know their training data. A tool lets them fetch fresh facts, with sources.",
    hint: "Load the starter (Web Fact Checker) and check a claim, e.g. “The Eiffel Tower is in Rome”.",
    xp: 50,
    starter: library("fact"),
    check: (ctx) =>
      stepsOf(ctx).some(
        (s) =>
          s.kind === "tool" && nodeOf(ctx, s.nodeId)?.tool === "wikipedia" && !!s.sources?.length,
      ),
  },
  {
    id: "l-calc",
    title: "Tools: exact maths",
    goal: "Get a calculator result inside a run.",
    concept: "Language models guess numbers. A calculator tool computes them exactly.",
    hint: "Load the starter (Maths Homework Helper) and ask “What is 17% of 2,340?”.",
    xp: 50,
    starter: library("math"),
    check: (ctx) =>
      stepsOf(ctx).some(
        (s) =>
          s.kind === "tool" && nodeOf(ctx, s.nodeId)?.tool === "calculator" && / = /.test(s.output),
      ),
  },
  {
    id: "l-rag",
    title: "RAG: answer from your file",
    goal: "Add a document, then run a recipe that finds a passage in it.",
    concept:
      "Retrieval-augmented generation (RAG): find the relevant passages first, then let the AI answer from them.",
    hint: "Load the starter, press Documents, add any PDF or text file, then ask about something in it.",
    xp: 60,
    starter: library("pdf"),
    check: (ctx) => stepsOf(ctx).some((s) => s.kind === "retriever" && !s.practice),
  },
  {
    id: "l-route",
    title: "Routing",
    goal: "Make the router send a refund question to the billing path.",
    concept:
      "A router is a conditional edge: the AI reads the request and picks which branch runs.",
    hint: "Load the starter and ask “I was charged twice, can I get my money back?”.",
    xp: 60,
    starter: library("router"),
    check: (ctx) =>
      stepsOf(ctx).some((s) => s.kind === "router" && /Chose "billing"/i.test(s.decision ?? "")),
  },
  {
    id: "l-route3",
    title: "A third path",
    goal: "Give the router a third path and get a question routed to it.",
    concept: "Branches are just labels. Add as many as your problem needs.",
    hint: "Open the Smart Router step, press “+ Add a path”, name it (e.g. shipping), point it at a step, and ask a matching question.",
    xp: 70,
    check: (ctx) =>
      stepsOf(ctx).some((s) => {
        if (s.kind !== "router") return false;
        const routes = nodeOf(ctx, s.nodeId)?.routes ?? [];
        return (
          routes.length >= 3 && routes.slice(2).some((r) => s.decision?.includes(`"${r.label}"`))
        );
      }),
  },
  {
    id: "l-loop",
    title: "Loops: try again",
    goal: "Watch a critic send a draft back to the writer.",
    concept:
      "LangGraph allows cycles: a checker can loop work back until it passes (with a limit).",
    hint: "Load the starter (Writer & Critic Loop) and ask for something tricky, like “a limerick about tax law”.",
    xp: 70,
    starter: library("duo"),
    check: (ctx) =>
      stepsOf(ctx).some((s) => s.kind === "critic" && s.decision?.startsWith("Needs work")),
  },
  {
    id: "l-graph",
    title: "Draw your own edge",
    goal: "In the Graph tab, connect two steps so the recipe skips or jumps.",
    concept: "Edges decide what runs next. add_edge(a, b) in LangGraph is exactly this arrow.",
    hint: "Open Builder → Graph, drag from the dot under one step to another step further down.",
    xp: 60,
    // Only an edge the learner drew counts — library recipes already contain jumps.
    check: (ctx) => ctx.events.has("edge") && !isLinear(ctx.recipe),
  },
  {
    id: "l-compare",
    title: "Compare models",
    goal: "Run one question through two AIs (or two recipes) side by side.",
    concept: "Different models trade quality, speed and cost. Measure, don't guess.",
    hint: "Switch on Compare under the Inspect Box, pick B, and run.",
    xp: 50,
    check: (ctx) => ctx.events.has("compared"),
  },
  {
    id: "l-python",
    title: "See the real code",
    goal: "Export your recipe as LangGraph Python.",
    concept: "Everything you built maps to real LangGraph code you can run on your own computer.",
    hint: "Press Spin out → Python.",
    xp: 60,
    check: (ctx) => ctx.events.has("python"),
  },
  {
    id: "l-spinout",
    title: "Ship it",
    goal: "Spin your recipe out as its own tool.",
    concept:
      "A recipe can live outside Langplay: a tool page, a web widget, a Claude skill, an n8n flow or an MCP tool.",
    hint: "Press Spin out and pick any format.",
    xp: 80,
    check: (ctx) => ctx.events.has("spinout"),
  },
];
