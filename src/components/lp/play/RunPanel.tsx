import { useRef, useState } from "react";
import {
  createChat,
  runRecipe,
  fallbackFor,
  type DocSearch,
  type LlmSettings,
  type Recipe,
  type RunResult,
  type StepTrace,
} from "@/engine";
import { PROVIDERS } from "@/lib/lp-data";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "../AnimatedIcon";
import { RunThought } from "../EffectControls";
import { Info, btn, inputCls } from "../Info";
import { TraceView } from "./TraceView";
import { runMeta } from "./helpers";

type Turn = {
  id: number;
  question: string;
  steps: StepTrace[];
  result?: RunResult;
  error?: string;
  settings: LlmSettings;
};

export type RunMilestone = "first_run" | "tool" | "trace" | "router" | "loop" | "docs";

export function RunPanel({
  recipe,
  settings,
  searchDocs,
  onStep,
  onMilestone,
  firstRunDone,
}: {
  recipe: Recipe;
  settings: LlmSettings;
  searchDocs?: DocSearch | undefined;
  onStep: (nodeId: string | null) => void;
  onMilestone: (id: RunMilestone) => void;
  firstRunDone: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const lock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const providerName = PROVIDERS.find((p) => p.id === settings.provider)?.name ?? settings.provider;
  const last = turns[turns.length - 1];

  const run = async () => {
    if (lock.current || !recipe.nodes.length) return;
    lock.current = true;
    const q = question.trim() || "Why is the sky blue?";
    const id = Date.now();
    const snapshot = recipe;
    const used = settings;
    setQuestion("");
    setTurns((t) => [...t.slice(-19), { id, question: q, steps: [], settings: used }]);
    abort.current = new AbortController();
    const patch = (change: Partial<Turn>) =>
      setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, ...change } : turn)));
    try {
      const steps: StepTrace[] = [];
      const result = await runRecipe(
        snapshot,
        q,
        {
          chat: createChat(used),
          fallbackChat: fallbackFor(used),
          simulated: used.provider === "simulator",
          searchDocs,
          signal: abort.current.signal,
        },
        (event) => {
          if (event.type === "step-start") {
            const node = snapshot.nodes.find((n) => n.id === event.nodeId);
            setRunning(node?.label ?? "step");
            onStep(event.nodeId);
          } else if (event.type === "step") {
            steps.push(event.trace);
            patch({ steps: [...steps] });
          }
        },
      );
      patch({ result, steps: result.steps });
      onMilestone("first_run");
      if (result.steps.some((s) => s.kind === "tool" && !s.practice)) onMilestone("tool");
      if (result.steps.some((s) => s.kind === "router" && s.decision)) onMilestone("router");
      if (result.steps.some((s) => s.kind === "critic" && s.decision?.startsWith("Needs work")))
        onMilestone("loop");
      if (result.steps.some((s) => s.kind === "retriever" && !s.practice)) onMilestone("docs");
    } catch (e) {
      patch({ error: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setRunning(null);
      onStep(null);
      lock.current = false;
      abort.current = null;
    }
  };

  return (
    <section
      className="flex min-h-[600px] flex-col rounded-lg border bg-card/90"
      aria-label="Live run"
    >
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="flex items-center font-bold">
          <AnimatedIcon name="chat" /> Live Run
          <Info tip="Type a question and watch your recipe work on it step by step." />
        </h2>
        <span className="text-xs text-muted-foreground">
          {providerName}
          {settings.provider !== "simulator" && settings.model ? ` · ${settings.model}` : ""}
        </span>
      </div>
      {(running || last) && (
        <div className="border-b px-4 py-3">
          <RunThought working={!!running} label={`Working: ${running ?? "recipe"}`} />
        </div>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {turns.length === 0 && (
          <div className="grid h-full place-items-center text-center text-muted-foreground">
            <div>
              <div className="mb-3 text-5xl">
                <AnimatedIcon name="game" />
              </div>
              <p className="font-semibold">First run. First 50 XP.</p>
              <p className="text-xs">Real AI is connected ({providerName}). Ask anything.</p>
            </div>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className="space-y-2">
            <div className="animate-pop ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              {t.question}
            </div>
            {t.result && (
              <div className="animate-pop max-w-[92%] rounded-lg bg-secondary px-4 py-2.5 text-sm">
                <p className="whitespace-pre-wrap">{t.result.answer}</p>
                <p className="mt-2 border-t pt-1.5 text-[11px] text-muted-foreground">
                  {runMeta(t.result, t.settings)}
                  {t.result.fallbacks > 0 &&
                    ` · ${t.result.fallbacks} step${t.result.fallbacks > 1 ? "s" : ""} used the practice Simulator`}
                  {t.result.stoppedByGuard && " · stopped after 50 steps (loop guard)"}
                </p>
              </div>
            )}
            {t.error && (
              <div
                role="alert"
                className="max-w-[92%] rounded-lg border border-destructive px-4 py-2.5 text-sm text-destructive"
              >
                Could not finish: {t.error}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t p-4">
        <div className="mb-3 rounded-lg border bg-background/50 p-3">
          <h3 className="mb-2 flex items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <AnimatedIcon name="inspect" /> Inspect Box
            <Info tip="A diary of every step. Click one to see exactly what was sent to the AI and what came back." />
          </h3>
          <TraceView
            steps={last?.steps ?? []}
            nodes={recipe.nodes}
            runningLabel={running}
            onOpenStep={() => onMilestone("trace")}
          />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!running) void run();
          }}
          className="flex items-center gap-2"
        >
          <input
            aria-label="Your question"
            className={inputCls}
            value={question}
            maxLength={4000}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question, e.g. Why is the sky blue?"
          />
          <Info tip="Your question — it gets dropped into the first step of the recipe." />
          {running ? (
            <Button
              type="button"
              variant="outline"
              className={btn}
              onClick={() => abort.current?.abort()}
            >
              Stop
            </Button>
          ) : (
            <Button disabled={!recipe.nodes.length} className={`${btn} hover:brightness-110`}>
              <AnimatedIcon name="play" /> {firstRunDone ? "Run" : "Run · +50 XP"}
            </Button>
          )}
        </form>
      </div>
    </section>
  );
}
