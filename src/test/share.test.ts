import { describe, expect, it } from "vitest";
import { decodeRecipe, encodeRecipe, recipeCodeFromHash } from "@/engine";
import { RECIPES } from "@/lib/lp-recipes";

describe("share links", () => {
  it("round-trips every library recipe through a compact link code", async () => {
    for (const recipe of RECIPES) {
      const code = await encodeRecipe(recipe);
      expect(code).toMatch(/^[\w-]+$/);
      const back = await decodeRecipe(code);
      expect(back.nodes).toEqual(recipe.nodes);
      expect(back.title).toBe(recipe.title);
    }
  });
  it("finds the code in a hash and rejects damaged codes", async () => {
    expect(recipeCodeFromHash("#r=abc_-1")).toBe("abc_-1");
    expect(recipeCodeFromHash("#x=1&r=zz")).toBe("zz");
    expect(recipeCodeFromHash("#nothing")).toBeNull();
    await expect(decodeRecipe("not valid!")).rejects.toThrow("damaged");
    await expect(decodeRecipe("AAAA")).rejects.toThrow();
  });
});
