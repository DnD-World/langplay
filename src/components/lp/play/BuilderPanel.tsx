import { useState, type ReactNode } from "react";
import {
  DEFAULT_MAX_LOOPS,
  TOOL_IDS,
  TOOL_INFO,
  defaultNextId,
  type NodeKind,
  type Recipe,
  type NodePatch,
  type RecipeNode,
  type ToolId,
} from "@/engine";
import { KINDS } from "@/lib/lp-data";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "../AnimatedIcon";
import { HoldDelete } from "../EffectControls";
import { Info, Label, inputCls } from "../Info";
import { StarFrame } from "../Motion";

type Props = {
  recipe: Recipe;
  activeId: string | null;
  runningId: string | null;
  busy: boolean;
  setActiveId: (id: string | null) => void;
  updateNode: (id: string, patch: NodePatch) => void;
  addNode: (kind: NodeKind) => RecipeNode;
  removeNode: (id: string) => void;
  moveNode: (id: string, toIndex: number) => void;
  onTitle: (title: string) => void;
  onMilestone: (id: string) => void;
  graphView?: ReactNode;
};

const selectCls = `${inputCls} py-1.5 text-xs`;

function stepName(recipe: Recipe, id: string | undefined | null) {
  if (!id) return "End";
  const index = recipe.nodes.findIndex((n) => n.id === id);
  const node = recipe.nodes[index];
  return node ? `${index + 1}. ${node.label}` : "End";
}

/** Small "goes to" picker used by next / route / retry choices. */
function Target({
  recipe,
  self,
  value,
  onChange,
  autoLabel,
  allowEnd = true,
  ariaLabel,
}: {
  recipe: Recipe;
  self: RecipeNode;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  autoLabel?: string;
  allowEnd?: boolean;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className={selectCls}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      {autoLabel && <option value="">{autoLabel}</option>}
      {recipe.nodes.map((n, i) =>
        n.id === self.id ? null : (
          <option key={n.id} value={n.id}>
            {i + 1}. {n.label}
          </option>
        ),
      )}
      {allowEnd && <option value="end">End the run</option>}
    </select>
  );
}

