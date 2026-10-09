import { encodeRecipe, normalizeRecipe, slugify, type Recipe } from "@/engine";

// "My recipes": named copies kept in this browser.

export interface SavedRecipe {
  id: string;
  title: string;
  updatedAt: string;
  recipe: Recipe;
}

const KEY = "lp-recipes";
export const MAX_SAVED = 50;

export function listSaved(): SavedRecipe[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item): SavedRecipe[] => {
      try {
        const s = item as Partial<SavedRecipe>;
        if (typeof s.id !== "string" || typeof s.updatedAt !== "string") return [];
        const recipe = normalizeRecipe(s.recipe);
        return [{ id: s.id, title: recipe.title, updatedAt: s.updatedAt, recipe }];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

function write(list: SavedRecipe[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    throw new Error("This browser would not save the recipe (storage full or blocked).");
  }
}

/** Saves (or overwrites when the recipe already has a saved id) and returns the saved id. */
export function saveRecipe(recipe: Recipe): SavedRecipe {
  const list = listSaved();
  const id =
    recipe.id && list.some((s) => s.id === recipe.id) ? recipe.id : `r${Date.now().toString(36)}`;
  const entry: SavedRecipe = {
    id,
    title: recipe.title || "Untitled recipe",
    updatedAt: new Date().toISOString(),
    recipe: { ...recipe, id },
  };
  const next = [entry, ...list.filter((s) => s.id !== id)];
  if (next.length > MAX_SAVED)
    throw new Error(`You can keep up to ${MAX_SAVED} recipes. Delete one first.`);
  write(next);
  return entry;
}

export function deleteSaved(id: string) {
  write(listSaved().filter((s) => s.id !== id));
}

export function downloadText(filename: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportRecipeJson(recipe: Recipe) {
  const { id: _id, ...clean } = recipe;
  downloadText(`${slugify(recipe.title)}.langplay.json`, JSON.stringify(clean, null, 2));
}

/** A link to the playground (or another page such as /tool) that carries the recipe after "#r=". */
export async function shareLink(recipe: Recipe, path = "/", extraQuery = ""): Promise<string> {
  const { id: _id, ...clean } = recipe;
  return `${location.origin}${path}${extraQuery}#r=${await encodeRecipe(clean as Recipe)}`;
}
