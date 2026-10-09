import type { NodeKind, Recipe, RecipeNode, Route, SpinoutProvider, ToolId } from "./types";

// Dependency-free on purpose: this file ships inside exported tools, so it validates by hand
// instead of pulling in a schema library.

export const NODE_KINDS: NodeKind[] = [
  "input",
  "agent",
  "tool",
  "retriever",
  "router",
  "critic",
  "final",
];
export const TOOL_IDS: ToolId[] = ["wikipedia", "websearch", "calculator", "datetime", "sample"];
const SPINOUT_PROVIDERS: SpinoutProvider[] = ["pollinations", "ovh", "simulator", "visitor"];
const MAX_NODES = 40;
export const DEFAULT_MAX_LOOPS = 2;

let counter = 0;
export const newId = () => `n${Date.now().toString(36)}${(counter++).toString(36)}`;

/** The node that runs after `node` when nothing else decides: explicit `next`, else the following node. */
export function defaultNextId(recipe: Recipe, node: RecipeNode): string | null {
  if (node.kind === "final" && node.next === undefined) return null;
  if (node.next === "end") return null;
  if (node.next && recipe.nodes.some((n) => n.id === node.next)) return node.next;
  const index = recipe.nodes.findIndex((n) => n.id === node.id);
  return recipe.nodes[index + 1]?.id ?? null;
}

/** Every place a node can lead, with a label for routes and critic outcomes. */
export function outgoing(
  recipe: Recipe,
  node: RecipeNode,
): { label?: string; to: string | null }[] {
  const auto = defaultNextId(recipe, node);
  if (node.kind === "router" && node.routes?.length)
    return node.routes.map((r) => ({
      label: r.label,
      to: r.to && recipe.nodes.some((n) => n.id === r.to) ? r.to : auto,
    }));
  if (node.kind === "critic" && node.retryTo)
    return [
      { label: "good", to: auto },
      { label: "needs work", to: node.retryTo },
    ];
  return [{ to: auto }];
}

export function isLinear(recipe: Recipe): boolean {
  return recipe.nodes.every(
    (n) =>
      (n.next === undefined || (n.kind === "final" && n.next === "end")) &&
      !n.retryTo &&
      !(n.routes ?? []).some((r) => r.to),
  );
}

type RawRoute = { label?: unknown; to?: unknown };
type RawNode = {
  id?: unknown;
  kind?: unknown;
  label?: unknown;
  instruction?: unknown;
  next?: unknown;
  tool?: unknown;
  routes?: unknown;
  retryTo?: unknown;
  maxLoops?: unknown;
  x?: unknown;
  y?: unknown;
};
type RawRecipe = {
  id?: unknown;
  title?: unknown;
  summary?: unknown;
  source?: unknown;
  nodes?: unknown;
  steps?: unknown;
  spinout?: unknown;
};

const text = (value: unknown, max: number, fallback = "") =>
  typeof value === "string" ? value.slice(0, max) : fallback;
const safeId = (value: unknown) =>
  typeof value === "string" && /^[\w-]{1,40}$/.test(value) ? value : undefined;

/**
 * Turns untrusted JSON (a v1 `steps` recipe or a v2 `nodes` recipe) into a clean Recipe.
 * Unknown properties are dropped; broken references are removed rather than trusted.
 */
