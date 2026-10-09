import { describe, expect, it } from "vitest";
import vm from "node:vm";
import { ENGINE_JS, RUNNER_JS } from "virtual:langplay-runtime";
import { RECIPES } from "@/lib/lp-recipes";

describe("bundled runtime for exported tools", () => {
  it("is a small self-contained script", () => {
    expect(ENGINE_JS.length).toBeGreaterThan(5000);
    expect(ENGINE_JS.length).toBeLessThan(80_000);
    expect(RUNNER_JS.length).toBeLessThan(120_000);
    expect(ENGINE_JS).not.toMatch(/\bimport\s*\(|\brequire\(/);
  });
  it("runs a recipe in a bare JavaScript context", async () => {
    const context = vm.createContext({
      setTimeout,
      clearTimeout,
      AbortSignal,
      fetch,
      TextEncoder,
      TextDecoder,
      console,
    });
    vm.runInContext(`${ENGINE_JS}\nthis.Langplay = Langplay;`, context);
    const lp = (
      context as unknown as {
        Langplay: { runRecipe: (...a: unknown[]) => Promise<unknown>; simulatorChat: unknown };
      }
    ).Langplay;
    const recipe = RECIPES.find((r) => r.id === "router")!;
    const result = (await lp.runRecipe(recipe, "refund for a double charge", {
      chat: lp.simulatorChat,
      simulated: true,
    })) as { steps: { nodeId: string }[] };
    expect(result.steps.map((s) => s.nodeId)).toEqual(["in", "route", "billing", "final"]);
  });
});
