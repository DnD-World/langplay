import type { DocChunk } from "../engine/docs";
import type { Recipe } from "../engine/types";

// One self-contained HTML file: the runner UI, the engine and the recipe. Open it from disk,
// email it, or upload it to any web host — no Langplay server involved.

/** JSON that is safe to place inside a <script> element. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

export function toolHtml({
  recipe,
  runnerJs,
  docs,
  remixUrl,
}: {
  recipe: Recipe;
  runnerJs: string;
  docs?: DocChunk[];
  remixUrl?: string;
}): string {
  const { id: _id, ...clean } = recipe;
  const options = {
    recipe: clean,
    ...(docs?.length ? { docs } : {}),
    ...(remixUrl ? { remixUrl } : {}),
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(recipe.title)}</title>
<meta name="description" content="${escapeHtml(recipe.summary)}">
<meta name="generator" content="Langplay">
<style>html,body{margin:0;background:oklch(0.18 0.035 275)}</style>
</head>
<body>
<div id="app"></div>
<script>${runnerJs.replace(/<\/script/gi, "<\\/script")}</script>
<script>Langplay.mountRunner(document.getElementById("app"), ${scriptJson(options)});</script>
</body>
</html>
`;
}

export function embedSnippet(url: string, title: string): string {
  return `<iframe src="${escapeHtml(url)}" title="${escapeHtml(title)}" loading="lazy" style="width:100%;max-width:760px;height:620px;border:0;border-radius:16px;overflow:hidden" allow="clipboard-write"></iframe>`;
}
