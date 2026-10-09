import * as Dialog from "@radix-ui/react-dialog";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import type { NodePatch, Recipe } from "@/engine";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "../AnimatedIcon";
import { Info } from "../Info";

const GraphCanvas = lazy(() => import("./GraphCanvas"));

export function GraphView({
  recipe,
  activeId,
  runningId,
  onSelect,
  updateNode,
  setRecipe,
  editor,
  onConnected,
}: {
  recipe: Recipe;
  activeId: string | null;
  runningId: string | null;
  onSelect: (id: string) => void;
  updateNode: (id: string, patch: NodePatch) => void;
  setRecipe: (fn: (r: Recipe) => Recipe) => void;
  /** Step editor for the selected node, shown beside the big canvas. */
  editor: ReactNode;
  onConnected?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [big, setBig] = useState(false);
  useEffect(() => setMounted(true), []);
  const tidy = () =>
    setRecipe((r) => ({
      ...r,
      nodes: r.nodes.map(({ x: _x, y: _y, ...n }) => n),
    }));
  const canvas = (height: number | string) =>
    mounted ? (
      <Suspense
        fallback={<div className="grid h-40 place-items-center text-xs">Loading graph…</div>}
      >
        <GraphCanvas
          recipe={recipe}
          activeId={activeId}
          runningId={runningId}
          onSelect={onSelect}
          updateNode={updateNode}
          height={height}
          {...(onConnected ? { onConnected } : {})}
        />
      </Suspense>
    ) : null;
  const toolbar = (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={tidy}>
        Tidy up
      </Button>
      {!big && (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setBig(true)}>
          <AnimatedIcon name="inspect" /> Full screen
        </Button>
      )}
      <Info tip="Drag from a dot at the bottom of a step to another step to connect them. Routers have one dot per path; a critic's side dot makes a loop. Select an arrow and press Delete to remove it." />
    </div>
  );

  return (
    <div>
      {toolbar}
      {!big && canvas(420)}
      <Dialog.Root open={big} onOpenChange={setBig}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-2 z-50 flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-2xl sm:inset-6 lg:flex-row"
          >
            <Dialog.Title className="sr-only">Recipe graph</Dialog.Title>
            <div className="min-h-0 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-bold">
                  <AnimatedIcon name="router" /> {recipe.title}
                </h2>
                <Dialog.Close asChild>
                  <Button variant="outline" size="icon" aria-label="Close graph">
                    <AnimatedIcon name="close" />
                  </Button>
                </Dialog.Close>
              </div>
              {toolbar}
              {canvas("calc(100% - 5.5rem)")}
            </div>
            <aside className="max-h-[40vh] overflow-y-auto border-t pt-3 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
              {editor ?? (
                <p className="text-sm text-muted-foreground">Click a step to edit it here.</p>
              )}
            </aside>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
