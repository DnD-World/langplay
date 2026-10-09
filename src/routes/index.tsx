import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LlmSettings, Recipe, RunResult } from "@/engine";
import type { LessonEvent } from "@/lib/lp-lessons";
import { LessonsCard } from "@/components/lp/play/LessonsCard";
import { MILESTONE_COUNT, QUESTS } from "@/lib/lp-data";
import { cloneRecipe, defaultRecipe } from "@/lib/lp-recipes";
import { SettingsDrawer } from "@/components/lp/SettingsDrawer";
import { RecipeHub } from "@/components/lp/RecipeHub";
import { AnimatedIcon } from "@/components/lp/AnimatedIcon";
import { Button } from "@/components/ui/button";
import { btn } from "@/components/lp/Info";
import { Motion } from "@/components/lp/Motion";
import "@/components/lp/Motion.css";
import { TopBar } from "@/components/lp/play/TopBar";
import { BuilderPanel } from "@/components/lp/play/BuilderPanel";
import { RunPanel } from "@/components/lp/play/RunPanel";
import { LearnPanel } from "@/components/lp/play/LearnPanel";
import { DocumentsDrawer } from "@/components/lp/play/DocumentsDrawer";
import { RecipeMenu } from "@/components/lp/play/RecipeMenu";
import { decodeRecipe, recipeCodeFromHash } from "@/engine";
import { saveRecipe } from "@/lib/lp-saved";
import { docSearch, loadDocs, type StoredDoc } from "@/lib/lp-docs";
import {
  DEFAULT_SETTINGS,
  STORAGE,
  loadRecipe,
  loadSettings,
  useGame,
  useRecipe,
  writeJson,
} from "@/components/lp/play/store";

