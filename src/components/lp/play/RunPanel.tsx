import { useMemo, useRef, useState } from "react";
import {
  OVH_FREE,
  createChat,
  fallbackFor,
  runRecipe,
  type DocSearch,
  type LlmSettings,
  type Recipe,
  type RunResult,
  type StepTrace,
} from "@/engine";
import { PROVIDERS } from "@/lib/lp-data";
import { RECIPES } from "@/lib/lp-recipes";
import { listSaved } from "@/lib/lp-saved";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "../AnimatedIcon";
import { RunThought, SquishToggle } from "../EffectControls";
import { Info, btn, inputCls } from "../Info";
import { TraceView } from "./TraceView";
import { runMeta } from "./helpers";

type Side = {
  recipe: Recipe;
  settings: LlmSettings;
  steps: StepTrace[];
  result?: RunResult;
  error?: string;
};
type Turn = { id: number; question: string; a: Side; b?: Side };

export type RunMilestone = "first_run" | "tool" | "trace" | "router" | "loop" | "docs" | "compare";

const providerName = (s: LlmSettings) =>
  `${PROVIDERS.find((p) => p.id === s.provider)?.name ?? s.provider}${s.provider !== "simulator" && s.model ? ` · ${s.model}` : ""}`;

type Choice = { id: string; group: string; label: string; settings?: LlmSettings; recipe?: Recipe };

function compareChoices(settings: LlmSettings): Choice[] {
  const keyless: LlmSettings[] = [
    { provider: "simulator", baseUrl: "", apiKey: "", model: "sim-1" },
    {
      provider: "pollinations",
      baseUrl: "https://text.pollinations.ai/openai",
      apiKey: "",
      model: "openai",
    },
    OVH_FREE,
    { ...OVH_FREE, model: "Meta-Llama-3_3-70B-Instruct" },
  ];
  const sameService = (PROVIDERS.find((p) => p.id === settings.provider)?.models ?? [])
    .filter((m) => m !== settings.model)
    .map((model) => ({ ...settings, model }));
  return [
    ...[...sameService, ...keyless]
      .filter((s) => !(s.provider === settings.provider && s.model === settings.model))
      .map((s, i) => ({
        id: `ai${i}`,
        group: "Same recipe, another AI",
        label: providerName(s),
        settings: s,
      })),
    ...listSaved().map((s) => ({
      id: `saved-${s.id}`,
      group: "Same AI, one of my recipes",
      label: s.title,
      recipe: s.recipe,
    })),
    ...RECIPES.map((r) => ({
      id: `lib-${r.id}`,
      group: "Same AI, a library recipe",
      label: r.title,
      recipe: r,
    })),
  ];
}

