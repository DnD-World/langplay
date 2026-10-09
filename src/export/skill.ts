import { slugify } from "../engine/recipe";
import type { Recipe } from "../engine/types";
import { describeSteps, systemPrompt } from "./describe";
import { zip } from "./zip";

// A recipe as an Agent Skill (SKILL.md), for Claude and other skill-aware assistants.

export function skillName(recipe: Recipe): string {
  return slugify(recipe.title).slice(0, 64) || "langplay-recipe";
}

export function skillMarkdown(recipe: Recipe): string {
  const name = skillName(recipe);
  const usesTools = recipe.nodes.some((n) => n.kind === "tool" || n.kind === "retriever");
  const description =
    `${recipe.summary.replace(/\s+/g, " ").trim()} Use when the user asks for "${recipe.title}" or a task like it.`
      .replace(/"/g, "'")
      .slice(0, 1000);
  return [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    "---",
    "",
    `# ${recipe.title}`,
    "",
    recipe.summary,
    "",
    "## Steps",
    "",
    "Follow these steps for every request, in order. Jump only where a step says so.",
    "",
    ...describeSteps(recipe),
    "",
    "## Rules",
    "",
    "- Keep the final answer short and beginner-friendly.",
    usesTools
      ? "- When a step needs a tool you do not have, say what you would look up instead of inventing results."
      : "- Do not invent facts; say when you are unsure.",
    "- Show your working only if the user asks.",
    "",
    `_Made with Langplay${recipe.source ? ` · based on ${recipe.source}` : ""}._`,
    "",
  ].join("\n");
}

export function skillZip(recipe: Recipe): Uint8Array {
  return zip([{ name: `${skillName(recipe)}/SKILL.md`, text: skillMarkdown(recipe) }]);
}

export { systemPrompt };
