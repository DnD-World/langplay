import { chunkPages, searchChunks, textToPages, type DocChunk } from "../engine/docs";
import { chainChats, createChat, fallbackFor, OVH_FREE } from "../engine/llm";
import { runRecipe } from "../engine/run";
import { simulatorChat } from "../engine/simulator";
import type { LlmSettings, Recipe, RunResult } from "../engine/types";
import { RUNNER_CSS } from "./styles";

// A spun-out recipe as its own little app: question in, answer out, with the steps visible.
// Plain DOM, no framework, and every piece of model output is inserted as text (never HTML).

export interface RunnerOptions {
  recipe: Recipe;
  embed?: boolean;
  /** Link back to Langplay with this recipe, shown as "Remix". */
  remixUrl?: string;
  /** Turns a PDF into page texts; the tool page passes one, single HTML files read text only. */
  readPdf?: (file: File) => Promise<string[]>;
  /** Passages bundled into an exported HTML file. */
  docs?: DocChunk[];
}

type Choice = "free" | "ovh" | "simulator" | "own";
const KIND_ICON: Record<string, string> = {
  input: "✏️",
  agent: "🧠",
  tool: "🔎",
  retriever: "📚",
  router: "🔀",
  critic: "🧐",
  final: "🏁",
};
const POLLINATIONS: LlmSettings = {
  provider: "pollinations",
  baseUrl: "https://text.pollinations.ai/openai",
  apiKey: "",
  model: "openai",
};
const SIMULATOR: LlmSettings = { provider: "simulator", baseUrl: "", apiKey: "", model: "sim-1" };

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string | null | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function storage<T>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...(JSON.parse(localStorage.getItem(key) || "null") ?? {}) } as T;
  } catch {
    return fallback;
  }
}

