export interface LlmSettings {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

declare global {
  interface Window { puter?: { ai: { chat: (p: string, o?: { model?: string }) => Promise<unknown> } } }
}

async function loadPuter() {
  if (window.puter) return window.puter;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://js.puter.com/v2/";
    s.onload = () => res();
    s.onerror = () => rej(new Error("Could not load Puter"));
    document.head.appendChild(s);
  });
  return window.puter!;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function simulate(messages: Msg[]): string {
  const last = messages[messages.length - 1]?.content ?? "";
  const sys = messages.find((m) => m.role === "system")?.content ?? "";
  const topic = last.replace(/\s+/g, " ").slice(0, 90);
  return `🤖 (simulated) Following "${sys.slice(0, 60)}" — here's my take on "${topic}": it's a bit like a recipe — gather the ingredients, follow the steps, and taste as you go. In short, the key idea is simple once broken into small pieces.`;
}

export async function chat(s: LlmSettings, messages: Msg[]): Promise<string> {
  if (s.provider === "simulator") {
    await sleep(500 + Math.random() * 500);
    return simulate(messages);
  }
  if (s.provider === "puter") {
    const p = await loadPuter();
    const prompt = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const r = (await p.ai.chat(prompt, { model: s.model })) as { message?: { content?: unknown } } | string;
    if (typeof r === "string") return r;
    const c = r?.message?.content;
    return typeof c === "string" ? c : JSON.stringify(c);
  }
  const url = s.baseUrl.replace(/\/$/, "") + (s.baseUrl.endsWith("/openai") ? "" : "/chat/completions");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (s.apiKey) headers.Authorization = `Bearer ${s.apiKey}`;
  else if (s.provider === "horde") headers.Authorization = "Bearer 0000000000";
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ model: s.model, messages }) });
  if (!res.ok) throw new Error(`The AI service replied with an error (${res.status}).`);
  const j = await res.json();
  return j?.choices?.[0]?.message?.content ?? "(empty answer)";
}
