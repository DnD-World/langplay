import { useState } from "react";
import type { Recipe } from "@/engine";
import { defaultRecipe } from "@/lib/lp-recipes";
import {
  deleteSaved,
  exportRecipeJson,
  listSaved,
  saveRecipe,
  shareLink,
  type SavedRecipe,
} from "@/lib/lp-saved";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "../AnimatedIcon";
import { Overlay } from "../Overlay";

export function RecipeMenu({
  recipe,
  setRecipe,
  notify,
  onShared,
}: {
  recipe: Recipe;
  setRecipe: (r: Recipe) => void;
  notify: (text: string) => void;
  onShared: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedRecipe[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const save = () => {
    try {
      const entry = saveRecipe(recipe);
      setRecipe({ ...recipe, id: entry.id });
      notify(`Saved "${entry.title}" to My recipes`);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not save");
    }
  };
  const share = async () => {
    try {
      const link = await shareLink(recipe);
      await navigator.clipboard.writeText(link);
      notify("Share link copied — anyone with it can open and remix this recipe");
      onShared();
    } catch {
      notify("Could not copy the link. Your browser may block the clipboard.");
    }
  };

  return (
    <>
      <div className="mb-3 grid grid-cols-4 gap-1">
        {[
          { label: "Save", icon: "check" as const, run: save },
          {
            label: "Mine",
            icon: "blocks" as const,
            run: () => {
              setSaved(listSaved());
              setOpen(true);
            },
          },
          { label: "Share", icon: "spark" as const, run: () => void share() },
          { label: "Export", icon: "code" as const, run: () => exportRecipeJson(recipe) },
        ].map((b) => (
          <Button
            key={b.label}
            variant="outline"
            size="sm"
            onClick={b.run}
            className="h-8 gap-1 px-1 text-[11px]"
            title={
              {
                Save: "Save this recipe in My recipes",
                Mine: "Open My recipes",
                Share: "Copy a link that opens this recipe",
                Export: "Download as a .json file",
              }[b.label]
            }
          >
            <AnimatedIcon name={b.icon} /> {b.label}
          </Button>
        ))}
      </div>
      <Overlay open={open} onClose={() => setOpen(false)} title="My recipes">
        <h2 className="text-xl font-bold">
          <AnimatedIcon name="blocks" /> My recipes
        </h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Saved in this browser. Use Share for a link, or Export for a file you can keep anywhere.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setRecipe(defaultRecipe());
              setOpen(false);
            }}
          >
            Start a new recipe
          </Button>
        </div>
        {!saved.length && (
          <p className="text-sm text-muted-foreground">
            Nothing saved yet. Press Save in the builder.
          </p>
        )}
        <ul className="space-y-2">
          {saved.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{s.title}</div>
                <div className="text-xs text-muted-foreground">
                  {s.recipe.nodes.length} steps · {new Date(s.updatedAt).toLocaleString()}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setRecipe(s.recipe);
                  setOpen(false);
                }}
              >
                Open
              </Button>
              {confirmDelete === s.id ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    deleteSaved(s.id);
                    setSaved(listSaved());
                    setConfirmDelete(null);
                  }}
                >
                  Really delete
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(s.id)}>
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Overlay>
    </>
  );
}