const SpinOutDialog = lazy(() => import("@/components/lp/play/SpinOutDialog"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Langplay — Learn LangChain & LangGraph visually" },
      {
        name: "description",
        content:
          "A playful, no-code playground for beginners to build and run LangChain and LangGraph recipes with real AI, real tools, branches and loops.",
      },
      { property: "og:title", content: "Langplay — Learn LangChain & LangGraph visually" },
      {
        property: "og:description",
        content:
          "Build AI recipes with blocks, run them with free real AI, see every step, and spin them out as your own tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Playground,
});

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
  const { recipe, setRecipe, updateNode, addNode, removeNode, moveNode } = useRecipe(defaultRecipe);
  const [settings, setSettings] = useState<LlmSettings>(DEFAULT_SETTINGS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHub, setShowHub] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showSpin, setShowSpin] = useState(false);
  const [docs, setDocs] = useState<StoredDoc[]>([]);
  const searchDocs = useMemo(() => docSearch(docs), [docs]);
  const [motion, setMotion] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [ready, setReady] = useState(false);

  const showToast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  const { game, complete, completeLesson, toggleRetro } = useGame(showToast);
  const [lastRun, setLastRun] = useState<RunResult | undefined>(undefined);
  const [events, setEvents] = useState<Set<LessonEvent>>(new Set());
  const addEvent = useCallback(
    (e: LessonEvent) => setEvents((old) => (old.has(e) ? old : new Set([...old, e]))),
    [],
  );
  const lessonContext = useMemo(
    () => ({ recipe, run: lastRun, events }),
    [recipe, lastRun, events],
  );

  useEffect(() => {
    void loadDocs().then(setDocs);
    setSettings(loadSettings());
    try {
      setMotion(localStorage.getItem(STORAGE.motion) !== "off");
    } catch {
      /* storage may be blocked */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) writeJson(STORAGE.settings, settings);
  }, [settings, ready]);
  useEffect(() => {
    try {
      if (ready) localStorage.setItem(STORAGE.motion, motion ? "on" : "off");
    } catch {
      /* storage may be blocked */
    }
    document.documentElement.classList.toggle("motion-off", !motion);
    return () => document.documentElement.classList.remove("motion-off");
  }, [motion, ready]);

  // Open a recipe shared by link (#r=…), keeping the current one safe in My recipes.
  const linkHandled = useRef(false);
  useEffect(() => {
    const code = recipeCodeFromHash(location.hash);
    if (!code || linkHandled.current) return;
    linkHandled.current = true;
    history.replaceState(null, "", location.pathname + location.search);
    decodeRecipe(code)
      .then((shared) => {
        const current = loadRecipe(); // what was on screen before the link (saved by autosave)
        const untouched =
          JSON.stringify(current.nodes.map((n) => n.instruction)) ===
          JSON.stringify(defaultRecipe().nodes.map((n) => n.instruction));
        if (!untouched)
          try {
            saveRecipe({ ...current, title: `${current.title} (before opening a link)` });
          } catch {
            /* storage full: the shared recipe still opens */
          }
        setRecipe(shared);
        showToast(
          untouched
            ? `Opened "${shared.title}".`
            : `Opened "${shared.title}". Your previous recipe is in My recipes.`,
        );
      })
      .catch((e: unknown) =>
        showToast(e instanceof Error ? e.message : "Could not open that link"),
      );
  }, [setRecipe, showToast]);

  useEffect(() => {
    let i = 0;
    const onKey = (e: KeyboardEvent) => {
      i = e.key === KONAMI[i] ? i + 1 : e.key === KONAMI[0] ? 1 : 0;
      if (i === KONAMI.length) {
        i = 0;
        toggleRetro();
        complete("konami");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [complete, toggleRetro]);

  const install = (r: Recipe) => {
    const copy = cloneRecipe(r);
    setRecipe(copy);
    setActiveId(copy.nodes[0]?.id ?? null);
    complete("install");
  };

  const nextQuest = QUESTS.find((q) => q.id !== "konami" && !game.done.includes(q.id));
  const doneCount = game.done.filter((id) => id !== "konami").length;
  const active = recipe.nodes.find((n) => n.id === activeId) ?? null;

  return (
    <Motion enabled={motion}>
      <div className={`${game.retro ? "retro" : ""} min-h-screen text-foreground`}>
        <TopBar
          points={game.points}
          coins={game.coins}
          provider={settings.provider}
          onLibrary={() => setShowHub(true)}
          onSettings={() => setShowSettings(true)}
          extra={
            <Button
              variant="ghost"
              onClick={() => setShowSpin(true)}
              className={`${btn} spin-out-btn border border-primary/60 bg-card hover:border-primary`}
            >
              <AnimatedIcon name="spark" /> Spin out
            </Button>
          }
        />

        <div className="mission-band relative z-10 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <AnimatedIcon name="target" />
            <span className="font-bold">{nextQuest?.title ?? "Adventure complete"}</span>
            <span className="text-xs text-primary">
              {nextQuest ? `+${nextQuest.pts} XP` : "Keep experimenting"}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {doneCount} / {MILESTONE_COUNT} milestones
            </span>
          </div>
          <progress aria-label="Adventure progress" value={doneCount} max={MILESTONE_COUNT} />
        </div>

        <main className="langplay-workspace grid gap-4 p-4 lg:grid-cols-[minmax(270px,330px)_minmax(0,1fr)_minmax(250px,300px)]">
          <BuilderPanel
            recipe={recipe}
            activeId={activeId}
            runningId={runningId}
            busy={!!runningId}
            setActiveId={setActiveId}
            updateNode={updateNode}
            addNode={addNode}
            removeNode={removeNode}
            moveNode={moveNode}
            onTitle={(title) => setRecipe((r) => ({ ...r, title }))}
            setRecipe={setRecipe}
            onEdgeDrawn={() => addEvent("edge")}
            onMilestone={complete}
            onOpenDocs={() => setShowDocs(true)}
            docCount={docs.length}
            menu={
              <RecipeMenu
                recipe={recipe}
                setRecipe={(r) => {
                  setRecipe(r);
                  setActiveId(null);
                }}
                notify={showToast}
                onShared={() => {
                  complete("share");
                  addEvent("shared");
                }}
              />
            }
          />
          <RunPanel
            recipe={recipe}
            settings={settings}
            searchDocs={searchDocs}
            docCount={docs.length}
            onOpenDocs={() => setShowDocs(true)}
            onStep={(id) => {
              setRunningId(id);
              if (id) setActiveId(id);
            }}
            onMilestone={(id) => {
              complete(id);
              if (id === "compare") addEvent("compared");
            }}
            onResult={setLastRun}
            firstRunDone={game.done.includes("first_run")}
          />
          <LearnPanel
            active={active}
            showCode={showCode}
            setShowCode={(on) => {
              setShowCode(on);
              if (on) complete("python");
            }}
            points={game.points}
            done={game.done}
            lessons={
              <LessonsCard
                context={lessonContext}
                done={game.lessons}
                onComplete={completeLesson}
                onLoadStarter={(r) => {
                  setRecipe(r);
                  setActiveId(r.nodes[0]?.id ?? null);
                }}
              />
            }
          />
        </main>

        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className="animate-pop rounded-lg border border-primary bg-card px-5 py-3 text-sm font-bold shadow-2xl"
            >
              <AnimatedIcon name="trophy" /> {t.text}
            </div>
          ))}
        </div>

        <SettingsDrawer
          open={showSettings}
          onClose={() => setShowSettings(false)}
          motion={motion}
          setMotion={setMotion}
          settings={settings}
          setSettings={setSettings}
          onTested={() => complete("connect")}
        />
        {showSpin && (
          <Suspense fallback={null}>
            <SpinOutDialog
              open={showSpin}
              onClose={() => setShowSpin(false)}
              recipe={recipe}
              settings={settings}
              docs={docs.flatMap((d) => d.chunks)}
              onEvent={addEvent}
              setSpinout={(provider) => setRecipe((r) => ({ ...r, spinout: { provider } }))}
            />
          </Suspense>
        )}
        <DocumentsDrawer
          open={showDocs}
          onClose={() => setShowDocs(false)}
          docs={docs}
          setDocs={setDocs}
        />
        <RecipeHub open={showHub} onClose={() => setShowHub(false)} onInstall={install} />
      </div>
    </Motion>
  );
}
