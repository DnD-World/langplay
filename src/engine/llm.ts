import { simulatorChat } from "./simulator";
import type { ChatFn, ChatResult, LlmSettings, Msg } from "./types";

// Talks to AI services. Any OpenAI-compatible endpoint works; Puter is browser-only;
// the Simulator works everywhere with no network.

export const KEYLESS_FREE = [
  "simulator",
  "offline",
  "ollama",
  "lmstudio",
  "horde",
  "pollinations",
  "ovh",
];
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

export function endpointFor(baseUrl: string, path: "/chat/completions" | "/models"): URL {
  const base = baseUrl.trim().replace(/\/$/, "");
  // Pollinations serves chat at /openai itself.
  const url = new URL(
    path === "/chat/completions" && base.endsWith("/openai") ? base : base + path,
  );
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname))
  )
    throw new Error("Use HTTPS, or a local service on your own computer.");
  return url;
}

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("Run stopped."));
      },
      { once: true },
    );
  });
}

const estimate = (text: string) => Math.max(1, Math.round(text.length / 4));

/** AI Horde models change as volunteers come and go, so pick a live one instead of a fixed name. */
async function pickHordeModel(baseUrl: string): Promise<string> {
  const response = await fetch(endpointFor(baseUrl, "/models"), {
    signal: AbortSignal.timeout(15000),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`AI Horde model list failed (${response.status}).`);
  const body = await response.json();
  const id = Array.isArray(body?.data)
    ? body.data.find((m: { id?: unknown } | null) => typeof m?.id === "string")?.id
    : undefined;
  if (!id) throw new Error("No AI Horde volunteers are online right now. Try another provider.");
  return id;
}

type PuterWindow = {
  puter?: { ai: { chat: (p: string, o?: { model?: string }) => Promise<unknown> } };
};
let puterLoading: Promise<void> | null = null;
async function loadPuter() {
  if (typeof document === "undefined") throw new Error("Puter only works inside a web browser.");
  const w = window as unknown as PuterWindow;
  if (w.puter) return w.puter;
  if (!puterLoading)
    puterLoading = new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://js.puter.com/v2/";
      const timeout = window.setTimeout(() => {
        s.remove();
        puterLoading = null;
        rej(new Error("Puter took too long to load. Try again."));
      }, 20000);
      s.onload = () => {
        clearTimeout(timeout);
        res();
      };
      s.onerror = () => {
        clearTimeout(timeout);
        puterLoading = null;
        rej(new Error("Could not load Puter"));
      };
      document.head.appendChild(s);
    });
  await puterLoading;
  if (!w.puter) throw new Error("Puter did not finish loading.");
  return w.puter;
}

export function createChat(s: LlmSettings): ChatFn {
  if (s.provider === "simulator") return simulatorChat;
  return async (messages: Msg[], signal?: AbortSignal): Promise<ChatResult> => {
    if (s.freeOnly && !s.modelFreeVerified && !KEYLESS_FREE.includes(s.provider))
      throw new Error("Choose a qualifying model from the free-only list before running.");
    const promptText = messages.map((m) => m.content).join("\n");
    if (s.provider === "puter") {
      const p = await loadPuter();
      const prompt = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
      const r = (await p.ai.chat(prompt, { model: s.model })) as
        { message?: { content?: unknown } } | string;
      const text = typeof r === "string" ? r : r?.message?.content;
      if (typeof text !== "string" || !text.trim())
        throw new Error("Puter returned no readable answer.");
      return {
        text,
        usage: { prompt: estimate(promptText), completion: estimate(text), estimated: true },
        provider: s.provider,
        model: s.model,
      };
    }
    const url = endpointFor(s.baseUrl, "/chat/completions");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (s.apiKey) headers["Authorization"] = `Bearer ${s.apiKey}`;
    else if (s.provider === "horde") headers["Authorization"] = "Bearer 0000000000";
    let model = s.model;
    if (s.provider === "horde" && (!model || model === "auto"))
      model = await pickHordeModel(s.baseUrl);
    const body = JSON.stringify({ model, messages });
    let res: Response | undefined;
    // Free tiers rate-limit bursts; wait politely (Retry-After, capped) and try twice more.
    for (let attempt = 0; attempt < 3; attempt++) {
      const timeout = AbortSignal.timeout(60000);
      res = await fetch(url, {
        method: "POST",
        headers,
        credentials: "omit",
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        body,
      });
      if ((res.status !== 429 && res.status !== 503) || attempt === 2) break;
      const after = Number(res.headers.get("retry-after"));
      await wait(
        Number.isFinite(after) && after > 0 ? Math.min(after, 8) * 1000 : 2500 * (attempt + 1),
        signal,
      );
    }
    if (!res) throw new Error("The AI service did not respond.");
    if (!res.ok)
      throw new Error(
        `The AI service replied (${res.status}): ${(await res.text()).slice(0, 300)}`,
      );
    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim())
      throw new Error(
        "The AI service returned no readable answer. Check its model and connection settings.",
      );
    const u = j?.usage;
    const reported =
      u && Number.isFinite(u.prompt_tokens) && Number.isFinite(u.completion_tokens)
        ? { prompt: u.prompt_tokens as number, completion: u.completion_tokens as number }
        : null;
    return {
      text: text.trim(),
      usage: reported
        ? { ...reported, estimated: false }
        : { prompt: estimate(promptText), completion: estimate(text), estimated: true },
      provider: s.provider,
      model: typeof j?.model === "string" ? j.model : model,
    };
  };
}

export const OVH_FREE: LlmSettings = {
  provider: "ovh",
  baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
  apiKey: "",
  model: "Mistral-Small-3.2-24B-Instruct-2506",
};

/** Tries each chat in order; the error of the last one is raised if all fail. */
export function chainChats(...chats: ChatFn[]): ChatFn {
  return async (messages, signal) => {
    let lastError: unknown;
    for (const c of chats) {
      try {
        return await c(messages, signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error;
      }
    }
    throw lastError;
  };
}

/**
 * What to use when the chosen service fails. A free keyless service may fall back to another
 * free keyless service; anything else falls back only to the offline Simulator, so a question
 * never goes to a company the user did not choose.
 */
export function fallbackFor(s: LlmSettings): ChatFn {
  return s.provider === "pollinations"
    ? chainChats(createChat(OVH_FREE), simulatorChat)
    : simulatorChat;
}

/** Simple string-returning helper used by "Test connection". */
export async function chat(s: LlmSettings, messages: Msg[]): Promise<string> {
  return (await createChat(s)(messages)).text;
}
