import { makeNode, type Recipe, type RecipeNode } from "@/engine";
import type { Category } from "./lp-data";

export type LibraryRecipe = Recipe & {
  id: string;
  difficulty: "Easy" | "Medium" | "Hard";
  categories: Category[];
  tools: string[];
  cost: "Cheap" | "Medium";
};

export const RECIPES: LibraryRecipe[] = [
  {
    version: 2,
    id: "fact",
    title: "Web Fact Checker",
    summary: "Checks a claim against Wikipedia and explains the verdict with sources.",
    difficulty: "Easy",
    categories: ["Beginner Friendly", "Tool User"],
    tools: ["Wikipedia"],
    cost: "Cheap",
    nodes: [
      {
        id: "in",
        kind: "input",
        label: "Input Prompt",
        instruction: "Is this claim true? {question}",
      },
      {
        id: "search",
        kind: "tool",
        label: "Wikipedia search",
        instruction: "Find evidence about the claim.",
        tool: "wikipedia",
      },
      {
        id: "final",
        kind: "final",
        label: "Verdict",
        instruction:
          "Say TRUE, FALSE or UNSURE, explain why simply, and name the sources you used.",
      },
    ],
  },
  {
    version: 2,
    id: "pdf",
    title: "Document ELI5 Explainer",
    summary: "Finds the right passages in your own file and explains them like you're five.",
    difficulty: "Medium",
    categories: ["Document Q&A", "Beginner Friendly"],
    tools: ["Document Lookup"],
    cost: "Cheap",
    nodes: [
      {
        id: "in",
        kind: "input",
        label: "Input Prompt",
        instruction: "Explain from my document: {question}",
      },
      {
        id: "docs",
        kind: "retriever",
        label: "Document Lookup",
        instruction: "Fetch the 3 most relevant passages.",
      },
      {
        id: "think",
        kind: "agent",
        label: "Explainer",
        instruction: "Explain the passages like I'm five. Mention the page numbers.",
      },
      {
        id: "final",
        kind: "final",
        label: "Final Answer",
        instruction: "Summarize in 3 bullet points.",
      },
    ],
  },
  {
    version: 2,
    id: "duo",
    title: "Writer & Critic Loop",
    summary: "One AI writes, a critic sends it back until it is good — a real LangGraph cycle.",
    difficulty: "Medium",
    categories: ["Multi-Agent"],
    tools: ["None"],
    cost: "Medium",
    nodes: [
      { id: "in", kind: "input", label: "Input Prompt", instruction: "Write about: {question}" },
      {
        id: "writer",
        kind: "agent",
        label: "Writer",
        instruction: "Write a short first draft. If there is reviewer feedback, fix exactly that.",
      },
      {
        id: "critic",
        kind: "critic",
        label: "Critic",
        instruction: "Check the draft is accurate, clear and has a concrete example.",
        retryTo: "writer",
        maxLoops: 2,
      },
      {
        id: "final",
        kind: "final",
        label: "Final Answer",
        instruction: "Return the polished version.",
      },
    ],
  },
  {
    version: 2,
    id: "router",
    title: "Smart Support Router",
    summary: "The AI sorts customer questions into billing or tech, then a specialist answers.",
    difficulty: "Medium",
    categories: ["Multi-Agent", "Tool User"],
    tools: ["Router"],
    cost: "Cheap",
    nodes: [
      { id: "in", kind: "input", label: "Input Prompt", instruction: "Customer says: {question}" },
      {
        id: "route",
        kind: "router",
        label: "Smart Router",
        instruction: "Is this about money (billing) or about the product not working (tech)?",
        routes: [
          { label: "billing", to: "billing" },
          { label: "tech", to: "tech" },
        ],
      },
      {
        id: "billing",
        kind: "agent",
        label: "Billing specialist",
        instruction:
          "Answer as a friendly billing specialist. Explain refunds and charges clearly.",
        next: "final",
      },
      {
        id: "tech",
        kind: "agent",
        label: "Tech specialist",
        instruction: "Answer as a patient tech specialist. Give numbered troubleshooting steps.",
      },
      {
        id: "final",
        kind: "final",
        label: "Final Answer",
        instruction: "Reply politely in under 80 words.",
      },
    ],
  },
  {
    version: 2,
    id: "math",
    title: "Maths Homework Helper",
    summary: "Uses a real calculator for the numbers, then explains each step.",
    difficulty: "Easy",
    categories: ["Beginner Friendly", "Tool User"],
    tools: ["Calculator"],
    cost: "Cheap",
    nodes: [
      {
        id: "in",
        kind: "input",
        label: "Input Prompt",
        instruction: "Help me with this maths question: {question}",
      },
      {
        id: "calc",
        kind: "tool",
        label: "Calculator",
        instruction: "Turn the question into one calculation.",
        tool: "calculator",
      },
      {
        id: "final",
        kind: "final",
        label: "Final Answer",
        instruction: "Give the answer from the calculator and explain each step for a beginner.",
      },
    ],
  },
  {
    version: 2,
    id: "code",
    title: "Code Fixer & Explainer",
    summary: "Fixes a broken bit of code, double-checks the fix in a loop, then explains it.",
    difficulty: "Hard",
    categories: ["Multi-Agent"],
    tools: ["Critic loop"],
    cost: "Medium",
    nodes: [
      { id: "in", kind: "input", label: "Input Prompt", instruction: "Fix this code: {question}" },
      {
        id: "fixer",
        kind: "agent",
        label: "Fixer",
        instruction:
          "Find the bug and propose a fixed version. If there is reviewer feedback, address it.",
      },
      {
        id: "check",
        kind: "critic",
        label: "Reviewer",
        instruction: "Check the fix really solves the bug and does not add new ones.",
        retryTo: "fixer",
        maxLoops: 2,
      },
      {
        id: "final",
        kind: "final",
        label: "Final Answer",
        instruction: "Show the fixed code and explain the fix for a beginner.",
      },
    ],
  },
  {
    version: 2,
    id: "brief",
    title: "Topic Briefing",
    summary:
      "Gathers background on a topic from the web and Wikipedia and turns it into a 1-minute briefing.",
    difficulty: "Easy",
    categories: ["Beginner Friendly", "Tool User"],
    tools: ["Web answer", "Wikipedia"],
    cost: "Cheap",
    nodes: [
      {
        id: "in",
        kind: "input",
        label: "Input Prompt",
        instruction: "Topic for my briefing: {question}",
      },
      {
        id: "web",
        kind: "tool",
        label: "Quick web answer",
        instruction: "Find a short overview of the topic.",
        tool: "websearch",
      },
      {
        id: "wiki",
        kind: "tool",
        label: "Wikipedia search",
        instruction: "Find background articles on the topic.",
        tool: "wikipedia",
      },
      {
        id: "sum",
        kind: "agent",
        label: "Summarizer",
        instruction: "Summarize what the notes say in plain words.",
      },
      {
        id: "final",
        kind: "final",
        label: "Final Answer",
        instruction: "Deliver the briefing in 5 bullets and name the sources.",
      },
    ],
  },
  {
    version: 2,
    id: "today",
    title: "What Day Is It?",
    summary: "Shows why AI needs tools: models do not know today's date, a clock tool does.",
    difficulty: "Easy",
    categories: ["Beginner Friendly", "Tool User"],
    tools: ["Clock"],
    cost: "Cheap",
    nodes: [
      { id: "in", kind: "input", label: "Input Prompt", instruction: "{question}" },
      {
        id: "clock",
        kind: "tool",
        label: "Clock",
        instruction: "Check today's date.",
        tool: "datetime",
      },
      {
        id: "final",
        kind: "final",
        label: "Final Answer",
        instruction: "Answer using the date from the clock tool.",
      },
    ],
  },
];

