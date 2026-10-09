import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LlmSettings, Recipe } from "@/engine";
import { MILESTONE_COUNT, QUESTS } from "@/lib/lp-data";
import { cloneRecipe, defaultRecipe } from "@/lib/lp-recipes";
import { SettingsDrawer } from "@/components/lp/SettingsDrawer";
import { RecipeHub } from "@/components/lp/RecipeHub";
import { AnimatedIcon } from "@/components/lp/AnimatedIcon";
import { Motion } from "@/components/lp/Motion";
import "@/components/lp/Motion.css";
import { TopBar } from "@/components/lp/play/TopBar";
import { BuilderPanel } from "@/components/lp/play/BuilderPanel";
import { RunPanel } from "@/components/lp/play/RunPanel";
import { LearnPanel } from "@/components/lp/play/LearnPanel";
import {
  DEFAULT_SETTINGS,
  STORAGE,
  loadSettings,
  useGame,
  useRecipe,
  writeJson,
} from "@/components/lp/play/store";

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
  const [motion, setMotion] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const loaded = useRef(false);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);
  const { game, complete, toggleRetro } = useGame(showToast);

  useEffect(() => {
    setSettings(loadSettings());
    try {
      setMotion(localStorage.getItem(STORAGE.motion) !== "off");
    } catch {
      /* storage may be blocked */
    }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) writeJson(STORAGE.settings, settings);
  }, [settings]);
  useEffect(() => {
    try {
      if (loaded.current) localStorage.setItem(STORAGE.motion, motion ? "on" : "off");
    } catch {
      /* storage may be blocked */
    }
    document.documentElement.classList.toggle("motion-off", !motion);
    return () => document.documentElement.classList.remove("motion-off");
  }, [motion]);

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
            onMilestone={complete}
          />
          <RunPanel
            recipe={recipe}
            settings={settings}
            onStep={(id) => {
              setRunningId(id);
              if (id) setActiveId(id);
            }}
            onMilestone={complete}
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
          />
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
