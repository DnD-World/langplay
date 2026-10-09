import { describe, expect, it } from "vitest";
import { graphEdges, layoutRecipe } from "@/engine";
import { RECIPES } from "@/lib/lp-recipes";

const byId = (id: string) => RECIPES.find((r) => r.id === id)!;

describe("graph view", () => {
  it("draws router paths as labelled edges from their own handles", () => {
    const edges = graphEdges(byId("router"));
    expect(
      edges.filter((e) => e.source === "route").map((e) => [e.handle, e.label, e.target]),
    ).toEqual([
      ["route:0", "billing", "billing"],
      ["route:1", "tech", "tech"],
    ]);
    expect(edges.find((e) => e.source === "billing")?.target).toBe("final");
  });
  it("marks a critic's way back as a loop", () => {
    const loop = graphEdges(byId("duo")).find((e) => e.loop);
    expect(loop).toMatchObject({ source: "critic", target: "writer", handle: "retry" });
  });
  it("lays out branches side by side and keeps saved positions", () => {
    const pos = layoutRecipe(byId("router"));
    expect(pos.billing!.y).toBe(pos.tech!.y);
    expect(pos.billing!.x).toBeLessThan(pos.tech!.x);
    expect(pos.final!.y).toBeGreaterThan(pos.billing!.y);
    const moved = {
      ...byId("router"),
      nodes: byId("router").nodes.map((n) => (n.id === "in" ? { ...n, x: 5, y: 7 } : n)),
    };
    expect(layoutRecipe(moved).in).toEqual({ x: 5, y: 7 });
  });
});