export function defaultRecipe(): Recipe {
  return {
    version: 2,
    title: "My first recipe",
    summary: "Look facts up, think, answer.",
    nodes: [
      makeNode("input", "Answer like I'm 10 years old: {question}"),
      { ...makeNode("tool", "Look up the key facts."), label: "Wikipedia search" },
      makeNode("agent", "Think step by step and draft a friendly answer using the notes."),
      makeNode("final", "Give a short, clear final answer."),
    ],
  };
}

/** Library recipes get fresh ids when installed so two copies never clash. */
export function cloneRecipe<T extends Recipe>(recipe: T): Recipe {
  const map = new Map<string, string>();
  const nodes: RecipeNode[] = recipe.nodes.map((n) => {
    const id = makeNode(n.kind).id;
    map.set(n.id, id);
    const copy: RecipeNode = { ...n, id };
    if (n.routes) copy.routes = n.routes.map((r) => ({ ...r }));
    return copy;
  });
  for (const n of nodes) {
    if (n.next && n.next !== "end") n.next = map.get(n.next) ?? n.next;
    if (n.retryTo) n.retryTo = map.get(n.retryTo) ?? n.retryTo;
    n.routes?.forEach((r) => {
      if (r.to) r.to = map.get(r.to) ?? r.to;
    });
  }
  const { version, title, summary, source, spinout } = recipe;
  return {
    version,
    title,
    summary,
    ...(source ? { source } : {}),
    ...(spinout ? { spinout } : {}),
    nodes,
  };
}
