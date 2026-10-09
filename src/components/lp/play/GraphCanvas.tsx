import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useState } from "react";
import { graphEdges, layoutRecipe, type NodePatch, type Recipe, type RecipeNode } from "@/engine";
import { KINDS } from "@/lib/lp-data";
import { AnimatedIcon } from "../AnimatedIcon";

// The visual graph: the same recipe as the Steps list, drawn as nodes and edges the way
// LangGraph thinks about it. Dragging saves positions; drawing an edge rewires the recipe.

type NodeData = { node: RecipeNode; active: boolean; running: boolean };
type LpNode = Node<NodeData, "lp">;

function StepNode({ data }: NodeProps<LpNode>) {
  const { node, active, running } = data;
  const routes = node.kind === "router" ? (node.routes ?? []) : [];
  const loop = node.kind === "critic" && !!node.retryTo;
  return (
    <div
      className={`lp-graph-node ${active ? "is-active" : ""} ${running ? "is-running" : ""}`}
      data-kind={node.kind}
    >
      <Handle type="target" position={Position.Top} className="lp-handle" />
      <div className="flex items-center gap-2">
        <AnimatedIcon name={node.kind} />
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {KINDS[node.kind].title}
          </div>
          <div className="truncate text-xs font-bold">{node.label}</div>
        </div>
      </div>
      {routes.length > 0 ? (
        <div className="mt-2 flex justify-between gap-1">
          {routes.map((r, i) => (
            <span key={i} className="relative flex-1 text-center text-[9px] text-primary">
              {r.label}
              <Handle
                type="source"
                id={`route:${i}`}
                position={Position.Bottom}
                className="lp-handle lp-handle-route"
                style={{ left: "50%" }}
              />
            </span>
          ))}
        </div>
      ) : node.kind !== "final" ? (
        <Handle
          type="source"
          id={loop ? "good" : "next"}
          position={Position.Bottom}
          className="lp-handle"
        />
      ) : null}
      {node.kind === "critic" && (
        <Handle
          type="source"
          id="retry"
          position={Position.Right}
          className="lp-handle lp-handle-retry"
          title="Drag to the step that should redo the work"
        />
      )}
    </div>
  );
}

const nodeTypes = { lp: StepNode };

export default function GraphCanvas({
  recipe,
  activeId,
  runningId,
  onSelect,
  updateNode,
  height,
}: {
  recipe: Recipe;
  activeId: string | null;
  runningId: string | null;
  onSelect: (id: string) => void;
  updateNode: (id: string, patch: NodePatch) => void;
  height: number | string;
}) {
  const positions = useMemo(() => layoutRecipe(recipe), [recipe]);
  const build = (): LpNode[] =>
    recipe.nodes.map((n) => ({
      id: n.id,
      type: "lp",
      position: positions[n.id] ?? { x: 0, y: 0 },
      data: { node: n, active: n.id === activeId, running: n.id === runningId },
      deletable: false,
    }));
  const [nodes, setNodes] = useState<LpNode[]>(build);
  // Re-sync when the recipe or highlight changes (positions keep any drag in progress).
  useEffect(() => setNodes(build()), [recipe, activeId, runningId, positions]); // eslint-disable-line react-hooks/exhaustive-deps

  const edges: Edge[] = graphEdges(recipe).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.handle,
    label: e.label,
    animated: e.loop || e.source === runningId,
    className: e.loop ? "lp-edge-loop" : e.label ? "lp-edge-route" : "lp-edge",
    markerEnd: { type: MarkerType.ArrowClosed },
    ...(e.loop ? { type: "smoothstep" } : {}),
  }));

  const connect = (c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    const node = recipe.nodes.find((n) => n.id === c.source);
    if (!node) return;
    const handle = c.sourceHandle ?? "next";
    if (handle.startsWith("route:")) {
      const index = Number(handle.slice(6));
      updateNode(node.id, {
        routes: (node.routes ?? []).map((r, i) =>
          i === index ? { label: r.label, to: c.target } : r,
        ),
      });
    } else if (handle === "retry") updateNode(node.id, { retryTo: c.target });
    else updateNode(node.id, { next: c.target });
  };

  const removeEdges = (removed: Edge[]) => {
    for (const e of removed) {
      const node = recipe.nodes.find((n) => n.id === e.source);
      if (!node) continue;
      const handle = e.sourceHandle ?? "next";
      if (handle.startsWith("route:")) {
        const index = Number(handle.slice(6));
        updateNode(node.id, {
          routes: (node.routes ?? []).map((r, i) => (i === index ? { label: r.label } : r)),
        });
      } else if (handle === "retry")
        updateNode(node.id, { retryTo: undefined, maxLoops: undefined });
      else updateNode(node.id, { next: undefined });
    }
  };

  return (
    <div className="lp-graph" style={{ height }}>
      <ReactFlow<LpNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={(changes: NodeChange<LpNode>[]) =>
          setNodes((ns) =>
            applyNodeChanges(
              changes.filter((c) => c.type !== "remove"),
              ns,
            ),
          )
        }
        onNodeDragStop={(_, n) =>
          updateNode(n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) })
        }
        onNodeClick={(_, n) => onSelect(n.id)}
        onConnect={connect}
        onEdgesDelete={removeEdges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        proOptions={{ hideAttribution: false }}
        colorMode="dark"
      >
        <Background gap={22} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
