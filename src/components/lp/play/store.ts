import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeNode,
  normalizeRecipe,
  type LlmSettings,
  type NodeKind,
  type NodePatch,
  type Recipe,
  type RecipeNode,
} from "@/engine";
import { QUESTS } from "@/lib/lp-data";
import { defaultRecipe } from "@/lib/lp-recipes";
import { LESSONS } from "@/lib/lp-lessons";

// Browser-only persistence. Every read is defensive: storage can be blocked, full or edited by hand.

export const STORAGE = {
  settings: "lp-settings",
  game: "lp-game",
  motion: "lp-motion",
  recipe: "lp-recipe",
} as const;

export function readJson<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") as T | null;
  } catch {
    return null;
  }
}
export function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be blocked or full; the app keeps working in memory */
  }
}

export const DEFAULT_SETTINGS: LlmSettings = {
  provider: "pollinations",
  baseUrl: "https://text.pollinations.ai/openai",
  apiKey: "",
  model: "openai",
};

export function loadSettings(): LlmSettings {
  const s = readJson<Partial<LlmSettings>>(STORAGE.settings);
  if (
    s &&
    typeof s.provider === "string" &&
    typeof s.baseUrl === "string" &&
    typeof s.apiKey === "string" &&
    typeof s.model === "string"
  ) {
    const clean: LlmSettings = {
      provider: s.provider,
      baseUrl: s.baseUrl,
      apiKey: s.apiKey,
      model: s.model,
      modelFreeVerified: false,
    };
    if (s.freeOnly) clean.freeOnly = true;
    if (s.freeAllowance) clean.freeAllowance = true;
    if (s.pricing && Number.isFinite(s.pricing.prompt) && Number.isFinite(s.pricing.completion))
      clean.pricing = s.pricing;
    return clean;
  }
  return DEFAULT_SETTINGS;
}

export function loadRecipe(): Recipe {
  const saved = readJson<unknown>(STORAGE.recipe);
  if (saved) {
    try {
      return normalizeRecipe(saved);
    } catch {
      /* fall through to the starter recipe */
    }
  }
  return defaultRecipe();
}

/** Recipe editing helpers that keep step references valid. */
export function useRecipe(initial: () => Recipe) {
  const [recipe, setRecipe] = useState<Recipe>(initial);
  // Saving starts only after the stored recipe is on screen, so loading never overwrites it.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setRecipe(loadRecipe());
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) writeJson(STORAGE.recipe, recipe);
  }, [recipe, ready]);

  const updateNode = useCallback(
    (id: string, patch: NodePatch) =>
      setRecipe((r) => ({
        ...r,
        nodes: r.nodes.map((n) => {
          if (n.id !== id) return n;
          const next = { ...n, ...patch } as Record<string, unknown>;
          for (const key of Object.keys(patch)) if (next[key] === undefined) delete next[key];
          return next as unknown as RecipeNode;
        }),
      })),
    [],
  );

  const addNode = useCallback((kind: NodeKind) => {
    const node = makeNode(kind);
    setRecipe((r) => ({ ...r, nodes: [...r.nodes, node] }));
    return node;
  }, []);

  const removeNode = useCallback(
    (id: string) =>
      setRecipe((r) => ({
        ...r,
        nodes: r.nodes
          .filter((n) => n.id !== id)
          .map((n) => {
            const copy: RecipeNode = { ...n };
            if (copy.next === id) delete copy.next;
            if (copy.retryTo === id) delete copy.retryTo;
            if (copy.routes)
              copy.routes = copy.routes.map((route) => {
                if (route.to !== id) return route;
                return { label: route.label };
              });
            return copy;
          }),
      })),
    [],
  );

  const moveNode = useCallback(
    (fromId: string, toIndex: number) =>
      setRecipe((r) => {
        const from = r.nodes.findIndex((n) => n.id === fromId);
        if (from < 0 || toIndex < 0 || toIndex >= r.nodes.length || from === toIndex) return r;
        const nodes = [...r.nodes];
        const [item] = nodes.splice(from, 1);
        if (!item) return r;
        nodes.splice(toIndex, 0, item);
        return { ...r, nodes };
      }),
    [],
  );

  return { recipe, setRecipe, updateNode, addNode, removeNode, moveNode };
}

export interface GameState {
  done: string[];
  lessons: string[];
  points: number;
  coins: number;
  retro: boolean;
}

/** XP, coins and milestones. Rewards are deduplicated with an immediate set so a double click never pays twice. */
export function useGame(onReward: (text: string) => void) {
  const [game, setGame] = useState<GameState>({
    done: [],
    lessons: [],
    points: 0,
    coins: 0,
    retro: false,
  });
  const completed = useRef(new Set<string>());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const g = readJson<Partial<GameState>>(STORAGE.game);
    if (g && Array.isArray(g.done) && Number.isFinite(g.points) && Number.isFinite(g.coins)) {
      const valid = g.done.filter(
        (id): id is string => typeof id === "string" && QUESTS.some((q) => q.id === id),
      );
      completed.current = new Set(valid);
      setGame({
        done: valid,
        lessons: Array.isArray(g.lessons)
          ? g.lessons.filter(
              (id): id is string => typeof id === "string" && LESSONS.some((l) => l.id === id),
            )
          : [],
        points: Math.max(0, g.points as number),
        coins: Math.max(0, g.coins as number),
        retro: !!g.retro,
      });
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) writeJson(STORAGE.game, game);
  }, [game, ready]);

  const complete = useCallback(
    (id: string) => {
      const quest = QUESTS.find((q) => q.id === id);
      if (!quest || completed.current.has(id)) return;
      completed.current.add(id);
      setGame((g) => ({
        ...g,
        done: [...completed.current],
        points: g.points + quest.pts,
        coins: g.coins + quest.coins,
      }));
      onReward(
        `${quest.id === "konami" ? "Konami Master" : quest.title} · +${quest.pts} XP · +${quest.coins} coins`,
      );
    },
    [onReward],
  );
  const lessonsDone = useRef(new Set<string>());
  useEffect(() => {
    lessonsDone.current = new Set(game.lessons);
  }, [game.lessons]);
  const completeLesson = useCallback(
    (id: string) => {
      const lesson = LESSONS.find((l) => l.id === id);
      if (!lesson || lessonsDone.current.has(id)) return;
      lessonsDone.current.add(id);
      setGame((g) => ({
        ...g,
        lessons: [...new Set([...g.lessons, id])],
        points: g.points + lesson.xp,
        coins: g.coins + Math.round(lesson.xp / 10),
      }));
      onReward(`Lesson complete: ${lesson.title} · +${lesson.xp} XP`);
    },
    [onReward],
  );
  const toggleRetro = useCallback(() => setGame((g) => ({ ...g, retro: !g.retro })), []);
  return { game, complete, completeLesson, toggleRetro };
}
