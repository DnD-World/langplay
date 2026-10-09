import { DEFAULT_MAX_LOOPS, defaultNextId } from "../engine/recipe";
import { TOOL_INFO } from "../engine/tools";
import type { Recipe, RecipeNode } from "../engine/types";

// Plain-language version of a recipe, used for Claude skills and system prompts.

const stepNo = (recipe: Recipe, id: string | null | undefined) => {
  if (!id) return "the end";
  const i = recipe.nodes.findIndex((n) => n.id === id);
  return i >= 0 ? `step ${i + 1}` : "the end";
};

function describeNode(recipe: Recipe, node: RecipeNode): string {
  const text = node.instruction.trim().replaceAll("{question}", "<the user's request>");
  switch (node.kind) {
    case "input":
      return text
        ? `Restate the request using this template: "${text}".`
        : "Read the user's request.";
    case "agent":
      return `Think it through and write a draft. ${text}`;
    case "final":
      return `Write the final answer for the user. ${text}`;
    case "tool": {
      const tool = TOOL_INFO[node.tool ?? "sample"];
      const how = {
        wikipedia:
          "Search Wikipedia (or any web search you have) and note the key facts with their links.",
        websearch: "Do a quick web search and note the key facts with their links.",
        calculator:
          "Work out the numbers exactly with a calculator or code; never guess arithmetic.",
        datetime: "Check today's date and time; do not rely on memory for it.",
        sample: "Gather supporting facts (this step used practice data in Langplay).",
      }[node.tool ?? "sample"];
      return `Use a tool — ${tool.name}. ${how} ${text}`.trim();
    }
    case "retriever":
      return `Search the user's documents for the most relevant passages and cite file and page. ${text}`;
    case "router": {
      const auto = defaultNextId(recipe, node);
      const routes = (node.routes ?? [])
        .map((r) => `"${r.label}" → continue at ${stepNo(recipe, r.to ?? auto)}`)
        .join("; ");
      return `Decide which path fits: ${text} Choose exactly one: ${routes}.`;
    }
    case "critic":
      return node.retryTo
        ? `Review the draft: ${text} If it needs work, go back to ${stepNo(recipe, node.retryTo)} with specific fixes (at most ${node.maxLoops ?? DEFAULT_MAX_LOOPS} times); if it is good, continue.`
        : `Review the draft and rewrite the weak parts. ${text}`;
  }
}

export function describeSteps(recipe: Recipe): string[] {
  return recipe.nodes.map((node, i) => {
    let line = `${i + 1}. **${node.label}** — ${describeNode(recipe, node)}`.trim();
    const next = defaultNextId(recipe, node);
    const following = recipe.nodes[i + 1]?.id ?? null;
    if (node.kind !== "router" && node.kind !== "final" && next !== following)
      line += ` Then continue at ${stepNo(recipe, next)}.`;
    if (node.kind === "final") line += " Stop here.";
    return line;
  });
}

export function systemPrompt(recipe: Recipe): string {
  return [
    `You run the "${recipe.title}" recipe. ${recipe.summary}`,
    "",
    "For every request, follow these steps in order (jump only where a step says so):",
    ...describeSteps(recipe),
    "",
    "Keep answers short and beginner-friendly. Show only the final answer unless asked for the working.",
  ].join("\n");
}
