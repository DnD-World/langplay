import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  KINDS,
  PROVIDERS,
  QUESTS,
  RANKS,
  RECIPES,
  defaultSteps,
  mk,
  type Recipe,
  type Step,
  type StepKind,
} from "@/lib/lp-data";
import { chat, type LlmSettings } from "@/lib/lp-llm";
import { Info, Label, inputCls, btn } from "@/components/lp/Info";
import { SettingsDrawer } from "@/components/lp/SettingsDrawer";
import { RecipeHub } from "@/components/lp/RecipeHub";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "@/components/lp/AnimatedIcon";
import { Motion, StarFrame } from "@/components/lp/Motion";
import "@/components/lp/Motion.css";
import { HoldDelete, SquishToggle, RunThought } from "@/components/lp/EffectControls";
import logo from "@/assets/langplay-logo.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Langplay — Learn LangChain & LangGraph visually" },
      {
        name: "description",
        content:
          "A playful, no-code playground for beginners to build and run LangChain and LangGraph recipes.",
      },
      { property: "og:title", content: "Langplay — Learn LangChain & LangGraph visually" },
      {
        property: "og:description",
        content:
          "Build AI recipes with blocks, run them, and learn what's under the hood — no coding needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Playground,
});

type Log = { stepId: string; text: string; ok: boolean };
type ChatMsg = { role: "user" | "ai"; text: string };

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

