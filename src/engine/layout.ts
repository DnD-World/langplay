import { outgoing } from "./recipe";
import type { Recipe } from "./types";

// Graph helpers shared by the canvas and the exporters: edges in one list, and a simple
// layered layout (rows by distance from the first step) for recipes without saved positions.

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** "next", a route index ("route:0"), "good" or "retry". */
  handle: string;
  label?: string;
  loop: boolean;
}

export function graphEdges(recipe: Recipe): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (const node of recipe.nodes) {
    outgoing(recipe, node).forEach((out, i) => {
      if (!out.to) return;
      const handle =
        node.kind === "router" && node.routes?.length
          ? `route:${i}`
          : node.kind === "critic" && node.retryTo
            ? i === 0
              ? "good"
              : "retry"
            : "next";
      const edge: GraphEdge = {
        id: `${node.id}-${handle}-${out.to}`,
        source: node.id,
        target: out.to,
        handle,
        loop: handle === "retry",
      };
      if (out.label) edge.label = out.label;
      edges.push(edge);
    });
  }
  return edges;
}

export const ROW = 130;
export const COLUMN = 230;

/** Positions every node: saved x/y wins, otherwise rows by distance from the first node. */
export function layoutRecipe(recipe: Recipe): Record<string, { x: number; y: number }> {
  const depth = new Map<string, number>();
  const first = recipe.nodes[0];
  if (first) {
    const queue = [first.id];
    depth.set(first.id, 0);
    const edges = graphEdges(recipe).filter((e) => !e.loop);
    while (queue.length) {
      const id = queue.shift() as string;
      const d = depth.get(id) ?? 0;
      for (const e of edges)
        if (e.source === id && !depth.has(e.target)) {
          depth.set(e.target, d + 1);
          queue.push(e.target);
        }
    }
  }
  // Unreachable nodes go below everything else.
  let maxDepth = Math.max(0, ...depth.values());
  for (const n of recipe.nodes) if (!depth.has(n.id)) depth.set(n.id, ++maxDepth);
  const rows = new Map<number, string[]>();
  for (const n of recipe.nodes) {
    const d = depth.get(n.id) ?? 0;
    rows.set(d, [...(rows.get(d) ?? []), n.id]);
  }
  const positions: Record<string, { x: number; y: number }> = {};
  for (const [d, ids] of rows)
    ids.forEach((id, i) => {
      positions[id] = { x: (i - (ids.length - 1) / 2) * COLUMN, y: d * ROW };
    });
  for (const n of recipe.nodes)
    if (typeof n.x === "number" && typeof n.y === "number") positions[n.id] = { x: n.x, y: n.y };
  return positions;
}