export function mountRunner(root: HTMLElement, options: RunnerOptions) {
  const { recipe } = options;
  if (!document.getElementById("lpr-style")) {
    const style = el("style", { id: "lpr-style" });
    style.textContent = RUNNER_CSS;
    document.head.append(style);
  }
  const defaultChoice: Choice =
    recipe.spinout?.provider === "simulator"
      ? "simulator"
      : recipe.spinout?.provider === "ovh"
        ? "ovh"
        : recipe.spinout?.provider === "visitor"
          ? "own"
          : "free";
  const prefsKey = "lp-tool-ai";
  const prefs = storage(prefsKey, {
    choice: defaultChoice as Choice,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  let docs: DocChunk[] = options.docs ?? [];

  const settingsFor = (): { chat: ReturnType<typeof createChat>; settings: LlmSettings } => {
    if (prefs.choice === "simulator") return { chat: simulatorChat, settings: SIMULATOR };
    if (prefs.choice === "ovh") return { chat: createChat(OVH_FREE), settings: OVH_FREE };
    if (prefs.choice === "own" && prefs.apiKey) {
      const own: LlmSettings = {
        provider: "custom",
        baseUrl: prefs.baseUrl,
        apiKey: prefs.apiKey,
        model: prefs.model,
      };
      return { chat: createChat(own), settings: own };
    }
    return { chat: createChat(POLLINATIONS), settings: POLLINATIONS };
  };

  root.replaceChildren();
  const wrap = el("div", { class: `lpr${options.embed ? " is-embed" : ""}` });
  wrap.append(el("div", { class: "lpr-bg", "aria-hidden": "true" }, el("i"), el("i"), el("i")));
  const card = el("main", { class: "lpr-card" });
  const gear = el(
    "button",
    { class: "lpr-gear", type: "button", "aria-label": "AI settings", title: "AI settings" },
    "⚙",
  );
  card.append(
    el(
      "div",
      { class: "lpr-head" },
      el(
        "div",
        {},
        el("h1", { class: "lpr-title" }, recipe.title),
        el("p", { class: "lpr-sum" }, recipe.summary),
      ),
      gear,
    ),
  );

  // Settings panel: which AI answers, and the visitor's own key if they want one.
  const panel = el("div", { class: "lpr-panel", hidden: "" });
  const choiceSelect = el("select", { "aria-label": "AI service" });
  for (const [value, label] of [
    ["free", "Free (Pollinations, then OVH, then practice mode)"],
    ["ovh", "OVHcloud free tier (about 2 requests a minute)"],
    ["simulator", "Practice mode (offline, not a real AI)"],
    ["own", "My own key (any OpenAI-compatible service)"],
  ] as const) {
    const o = el("option", { value }, label);
    if (prefs.choice === value) o.selected = true;
    choiceSelect.append(o);
  }
  const own = el("div", { style: "display:grid;gap:8px" });
  const field = (label: string, key: "baseUrl" | "apiKey" | "model", type = "text") => {
    const input = el("input", { type, value: prefs[key], autocomplete: "off" });
    input.addEventListener("input", () => {
      prefs[key] = input.value.trim();
      save();
    });
    return el("label", {}, label, input);
  };
  own.append(
    field("Service URL", "baseUrl"),
    field("API key (stays in this browser)", "apiKey", "password"),
    field("Model", "model"),
  );
  const save = () => {
    try {
      localStorage.setItem(prefsKey, JSON.stringify(prefs));
    } catch {
      /* storage blocked: settings last for this visit */
    }
  };
  const syncOwn = () => (own.hidden = prefs.choice !== "own");
  choiceSelect.addEventListener("change", () => {
    prefs.choice = choiceSelect.value as Choice;
    save();
    syncOwn();
  });
  syncOwn();
  panel.append(
    el("label", {}, "Who answers", choiceSelect),
    own,
    el(
      "p",
      { class: "lpr-note" },
      "Questions are sent to the AI service you choose. Free services have small limits.",
    ),
  );
  gear.addEventListener("click", () => (panel.hidden = !panel.hidden));
  card.append(panel);

  // Documents, when the recipe looks things up in them.
  const usesDocs = recipe.nodes.some((n) => n.kind === "retriever");
  const docStatus = el("span", { class: "lpr-meta" });
  const showDocStatus = () =>
    (docStatus.textContent = docs.length
      ? `${new Set(docs.map((d) => d.doc)).size} document(s) ready · ${docs.length} passages`
      : "No document yet — answers will use practice notes.");
  if (usesDocs) {
    const file = el("input", {
      type: "file",
      accept: options.readPdf
        ? ".pdf,.txt,.md,.csv,text/*,application/pdf"
        : ".txt,.md,.csv,text/*",
      "aria-label": "Add a document",
    });
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        const isPdf = /\.pdf$/i.test(f.name);
        if (isPdf && !options.readPdf)
          throw new Error("This tool reads text files (.txt, .md) only.");
        const pages =
          isPdf && options.readPdf ? await options.readPdf(f) : textToPages(await f.text());
        docs = [...docs.filter((d) => d.doc !== f.name), ...chunkPages(f.name, pages)];
        showDocStatus();
      } catch (e) {
        docStatus.textContent = e instanceof Error ? e.message : "Could not read that file.";
      }
    });
    showDocStatus();
    card.append(
      el(
        "div",
        { class: "lpr-panel" },
        el("label", {}, "Your document (read in this browser only)", file),
        docStatus,
      ),
    );
  }

  const question = el("textarea", {
    "aria-label": "Your question",
    placeholder: "Type your question…",
    maxlength: "4000",
  });
  const runBtn = el("button", { class: "lpr-btn", type: "button" }, "Run ▶");
  const stopBtn = el("button", { class: "lpr-btn ghost", type: "button", hidden: "" }, "Stop");
  card.append(question, el("div", { class: "lpr-row" }, runBtn, stopBtn));
  const stepsList = el("ol", { class: "lpr-steps", "aria-label": "Steps" });
  const out = el("div", { "aria-live": "polite" });
  card.append(stepsList, out);
  wrap.append(card);

  const foot = el("footer", { class: "lpr-foot" });
  const made = el("span", {}, "Made with ");
  made.append(
    el(
      "a",
      { href: "https://langplay.lovable.app", target: "_blank", rel: "noreferrer" },
      "Langplay",
    ),
  );
  foot.append(made);
  if (options.remixUrl)
    foot.append(
      el(
        "a",
        { href: options.remixUrl, target: "_blank", rel: "noreferrer" },
        "Open in Langplay & remix ↗",
      ),
    );
  wrap.append(foot);
  root.append(wrap);

  let controller: AbortController | null = null;
  const run = async () => {
    const q = question.value.trim();
    if (!q || controller) return;
    controller = new AbortController();
    runBtn.disabled = true;
    stopBtn.hidden = false;
    out.replaceChildren();
    stepsList.replaceChildren();
    const chips = new Map<string, HTMLElement>();
    const { chat, settings } = settingsFor();
    const started = Date.now();
    try {
      const result: RunResult = await runRecipe(
        recipe,
        q,
        {
          chat,
          fallbackChat:
            prefs.choice === "own"
              ? simulatorChat
              : prefs.choice === "free"
                ? fallbackFor(POLLINATIONS)
                : chainChats(simulatorChat),
          simulated: settings.provider === "simulator",
          searchDocs: docs.length ? (query, k) => searchChunks(docs, query, k) : undefined,
          signal: controller.signal,
        },
        (event) => {
          if (event.type === "step-start") {
            const node = recipe.nodes.find((n) => n.id === event.nodeId);
            const chip = el(
              "li",
              { class: "lpr-step is-on" },
              `${KIND_ICON[node?.kind ?? "agent"] ?? "•"} ${node?.label ?? "Step"}`,
            );
            chips.set(`${event.index}`, chip);
            stepsList.append(chip);
          } else if (event.type === "step") {
            const chip = chips.get(`${event.trace.index}`);
            if (chip) chip.className = "lpr-step is-done";
          }
        },
      );
      const total = result.usage.prompt + result.usage.completion;
      const details = el("details", {}, el("summary", {}, "How it worked"));
      for (const s of result.steps) {
        details.append(
          el(
            "p",
            {},
            el("b", {}, `${s.label}`),
            s.decision ? ` — ${s.decision}` : "",
            s.note ? ` (${s.note})` : "",
          ),
        );
        if (s.input && s.kind === "tool") details.append(el("pre", {}, `input: ${s.input}`));
        details.append(el("pre", {}, s.output.slice(0, 3000)));
        for (const src of s.sources ?? [])
          details.append(
            src.url
              ? el(
                  "p",
                  { class: "lpr-meta" },
                  el("a", { href: src.url, target: "_blank", rel: "noreferrer" }, `${src.title} ↗`),
                )
              : el("p", { class: "lpr-meta" }, src.title),
          );
      }
      out.append(
        el("div", { class: "lpr-answer" }, result.answer),
        el(
          "p",
          { class: "lpr-meta" },
          `${((Date.now() - started) / 1000).toFixed(1)}s · ${total}${result.usage.estimated ? "≈" : ""} tokens${result.fallbacks ? ` · ${result.fallbacks} step(s) used a backup` : ""}`,
        ),
        details,
      );
    } catch (e) {
      out.append(
        el(
          "p",
          { class: "lpr-err", role: "alert" },
          `Could not finish: ${e instanceof Error ? e.message : "unknown error"}`,
        ),
      );
    } finally {
      controller = null;
      runBtn.disabled = false;
      stopBtn.hidden = true;
    }
  };
  runBtn.addEventListener("click", () => void run());
  stopBtn.addEventListener("click", () => controller?.abort());
  question.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void run();
  });
  return { destroy: () => root.replaceChildren() };
}