export function normalizeRecipe(input: unknown): Recipe {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("A recipe must be a JSON object.");
  const raw = input as RawRecipe;
  const list = Array.isArray(raw.nodes) ? raw.nodes : Array.isArray(raw.steps) ? raw.steps : null;
  if (!list || list.length < 1 || list.length > MAX_NODES)
    throw new Error(`Use 1–${MAX_NODES} steps, each with a known kind and plain-text instruction.`);
  const ids = new Set<string>();
  const nodes: RecipeNode[] = list.map((item, index) => {
    if (!item || typeof item !== "object")
      throw new Error(`Step ${index + 1} is not a valid step.`);
    const s = item as RawNode;
    const kind = s.kind as NodeKind;
    if (typeof s.kind !== "string" || !NODE_KINDS.includes(kind))
      throw new Error(`Step ${index + 1} has an unknown step type.`);
    if (typeof s.instruction !== "string")
      throw new Error(`Step ${index + 1} needs a plain-text instruction.`);
    let id = safeId(s.id) ?? `n${index + 1}`;
    while (ids.has(id)) id = `${id}x`;
    ids.add(id);
    const node: RecipeNode = {
      id,
      kind,
      label: text(s.label, 150) || defaultLabel(kind),
      instruction: text(s.instruction, 20000),
    };
    const next = s.next === "end" ? "end" : safeId(s.next);
    if (next) node.next = next;
    if (kind === "tool")
      node.tool = TOOL_IDS.includes(s.tool as ToolId) ? (s.tool as ToolId) : "sample";
    if (kind === "router" && Array.isArray(s.routes))
      node.routes = s.routes
        .filter((r): r is RawRoute => !!r && typeof r === "object")
        .map((r) => {
          const route: Route = { label: text(r.label, 40).trim() };
          const to = safeId(r.to);
          if (to) route.to = to;
          return route;
        })
        .filter((r) => r.label)
        .slice(0, 6);
    if (kind === "critic") {
      const retry = safeId(s.retryTo);
      if (retry) node.retryTo = retry;
      if (typeof s.maxLoops === "number")
        node.maxLoops = Math.min(5, Math.max(1, Math.round(s.maxLoops)));
    }
    if (typeof s.x === "number" && Number.isFinite(s.x)) node.x = s.x;
    if (typeof s.y === "number" && Number.isFinite(s.y)) node.y = s.y;
    return node;
  });
  // Drop references to nodes that do not exist.
  for (const n of nodes) {
    if (n.next && n.next !== "end" && !ids.has(n.next)) delete n.next;
    if (n.retryTo && !ids.has(n.retryTo)) delete n.retryTo;
    n.routes?.forEach((r: Route) => {
      if (r.to && !ids.has(r.to)) delete r.to;
    });
    if (n.kind === "router" && !n.routes?.length) n.routes = defaultRoutes();
  }
  const recipe: Recipe = {
    version: 2,
    title: text(raw.title, 200).trim() || "Imported recipe",
    summary: text(raw.summary, 2000) || "Imported text recipe",
    nodes,
  };
  const id = safeId(raw.id);
  if (id) recipe.id = id;
  if (typeof raw.source === "string" && /^https:\/\//.test(raw.source))
    recipe.source = raw.source.slice(0, 500);
  const spin = raw.spinout as { provider?: unknown; model?: unknown } | undefined;
  if (spin && SPINOUT_PROVIDERS.includes(spin.provider as SpinoutProvider))
    recipe.spinout = {
      provider: spin.provider as SpinoutProvider,
      ...(typeof spin.model === "string" ? { model: spin.model.slice(0, 120) } : {}),
    };
  return recipe;
}

export const defaultRoutes = (): Route[] => [{ label: "billing" }, { label: "tech" }];

const LABELS: Record<NodeKind, string> = {
  input: "Input Prompt",
  agent: "AI Thinking (Agent)",
  tool: "Tool / Search",
  retriever: "Document Lookup",
  router: "Smart Router",
  critic: "Critic / Checker",
  final: "Final Answer",
};
export const defaultLabel = (kind: NodeKind) => LABELS[kind];

export function makeNode(kind: NodeKind, instruction = "", label?: string): RecipeNode {
  const node: RecipeNode = { id: newId(), kind, label: label ?? defaultLabel(kind), instruction };
  if (kind === "tool") node.tool = "wikipedia";
  if (kind === "router") node.routes = defaultRoutes();
  return node;
}

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "langplay-recipe";