function StepEditor({
  recipe,
  node,
  updateNode,
}: {
  recipe: Recipe;
  node: RecipeNode;
  updateNode: Props["updateNode"];
}) {
  const following = recipe.nodes[recipe.nodes.findIndex((n) => n.id === node.id) + 1];
  const autoLabel = `Next in list${following ? ` (${following.label})` : " (end)"}`;
  return (
    <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      <div>
        <Label tip="A nickname for this block so you remember what it does.">Name</Label>
        <input
          className={inputCls}
          value={node.label}
          maxLength={150}
          onChange={(e) => updateNode(node.id, { label: e.target.value })}
        />
      </div>
      <div>
        <Label tip="Tell this block what to do in plain words. {question} is replaced by what you type in the chat.">
          Instructions
        </Label>
        <textarea
          className={`${inputCls} h-20`}
          value={node.instruction}
          onChange={(e) => updateNode(node.id, { instruction: e.target.value })}
        />
      </div>

      {node.kind === "tool" && (
        <div>
          <Label tip="Which real tool this step uses. Practice results are made up, for learning offline.">
            Tool
          </Label>
          <select
            aria-label="Tool"
            className={selectCls}
            value={node.tool ?? "sample"}
            onChange={(e) => updateNode(node.id, { tool: e.target.value as ToolId })}
          >
            {TOOL_IDS.map((t) => (
              <option key={t} value={t}>
                {TOOL_INFO[t].name}
              </option>
            ))}
          </select>
        </div>
      )}

      {node.kind === "router" && (
        <div className="space-y-2">
          <Label tip="The AI reads the request and picks ONE of these paths. In LangGraph this is add_conditional_edges.">
            Paths the AI can choose
          </Label>
          {(node.routes ?? []).map((route, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_1.4fr_auto] items-center gap-1.5">
              <input
                aria-label={`Path ${i + 1} name`}
                className={`${inputCls} py-1.5 text-xs`}
                value={route.label}
                maxLength={40}
                onChange={(e) =>
                  updateNode(node.id, {
                    routes: (node.routes ?? []).map((r, j) =>
                      j === i ? { ...r, label: e.target.value } : r,
                    ),
                  })
                }
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Target
                ariaLabel={`Path ${i + 1} goes to`}
                recipe={recipe}
                self={node}
                value={route.to}
                autoLabel={autoLabel}
                onChange={(to) =>
                  updateNode(node.id, {
                    routes: (node.routes ?? []).map((r, j) =>
                      j === i ? (to ? { label: r.label, to } : { label: r.label }) : r,
                    ),
                  })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove path ${route.label}`}
                disabled={(node.routes ?? []).length <= 2}
                className="h-7 w-7"
                onClick={() =>
                  updateNode(node.id, { routes: (node.routes ?? []).filter((_, j) => j !== i) })
                }
              >
                <AnimatedIcon name="close" />
              </Button>
            </div>
          ))}
          {(node.routes ?? []).length < 6 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateNode(node.id, {
                  routes: [
                    ...(node.routes ?? []),
                    { label: `path${(node.routes ?? []).length + 1}` },
                  ],
                })
              }
            >
              + Add a path
            </Button>
          )}
        </div>
      )}

      {node.kind === "critic" && (
        <div className="space-y-2">
          <Label tip="Turn the critic into a loop: if the draft needs work, send it back to an earlier step. This is a LangGraph cycle.">
            If the draft needs work
          </Label>
          <select
            aria-label="If the draft needs work"
            className={selectCls}
            value={node.retryTo ?? ""}
            onChange={(e) => updateNode(node.id, { retryTo: e.target.value || undefined })}
          >
            <option value="">Rewrite it myself (no loop)</option>
            {recipe.nodes
              .filter((n) => n.id !== node.id && (n.kind === "agent" || n.kind === "tool"))
              .map((n) => (
                <option key={n.id} value={n.id}>
                  Send back to {stepName(recipe, n.id)}
                </option>
              ))}
          </select>
          {node.retryTo && (
            <div className="flex items-center gap-2 text-xs">
              <span>At most</span>
              <select
                aria-label="Maximum loops"
                className={`${selectCls} w-16`}
                value={node.maxLoops ?? DEFAULT_MAX_LOOPS}
                onChange={(e) => updateNode(node.id, { maxLoops: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              <span>loops, then move on</span>
              <Info tip="A safety limit so a picky critic can't loop forever (and burn your free allowance)." />
            </div>
          )}
        </div>
      )}

      {node.kind !== "final" && node.kind !== "router" && (
        <div>
          <Label tip="Where the run goes after this step. Normally the next block in the list; pick another to jump.">
            {node.kind === "critic" && node.retryTo ? "When the draft is good" : "After this step"}
          </Label>
          <Target
            ariaLabel="After this step"
            recipe={recipe}
            self={node}
            value={node.next}
            autoLabel={autoLabel}
            onChange={(next) => updateNode(node.id, { next })}
          />
        </div>
      )}
    </div>
  );
}

function Flow({ recipe, node }: { recipe: Recipe; node: RecipeNode }) {
  const auto = defaultNextId(recipe, node);
  const index = recipe.nodes.findIndex((n) => n.id === node.id);
  const following = recipe.nodes[index + 1]?.id ?? null;
  const chips: string[] = [];
  if (node.kind === "router")
    for (const r of node.routes ?? []) chips.push(`${r.label} → ${stepName(recipe, r.to ?? auto)}`);
  if (node.kind === "critic" && node.retryTo)
    chips.push(`needs work ↺ ${stepName(recipe, node.retryTo)}`);
  if (node.kind !== "router" && auto !== following) chips.push(`then → ${stepName(recipe, auto)}`);
  if (!chips.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c}
          className="rounded border border-primary/40 px-1.5 py-0.5 text-[10px] text-primary"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

export function BuilderPanel(props: Props) {
  const {
    recipe,
    activeId,
    runningId,
    busy,
    setActiveId,
    updateNode,
    addNode,
    removeNode,
    moveNode,
  } = props;
  const [dragId, setDragId] = useState<string | null>(null);
  const [view, setView] = useState<"steps" | "graph">("steps");

  return (
    <section className="rounded-lg border bg-card/90 p-4" aria-label="Recipe builder">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center font-bold">
          <AnimatedIcon name="blocks" /> Recipe Builder
          <Info tip="Stack blocks in order — the AI follows them top to bottom, unless a router or critic sends it elsewhere." />
        </h2>
        <span className="text-xs text-muted-foreground">{recipe.nodes.length} steps</span>
      </div>
      <input
        aria-label="Recipe name"
        className={`${inputCls} mb-3 font-semibold`}
        value={recipe.title}
        maxLength={200}
        onChange={(e) => props.onTitle(e.target.value)}
      />
      {recipe.source && (
        <a
          href={recipe.source}
          target="_blank"
          rel="noreferrer"
          className="mb-3 block text-xs text-primary underline"
        >
          Original recipe / prompt ↗
        </a>
      )}
      {props.graphView && (
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg border p-1" role="tablist">
          {(["steps", "graph"] as const).map((v) => (
            <Button
              key={v}
              role="tab"
              aria-selected={view === v}
              variant="ghost"
              onClick={() => setView(v)}
              className={`h-8 text-xs font-semibold ${view === v ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : ""}`}
            >
              {v === "steps" ? "Steps" : "Graph"}
            </Button>
          ))}
        </div>
      )}
      {view === "graph" && props.graphView ? (
        props.graphView
      ) : (
        <ol className="space-y-1">
          {recipe.nodes.map((s, i) => (
            <li key={s.id}>
              <StarFrame active={activeId === s.id || runningId === s.id}>
                <div
                  draggable={!busy}
                  role="group"
                  aria-label={`${s.label} step`}
                  onDragStart={() => setDragId(s.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId && dragId !== s.id) {
                      moveNode(dragId, i);
                      props.onMilestone("connect2");
                    }
                    setDragId(null);
                  }}
                  onClick={() => setActiveId(s.id)}
                  className={`group recipe-step cursor-pointer rounded-lg border p-3 transition hover:border-primary/60 ${activeId === s.id ? "border-primary bg-primary/10" : "bg-secondary/40"} ${runningId === s.id ? "ring-2 ring-accent animate-pulse" : ""} ${dragId === s.id ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="cursor-grab text-muted-foreground" title="Drag to reorder">
                      <AnimatedIcon name="grip" />
                    </span>
                    <span className="text-lg">
                      <AnimatedIcon name={s.kind} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Step {i + 1} · {KINDS[s.kind].title}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto max-w-full justify-start whitespace-normal px-0 py-0 text-left text-sm font-bold"
                        onClick={() => setActiveId(s.id)}
                      >
                        {s.label}
                      </Button>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button
                        variant="ghost"
                        disabled={busy || i === 0}
                        title="Move up"
                        size="icon"
                        aria-label="Move up"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveNode(s.id, i - 1);
                          props.onMilestone("connect2");
                        }}
                        className="h-7 w-6 rounded px-1 hover:bg-muted"
                      >
                        <AnimatedIcon name="up" />
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy || i === recipe.nodes.length - 1}
                        title="Move down"
                        size="icon"
                        aria-label="Move down"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveNode(s.id, i + 1);
                          props.onMilestone("connect2");
                        }}
                        className="h-7 w-6 rounded px-1 hover:bg-muted"
                      >
                        <AnimatedIcon name="down" />
                      </Button>
                      <HoldDelete
                        disabled={busy || recipe.nodes.length <= 1}
                        onDelete={() => {
                          removeNode(s.id);
                          if (activeId === s.id) setActiveId(null);
                        }}
                      />
                    </div>
                  </div>
                  <Flow recipe={recipe} node={s} />
                  {activeId === s.id && (
                    <StepEditor recipe={recipe} node={s} updateNode={updateNode} />
                  )}
                </div>
              </StarFrame>
              {i < recipe.nodes.length - 1 && <div className="ml-6 h-3 w-px bg-primary/60" />}
            </li>
          ))}
        </ol>
      )}
      <div className="mt-4">
        <Label tip="Add a new block to the end of your recipe.">Add a step</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(KINDS) as NodeKind[]).map((k) => (
            <Button
              variant="ghost"
              key={k}
              disabled={busy || recipe.nodes.length >= 40}
              onClick={() => {
                const node = addNode(k);
                setActiveId(node.id);
                if (recipe.nodes.length >= 1) props.onMilestone("connect2");
              }}
              className="h-auto justify-start whitespace-normal rounded-lg border px-2 py-1.5 text-left text-xs transition hover:border-primary hover:bg-primary/10"
            >
              <AnimatedIcon name={k} /> {KINDS[k].title}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