export function RunPanel({
  recipe,
  settings,
  searchDocs,
  onStep,
  onMilestone,
  firstRunDone,
  docCount,
  onOpenDocs,
  onResult,
}: {
  recipe: Recipe;
  settings: LlmSettings;
  searchDocs?: DocSearch | undefined;
  onStep: (nodeId: string | null) => void;
  onMilestone: (id: RunMilestone) => void;
  firstRunDone: boolean;
  docCount: number;
  onOpenDocs: () => void;
  onResult?: (result: RunResult) => void;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [compare, setCompare] = useState(false);
  const [choiceId, setChoiceId] = useState("ai0");
  const [traceSide, setTraceSide] = useState<"a" | "b">("a");
  const lock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const last = turns[turns.length - 1];
  // Saved recipes are re-read whenever Compare is switched on.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const choices = useMemo(() => compareChoices(settings), [settings, compare]);
  const choice = choices.find((c) => c.id === choiceId) ?? choices[0];

  const execute = async (
    side: Side,
    q: string,
    signal: AbortSignal,
    update: (s: Partial<Side>) => void,
    primary: boolean,
  ) => {
    const steps: StepTrace[] = [];
    try {
      const result = await runRecipe(
        side.recipe,
        q,
        {
          chat: createChat(side.settings),
          fallbackChat: fallbackFor(side.settings),
          simulated: side.settings.provider === "simulator",
          searchDocs,
          signal,
        },
        (event) => {
          if (event.type === "step-start" && primary) {
            setRunning(side.recipe.nodes.find((n) => n.id === event.nodeId)?.label ?? "step");
            onStep(event.nodeId);
          } else if (event.type === "step") {
            steps.push(event.trace);
            update({ steps: [...steps] });
          }
        },
      );
      update({ result, steps: result.steps });
      return result;
    } catch (e) {
      update({ error: e instanceof Error ? e.message : "Something went wrong" });
      return null;
    }
  };

  const run = async () => {
    if (lock.current || !recipe.nodes.length) return;
    lock.current = true;
    const q = question.trim() || "Why is the sky blue?";
    const id = Date.now();
    const a: Side = { recipe, settings, steps: [] };
    const b: Side | undefined =
      compare && choice
        ? { recipe: choice.recipe ?? recipe, settings: choice.settings ?? settings, steps: [] }
        : undefined;
    setQuestion("");
    setTraceSide("a");
    setTurns((t) => [...t.slice(-19), { id, question: q, a, ...(b ? { b } : {}) }]);
    abort.current = new AbortController();
    const signal = abort.current.signal;
    const patch = (key: "a" | "b") => (change: Partial<Side>) =>
      setTurns((t) =>
        t.map((turn) => {
          if (turn.id !== id) return turn;
          const side = turn[key];
          return side ? { ...turn, [key]: { ...side, ...change } } : turn;
        }),
      );
    try {
      const [ra] = await Promise.all([
        execute(a, q, signal, patch("a"), true),
        b ? execute(b, q, signal, patch("b"), false) : Promise.resolve(null),
      ]);
      if (ra) {
        onResult?.(ra);
        onMilestone("first_run");
        if (b) onMilestone("compare");
        if (ra.steps.some((s) => s.kind === "tool" && !s.practice)) onMilestone("tool");
        if (ra.steps.some((s) => s.kind === "router" && s.decision)) onMilestone("router");
        if (ra.steps.some((s) => s.kind === "critic" && s.decision?.startsWith("Needs work")))
          onMilestone("loop");
        if (ra.steps.some((s) => s.kind === "retriever" && !s.practice)) onMilestone("docs");
      }
    } finally {
      setRunning(null);
      onStep(null);
      lock.current = false;
      abort.current = null;
    }
  };

  const answerCard = (side: Side, tag?: string) => (
    <div className="animate-pop min-w-0 rounded-lg bg-secondary px-4 py-2.5 text-sm">
      {tag && (
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">{tag}</p>
      )}
      {side.result ? (
        <>
          <p className="whitespace-pre-wrap">{side.result.answer}</p>
          <p className="mt-2 border-t pt-1.5 text-[11px] text-muted-foreground">
            {runMeta(side.result, side.settings)}
            {side.result.fallbacks > 0 &&
              ` · ${side.result.fallbacks} step${side.result.fallbacks > 1 ? "s" : ""} used a backup`}
            {side.result.stoppedByGuard && " · stopped after 50 steps (loop guard)"}
          </p>
        </>
      ) : side.error ? (
        <p role="alert" className="text-destructive">
          Could not finish: {side.error}
        </p>
      ) : (
        <p className="text-muted-foreground">Working… {side.steps.length} steps so far</p>
      )}
    </div>
  );

  const traceOf = last ? (traceSide === "b" && last.b ? last.b : last.a) : undefined;

  return (
    <section
      className="flex min-h-[600px] flex-col rounded-lg border bg-card/90"
      aria-label="Live run"
    >
      <div className="flex items-center justify-between gap-2 border-b p-4">
        <h2 className="flex items-center font-bold">
          <AnimatedIcon name="chat" /> Live Run
          <Info tip="Type a question and watch your recipe work on it step by step." />
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">{providerName(settings)}</span>
          <Button variant="outline" size="sm" onClick={onOpenDocs} className="h-7 text-xs">
            <AnimatedIcon name="retriever" /> Documents{docCount ? ` (${docCount})` : ""}
          </Button>
        </div>
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
              <p className="text-xs">Connected to {providerName(settings)}. Ask anything.</p>
            </div>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className="space-y-2">
            <div className="animate-pop ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              {t.question}
            </div>
            {t.b ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {answerCard(t.a, `A · ${t.a.recipe.title} · ${providerName(t.a.settings)}`)}
                {answerCard(t.b, `B · ${t.b.recipe.title} · ${providerName(t.b.settings)}`)}
              </div>
            ) : (
              <div className="max-w-[92%]">{answerCard(t.a)}</div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t p-4">
        <div className="mb-3 rounded-lg border bg-background/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <AnimatedIcon name="inspect" /> Inspect Box
              <Info tip="A diary of every step. Click one to see exactly what was sent to the AI and what came back." />
            </h3>
            {last?.b && (
              <div className="flex gap-1" role="tablist" aria-label="Which run to inspect">
                {(["a", "b"] as const).map((k) => (
                  <Button
                    key={k}
                    role="tab"
                    aria-selected={traceSide === k}
                    size="sm"
                    variant={traceSide === k ? "default" : "outline"}
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setTraceSide(k)}
                  >
                    {k.toUpperCase()}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <TraceView
            steps={traceOf?.steps ?? []}
            nodes={traceOf?.recipe.nodes ?? recipe.nodes}
            runningLabel={traceSide === "a" ? running : null}
            onOpenStep={() => onMilestone("trace")}
          />
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <SquishToggle label="Compare side by side" checked={compare} onChange={setCompare} />
          <span>Compare</span>
          {compare && (
            <select
              aria-label="Compare with"
              className={`${inputCls} w-auto max-w-[16rem] py-1 text-xs`}
              value={choice?.id ?? ""}
              onChange={(e) => setChoiceId(e.target.value)}
            >
              {[...new Set(choices.map((c) => c.group))].map((g) => (
                <optgroup key={g} label={g}>
                  {choices
                    .filter((c) => c.group === g)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          )}
          <Info tip="Run the same question twice at once: through another AI, or through another recipe. See which answers better, faster and cheaper." />
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
