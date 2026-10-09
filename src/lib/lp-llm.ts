export interface LlmSettings {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  freeOnly?: boolean;
  freeAllowance?: boolean;
  modelFreeVerified?: boolean;
}

type Msg = { role: "system" | "user" | "assistant"; content: string };
let puterLoading: Promise<void> | null = null;

declare global {
  interface Window {
    puter?: { ai: { chat: (p: string, o?: { model?: string }) => Promise<unknown> } };
  }
}

async function loadPuter() {
  if (window.puter) return window.puter;
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
  if (!window.puter) throw new Error("Puter did not finish loading.");
  return window.puter;
}

/** AI Horde models change as volunteers come and go, so pick a live one instead of a fixed name. */
async function pickHordeModel(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function simulate(messages: Msg[]): string {
  const last = messages[messages.length - 1]?.content ?? "";
  const sys = messages.find((m) => m.role === "system")?.content ?? "";
  const topic = last.replace(/\s+/g, " ").slice(0, 90);
  return `(simulated) Following "${sys.slice(0, 60)}" — here's my take on "${topic}": it's a bit like a recipe — gather the ingredients, follow the steps, and taste as you go. In short, the key idea is simple once broken into small pieces.`;
}

export async function chat(s: LlmSettings, messages: Msg[]): Promise<string> {
  if (
    s.freeOnly &&
    !s.modelFreeVerified &&
    !["simulator", "ollama", "lmstudio", "horde"].includes(s.provider)
  ) {
    throw new Error("Choose a qualifying model from the free-only list before running.");
  }
  if (s.provider === "simulator") {
    await sleep(500 + Math.random() * 500);
    return simulate(messages);
  }
  if (s.provider === "puter") {
    const p = await loadPuter();
    const prompt = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const r = (await p.ai.chat(prompt, { model: s.model })) as
      { message?: { content?: unknown } } | string;
    if (typeof r === "string") return r;
    const c = r?.message?.content;
    if (typeof c !== "string" || !c.trim()) throw new Error("Puter returned no readable answer.");
    return c;
  }
  const url =
    s.baseUrl.replace(/\/$/, "") + (s.baseUrl.endsWith("/openai") ? "" : "/chat/completions");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (s.apiKey) headers["Authorization"] = `Bearer ${s.apiKey}`;
  else if (s.provider === "horde") headers["Authorization"] = "Bearer 0000000000";
  const endpoint = new URL(url);
  if (
    endpoint.protocol !== "https:" &&
    !(
      endpoint.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
    )
  )
    throw new Error("Use HTTPS, or a local service on your own computer.");
  let model = s.model;
  if (s.provider === "horde" && (!model || model === "auto"))
    model = await pickHordeModel(s.baseUrl);
  const res = await fetch(url, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ model, messages }),
  });
  if (!res.ok)
    throw new Error(`The AI service replied (${res.status}): ${(await res.text()).slice(0, 400)}`);
  const j = await res.json();
  const content = j?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw new Error(
      "The AI service returned no readable answer. Check its model and connection settings.",
    );
  return content;
}
