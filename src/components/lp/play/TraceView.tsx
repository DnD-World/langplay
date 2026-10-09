import { useState } from "react";
import { TOOL_INFO, type RecipeNode, type StepTrace } from "@/engine";
import { AnimatedIcon } from "../AnimatedIcon";

const tokens = (t: StepTrace) =>
  t.usage ? `${t.usage.prompt + t.usage.completion}${t.usage.estimated ? "≈" : ""} tokens` : "";

function summary(t: StepTrace, node?: RecipeNode): string {
  switch (t.kind) {
    case "input":
      return `Filled in the blanks: "${t.output.slice(0, 90)}${t.output.length > 90 ? "…" : ""}"`;
    case "agent":
      return `Thought it over and wrote a draft (${t.output.length} characters).`;
    case "final":
      return "Polished everything into the final answer.";
    case "router":
      return t.decision ?? "Picked a path.";
    case "critic":
      return t.decision ?? "Reviewed the draft and rewrote the weak parts.";
    case "tool": {
      const name = TOOL_INFO[node?.tool ?? "sample"].name;
      const n = t.sources?.length ?? 0;
      return t.practice
        ? `Practised with ${name}: ${n} made-up results, no live search.`
        : `Used ${name}${t.input ? ` with "${t.input.slice(0, 60)}"` : ""} → ${n} result${n === 1 ? "" : "s"}.`;
    }
    case "retriever":
      return t.practice
        ? "Practised document lookup with sample page notes."
        : `Found ${t.sources?.length ?? 0} matching passage${t.sources?.length === 1 ? "" : "s"} in your documents.`;
  }
}

export function TraceView({
  steps,
  nodes,
  runningLabel,
  onOpenStep,
}: {
  steps: StepTrace[];
  nodes: RecipeNode[];
  runningLabel?: string | null;
  onOpenStep?: () => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!steps.length && !runningLabel)
    return (
      <p className="text-xs text-muted-foreground">
        Nothing yet — run the recipe to see each step.
      </p>
    );
  return (
    <ol className="max-h-[22rem] space-y-1 overflow-y-auto pr-1 text-xs">
      {steps.map((t) => {
        const node = nodes.find((n) => n.id === t.nodeId);
        const isOpen = open === t.index;
        return (
          <li key={t.index} className="animate-pop rounded-md border bg-card/60">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => {
                setOpen(isOpen ? null : t.index);
                if (!isOpen) onOpenStep?.();
              }}
              className="flex w-full items-start gap-2 p-2 text-left hover:bg-secondary/50"
            >
              <AnimatedIcon name={t.kind} />
              <span className="min-w-0 flex-1">
                <b>{t.label}:</b> {summary(t, node)}
                {t.note && (
                  <span className="mt-0.5 block text-coin">
                    <AnimatedIcon name="warning" /> {t.note}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right text-[10px] text-muted-foreground">
                {(t.ms / 1000).toFixed(1)}s{tokens(t) && <span className="block">{tokens(t)}</span>}
              </span>
            </button>
            {isOpen && (
              <div className="space-y-2 border-t p-2">
                {t.messages && (
                  <div>
                    <div className="mb-1 font-bold uppercase tracking-wider text-muted-foreground">
                      Sent to the AI{t.model ? ` · ${t.provider} / ${t.model}` : ""}
                    </div>
                    {t.messages.map((m, i) => (
                      <pre
                        key={i}
                        className={`mb-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border p-2 font-mono text-[11px] ${m.role === "system" ? "border-primary/40" : ""}`}
                      >
                        <span className="font-bold text-primary">{m.role}: </span>
                        {m.content}
                      </pre>
                    ))}
                  </div>
                )}
                {t.input && !t.messages && (
                  <div>
                    <div className="mb-1 font-bold uppercase tracking-wider text-muted-foreground">
                      Input
                    </div>
                    <pre className="whitespace-pre-wrap break-words rounded border p-2 font-mono text-[11px]">
                      {t.input}
                    </pre>
                  </div>
                )}
                {t.input && t.messages && t.kind === "tool" && (
                  <p>
                    <b>Tool input the AI wrote:</b> {t.input}
                  </p>
                )}
                <div>
                  <div className="mb-1 font-bold uppercase tracking-wider text-muted-foreground">
                    {t.kind === "tool" || t.kind === "retriever" ? "Results" : "Output"}
                  </div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border bg-background/60 p-2 font-mono text-[11px] text-success">
                    {t.output || "(empty)"}
                  </pre>
                </div>
                {t.decision && (
                  <p>
                    <b>Decision:</b> {t.decision}
                  </p>
                )}
                {!!t.sources?.length && (
                  <ul className="space-y-1">
                    {t.sources.map((s, i) => (
                      <li key={i}>
                        {s.url ? (
                          <a
                            className="text-primary underline"
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.title} ↗
                          </a>
                        ) : (
                          <b>{s.title}</b>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        );
      })}
      {runningLabel && (
        <li className="flex items-center gap-2 rounded-md border border-dashed p-2 text-muted-foreground">
          <AnimatedIcon name="agent" /> Working: {runningLabel}…
        </li>
      )}
    </ol>
  );
}