function Playground() {
  const [steps, setSteps] = useState<Step[]>(defaultSteps);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<LlmSettings>({
    provider: "pollinations",
    baseUrl: "https://text.pollinations.ai/openai",
    apiKey: "",
    model: "openai",
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showHub, setShowHub] = useState(false);
  const [question, setQuestion] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [points, setPoints] = useState(0);
  const [coins, setCoins] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [retro, setRetro] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [motion, setMotion] = useState(true);
  const [recipeSource, setRecipeSource] = useState<string | null>(null);
  const completed = useRef(new Set<string>());
  const loaded = useRef(false);

  // load / save
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("lp-settings") || "null");
      if (
        s &&
        typeof s === "object" &&
        typeof s.provider === "string" &&
        typeof s.baseUrl === "string" &&
        typeof s.apiKey === "string" &&
        typeof s.model === "string"
      )
        setSettings({ ...s, modelFreeVerified: false });
      const g = JSON.parse(localStorage.getItem("lp-game") || "null");
      if (g && Array.isArray(g.done) && Number.isFinite(g.points) && Number.isFinite(g.coins)) {
        const valid = g.done.filter(
          (id: unknown) => typeof id === "string" && QUESTS.some((q) => q.id === id),
        );
        completed.current = new Set(valid);
        setDone(valid);
        setPoints(Math.max(0, g.points));
        setCoins(Math.max(0, g.coins));
        setRetro(!!g.retro);
      }
      setMotion(localStorage.getItem("lp-motion") !== "off");
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    try {
      if (loaded.current) localStorage.setItem("lp-settings", JSON.stringify(settings));
    } catch {
      /* storage may be blocked */
    }
  }, [settings]);
  useEffect(() => {
    try {
      if (loaded.current)
        localStorage.setItem("lp-game", JSON.stringify({ done, points, coins, retro }));
    } catch {
      /* storage may be blocked */
    }
  }, [done, points, coins, retro]);

  useEffect(() => {
    try {
      if (loaded.current) localStorage.setItem("lp-motion", motion ? "on" : "off");
    } catch {
      /* best effort: pointer capture or storage may be unavailable */
    }
  }, [motion]);
  useEffect(() => {
    document.documentElement.classList.toggle("motion-off", !motion);
    return () => document.documentElement.classList.remove("motion-off");
  }, [motion]);
  const runLock = useRef(false);

  const complete = (id: string) => {
    const quest = QUESTS.find((x) => x.id === id);
    if (!quest || completed.current.has(id)) return;
    completed.current.add(id);
    setDone([...completed.current]);
    setPoints((p) => p + quest.pts);
    setCoins((c) => c + quest.coins);
    setToast(
      `${quest.title === "??? Secret ???" ? "Konami Master" : quest.title} · +${quest.pts} XP · +${quest.coins} coins`,
    );
    setTimeout(() => setToast(null), 3000);
  };

  // konami
  useEffect(() => {
    let i = 0;
    const h = (e: KeyboardEvent) => {
      i = e.key === KONAMI[i] ? i + 1 : e.key === KONAMI[0] ? 1 : 0;
      if (i === KONAMI.length) {
        i = 0;
        setRetro((r) => !r);
        complete("konami");
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const rank = [...RANKS].reverse().find((r) => points >= r.min) ?? {
    name: "Novice Apprentice",
    min: 0,
  };
  const next = RANKS.find((r) => r.min > points);
  const active = steps.find((s) => s.id === activeId) ?? null;

  const move = (id: string, dir: -1 | 1) =>
    setSteps((s) => {
      const i = s.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.length) return s;
      const c = [...s];
      const first = c[i];
      const second = c[j];
      if (!first || !second) return s;
      c[i] = second;
      c[j] = first;
      complete("connect2");
      return c;
    });
  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    setSteps((s) => {
      const c = [...s];
      const from = c.findIndex((x) => x.id === dragId);
      if (from < 0) return s;
      const [it] = c.splice(from, 1);
      if (!it) return s;
      c.splice(
        c.findIndex((x) => x.id === targetId),
        0,
        it,
      );
      return c;
    });
    setDragId(null);
    complete("connect2");
  };
  const update = (id: string, patch: Partial<Step>) =>
    setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const install = (r: Recipe) => {
    const ns = r.steps.map((s) => mk(s.kind, s.instruction, s.label));
    setRecipeSource(r.source ?? null);
    setSteps(ns);
    setActiveId(ns[0]?.id ?? null);
    setLogs([]);
    complete("install");
  };

  const run = async () => {
    if (!steps.length || runLock.current) return;
    runLock.current = true;
    let currentStepId = steps[0]?.id ?? "";
    const qn = question.trim() || "Why is the sky blue?";
    setMsgs((m) => [...m, { role: "user", text: qn }]);
    setLogs([]);
    setQuestion("");
    let context = qn;
    let answer = "";
    const notes: string[] = [];
    try {
      for (const s of steps) {
        currentStepId = s.id;
        setRunning(s.id);
        setActiveId(s.id);
        const log = (text: string) => setLogs((l) => [...l, { stepId: s.id, text, ok: true }]);
        if (s.kind === "input") {
          context = s.instruction.includes("{question}")
            ? s.instruction.replace("{question}", qn)
            : `${s.instruction}\n${qn}`;
          await new Promise((r) => setTimeout(r, 300));
          log(`Filled in the blanks: "${context.slice(0, 120)}"`);
        } else if (s.kind === "tool") {
          await new Promise((r) => setTimeout(r, 600));
          const found = `• Source A says the main idea of "${qn.slice(0, 40)}" is well documented.\n• Source B gives a simple everyday example.`;
          notes.push(found);
          complete("tool");
          log(
            `Practiced using a gadget (${s.label}) with 2 made-up sample results; no live search was performed.`,
          );
        } else if (s.kind === "retriever") {
          await new Promise((r) => setTimeout(r, 500));
          notes.push("Page 3: key definition. Page 7: a worked example. Page 12: a summary.");
          log(
            "Practiced document lookup with sample page notes; no document was uploaded or read.",
          );
        } else if (s.kind === "router") {
          const path = /refund|bill|pay|price|charge/i.test(qn) ? "Billing desk" : "Tech help desk";
          await new Promise((r) => setTimeout(r, 300));
          notes.push(`Routed to: ${path}`);
          log(`Looked at the question and sent it to the ${path}.`);
        } else {
          const prompt = [
            {
              role: "system" as const,
              content: `${s.instruction.replaceAll("{question}", qn)} Keep it short and beginner-friendly.`,
            },
            {
              role: "user" as const,
              content: `${context}${notes.length ? `\n\nNotes so far:\n${notes.join("\n")}` : ""}${answer ? `\n\nPrevious draft:\n${answer}` : ""}`,
            },
          ];
          let out: string;
          try {
            out = await chat(settings, prompt);
          } catch (e) {
            if (settings.provider === "simulator") throw e;
            out = await chat({ ...settings, provider: "simulator" }, prompt);
            log(
              `${PROVIDERS.find((p) => p.id === settings.provider)?.name ?? "The AI service"} did not answer (${e instanceof Error ? e.message.slice(0, 120) : "error"}), so the practice Simulator answered this step.`,
            );
          }
          answer = out;
          log(
            s.kind === "critic"
              ? "Reviewed the draft and rewrote the weak parts."
              : s.kind === "final"
                ? "Polished everything into the final answer."
                : `Thought it over and wrote a draft (${out.length} characters).`,
          );
        }
      }
      setMsgs((m) => [...m, { role: "ai", text: answer || notes.join("\n") || context }]);
      complete("first_run");
    } catch (e) {
      const t = e instanceof Error ? e.message : "Something went wrong";
      setLogs((l) => [...l, { stepId: currentStepId, text: `Oops: ${t}`, ok: false }]);
      setMsgs((m) => [
        ...m,
        { role: "ai", text: `Could not finish: ${t} Try the Offline Simulator in settings.` },
      ]);
    }
    setRunning(null);
    runLock.current = false;
  };

  const prov = settings.provider;

  return (
    <Motion enabled={motion}>
      <div className={`${retro ? "retro" : ""} min-h-screen text-foreground`}>
        {/* NAV */}
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <img className="brand-logo" src={logo.url} alt="Langplay logo" />
            <div>
              <h1 className="text-lg font-extrabold leading-none tracking-tight">
                Lang<span className="text-primary">play</span>
              </h1>
              <p className="text-[11px] text-muted-foreground">Your AI adventure</p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="nav-stat">
              <span className="animate-pop" key={rank.name}>
                <AnimatedIcon name="crown" />
              </span>
              <span className="font-bold">{rank.name}</span>
              <Info tip="Your level — earn XP by completing quests to rank up." />
            </div>
            <div className="nav-stat font-bold text-primary">
              <AnimatedIcon name="spark" /> {points} XP
            </div>
            <div className="nav-stat font-bold text-coin">
              <AnimatedIcon name="coin" /> {coins}
              <Info tip="Token Coins — a fun reward you collect for finishing quests." />
            </div>
            <Button
              asChild
              variant="ghost"
              className={`${btn} border bg-card hover:border-primary`}
            >
              <Link to="/docs">Docs</Link>
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowHub(true)}
              className={`${btn} relative border bg-card hover:border-primary`}
            >
              <AnimatedIcon name="tool" /> Explore Library
              <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] text-accent-foreground">
                {RECIPES.length}
              </span>
            </Button>
            <Button
              onClick={() => setShowSettings(true)}
              aria-label="Open settings"
              className={`${btn} hover:brightness-110`}
            >
              <AnimatedIcon name="settings" /> Settings
              <span className="rounded-full bg-background/40 px-2 py-0.5 text-[10px] font-normal">
                {PROVIDERS.find((p) => p.id === prov)?.name ?? prov}
              </span>
            </Button>
          </div>
        </header>

        <div className="mission-band relative z-10 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <AnimatedIcon name="target" />
            <span className="font-bold">
              {QUESTS.find((q) => q.id !== "konami" && !done.includes(q.id))?.title ??
                "Adventure complete"}
            </span>
            <span className="text-xs text-primary">
              {QUESTS.find((q) => q.id !== "konami" && !done.includes(q.id))
                ? `+${QUESTS.find((q) => q.id !== "konami" && !done.includes(q.id))?.pts} XP`
                : "Keep experimenting"}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {done.filter((id) => id !== "konami").length} / 6 milestones
            </span>
          </div>
          <progress
            aria-label="Adventure progress"
            value={done.filter((id) => id !== "konami").length}
            max={6}
          />
        </div>
        <main className="langplay-workspace grid gap-4 p-4 lg:grid-cols-[minmax(250px,300px)_minmax(0,1fr)_minmax(250px,300px)]">
          {/* PANEL A */}
          <section className="rounded-lg border bg-card/90 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center font-bold">
                <AnimatedIcon name="blocks" /> Recipe Builder
                <Info tip="Stack blocks in order — the AI follows them top to bottom like a recipe." />
              </h2>
              <span className="text-xs text-muted-foreground">{steps.length} steps</span>
            </div>
            {recipeSource && (
              <a
                href={recipeSource}
                target="_blank"
                rel="noreferrer"
                className="mb-3 block text-xs text-primary underline"
              >
                Original recipe / prompt ↗
              </a>
            )}
            <ol className="space-y-1">
              {steps.map((s, i) => (
                <li key={s.id}>
                  <StarFrame active={activeId === s.id || running === s.id}>
                    <div
                      draggable={!running}
                      role="group"
                      aria-label={`${s.label} step`}
                      onDragStart={() => setDragId(s.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dropOn(s.id)}
                      onClick={() => setActiveId(s.id)}
                      className={`group recipe-step cursor-pointer rounded-lg border p-3 transition hover:border-primary/60 ${activeId === s.id ? "border-primary bg-primary/10" : "bg-secondary/40"} ${running === s.id ? "ring-2 ring-accent animate-pulse" : ""} ${dragId === s.id ? "opacity-40" : ""}`}
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
                            Step {i + 1}
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
                            disabled={!!running || i === 0}
                            title="Move up"
                            size="icon"
                            aria-label="Move up"
                            onClick={(e) => {
                              e.stopPropagation();
                              move(s.id, -1);
                            }}
                            className="h-7 w-6 rounded px-1 hover:bg-muted"
                          >
                            <AnimatedIcon name="up" />
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={!!running || i === steps.length - 1}
                            title="Move down"
                            size="icon"
                            aria-label="Move down"
                            onClick={(e) => {
                              e.stopPropagation();
                              move(s.id, 1);
                            }}
                            className="h-7 w-6 rounded px-1 hover:bg-muted"
                          >
                            <AnimatedIcon name="down" />
                          </Button>
                          <HoldDelete
                            disabled={!!running}
                            onDelete={() => {
                              setSteps((x) => x.filter((y) => y.id !== s.id));
                              if (activeId === s.id) setActiveId(null);
                            }}
                          />
                        </div>
                      </div>
                      {activeId === s.id && (
                        <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                          <div>
                            <Label tip="A nickname for this block so you remember what it does.">
                              Name
                            </Label>
                            <input
                              className={inputCls}
                              value={s.label}
                              onChange={(e) => update(s.id, { label: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label tip="Tell this block what to do in plain words. {question} is replaced by what you type in the chat.">
                              Instructions
                            </Label>
                            <textarea
                              className={`${inputCls} h-20`}
                              value={s.instruction}
                              onChange={(e) => update(s.id, { instruction: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </StarFrame>
                  {i < steps.length - 1 && <div className="ml-6 h-3 w-px bg-primary/60" />}
                </li>
              ))}
            </ol>
            <div className="mt-4">
              <Label tip="Add a new block to the end of your recipe.">Add a step</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(KINDS) as StepKind[]).map((k) => (
                  <Button
                    variant="ghost"
                    key={k}
                    disabled={!!running}
                    onClick={() => {
                      const ns = mk(k);
                      setSteps((s) => [...s, ns]);
                      setActiveId(ns.id);
                      if (steps.length >= 1) complete("connect2");
                    }}
                    className="h-auto justify-start whitespace-normal rounded-lg border px-2 py-1.5 text-left text-xs transition hover:border-primary hover:bg-primary/10"
                  >
                    <AnimatedIcon name={k} /> {KINDS[k].title}
                  </Button>
                ))}
              </div>
            </div>
          </section>

          {/* PANEL B */}
          <section className="flex min-h-[600px] flex-col rounded-lg border bg-card/90">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="flex items-center font-bold">
                <AnimatedIcon name="chat" /> Live Run
                <Info tip="Type a question and watch your recipe work on it step by step." />
              </h2>
              <span className="text-xs text-success" role="status">
                {running ? "Running…" : "Idle"}
              </span>
            </div>
            {(running || logs.length > 0) && (
              <div className="border-b px-4 py-3">
                <RunThought
                  working={!!running}
                  label={`Working: ${steps.find((s) => s.id === running)?.label ?? "recipe"}`}
                />
              </div>
            )}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {msgs.length === 0 && (
                <div className="grid h-full place-items-center text-center text-muted-foreground">
                  <div>
                    <div className="mb-3 text-5xl">
                      <AnimatedIcon name="game" />
                    </div>
                    <p className="font-semibold">First run. First 50 XP.</p>
                    <p className="text-xs">Ready when you are.</p>
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={`animate-pop max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm ${m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-secondary"}`}
                >
                  {m.text}
                </div>
              ))}
            </div>
            <div className="border-t p-4">
              <div className="mb-3 rounded-lg border bg-background/50 p-3">
                <h3 className="mb-2 flex items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <AnimatedIcon name="inspect" /> Inspect Box
                  <Info tip="A plain-English diary of what the AI did at each step." />
                </h3>
                {logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Nothing yet — run the recipe to see each step.
                  </p>
                ) : (
                  <ol className="max-h-40 space-y-1 overflow-y-auto text-xs">
                    {logs.map((l, i) => {
                      const st = steps.find((s) => s.id === l.stepId);
                      return (
                        <li
                          key={i}
                          className={`animate-pop flex gap-2 ${l.ok ? "" : "text-destructive"}`}
                        >
                          <span>
                            <AnimatedIcon name={st?.kind ?? "warning"} />
                          </span>
                          <span>
                            <b>{st?.label}:</b> {l.text}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!running) run();
                }}
                className="flex items-center gap-2"
              >
                <input
                  className={inputCls}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question, e.g. Why is the sky blue?"
                />
                <Info tip="Your question — it gets dropped into the first step of the recipe." />
                <Button
                  disabled={!!running || steps.length === 0}
                  className={`${btn} hover:brightness-110`}
                >
                  <AnimatedIcon name="play" />{" "}
                  {running ? "Running…" : done.includes("first_run") ? "Run" : "Run · +50 XP"}
                </Button>
              </form>
            </div>
          </section>

          {/* PANEL C */}
          <section className="space-y-4">
            <div className="rounded-lg border bg-card/90 p-4">
              <h2 className="mb-3 flex items-center font-bold">
                <AnimatedIcon name="retriever" /> Concept Card
                <Info tip="Click any step to learn what it is and what experts call it." />
              </h2>
              {active ? (
                <div key={active.id} className="animate-pop space-y-3">
                  <div className="text-4xl">
                    <AnimatedIcon name={active.kind} />
                  </div>
                  <h3 className="text-lg font-extrabold">{KINDS[active.kind].title}</h3>
                  <p className="text-sm">{KINDS[active.kind].plain}</p>
                  <p className="rounded-lg bg-secondary/60 p-2 text-xs italic text-muted-foreground">
                    <AnimatedIcon name="idea" /> {KINDS[active.kind].analogy}
                  </p>
                  <div>
                    <Label tip="The official name programmers use for this piece.">
                      Under the hood
                    </Label>
                    <code className="rounded bg-primary/15 px-2 py-1 font-mono text-xs text-primary">
                      {KINDS[active.kind].techName}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <SquishToggle
                      label="Show Python code"
                      checked={showCode}
                      onChange={(on) => {
                        setShowCode(on);
                        if (on) complete("python");
                      }}
                    />
                    Show Python code
                    <Info tip="Peek at the real code that would build this step — just for curiosity." />
                  </div>
                  {showCode && (
                    <pre className="animate-pop overflow-x-auto rounded-lg border bg-background p-3 font-mono text-[11px] leading-relaxed text-success">
                      {KINDS[active.kind].code}
                    </pre>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a step in your recipe to learn about it.
                </p>
              )}
            </div>

            <div className="rounded-lg border bg-card/90 p-4">
              <h2 className="mb-2 flex items-center font-bold">
                <AnimatedIcon name="target" /> Milestones
                <Info tip="Little challenges that teach you the ropes and earn rewards." />
              </h2>
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{rank.name}</span>
                  <span>{next ? `${next.min - points} XP to ${next.name}` : "Max rank!"}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{
                      width: `${next ? Math.min(100, ((points - rank.min) / (next.min - rank.min)) * 100) : 100}%`,
                    }}
                  />
                </div>
              </div>
              <ul className="space-y-1.5 text-sm">
                {QUESTS.map((q) => {
                  const ok = done.includes(q.id);
                  return (
                    <li
                      key={q.id}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1 ${ok ? "bg-success/10" : ""}`}
                    >
                      <span>
                        <AnimatedIcon name={ok ? "check" : "circle"} />
                      </span>
                      <span className={`flex-1 ${ok ? "text-success" : ""}`}>
                        {ok && q.id === "konami" ? "Konami Master" : q.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">+{q.pts}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </main>

        {toast && (
          <div
            role="status"
            className="animate-pop fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-primary bg-card px-5 py-3 text-sm font-bold shadow-2xl"
          >
            <AnimatedIcon name="trophy" /> {toast}
          </div>
        )}

        <SettingsDrawer
          open={showSettings}
          onClose={() => setShowSettings(false)}
          motion={motion}
          setMotion={setMotion}
          settings={settings}
          setSettings={setSettings}
          onTested={() => complete("connect")}
        />
        <RecipeHub open={showHub} onClose={() => setShowHub(false)} onInstall={install} />
      </div>
    </Motion>
  );
}
