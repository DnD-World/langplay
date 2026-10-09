import { PROVIDERS } from "./lp-data";
import type { LlmSettings } from "@/engine";
export type ModelOption = { id: string; free: boolean; evidence: string };
const tierProviders = new Set([
  "cerebras",
  "groq",
  "mistral",
  "cohere",
  "nvidia",
  "sealion",
  "ollama-cloud",
  "gemini",
]);
const meganovaFree = new Set([
  "meganova-ai/manta-mini-1.0",
  "meganova-ai/manta-flash-1.0",
  "meganova-ai/manta-pro-1.0",
  "zai-org/GLM-4.7-Flash",
  "deepseek-ai/DeepSeek-V3-0324-Free",
  "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
]);
export const MODEL_POLICY: Record<string, { note: string; url: string }> = {
  gemini: {
    note: "A free AI Studio key has a daily free allowance per Google project; limits reset at midnight Pacific time. Billing-enabled projects are charged.",
    url: "https://ai.google.dev/gemini-api/docs/rate-limits",
  },
  pollinations: {
    note: "No key needed, but only a few free requests per visitor before it asks for payment (checked 9 Oct 2026). Langplay then tries OVH, then the Simulator.",
    url: "https://pollinations.ai/",
  },
  ovh: {
    note: "No key needed; the free tier allows about 2 requests per minute (checked 9 Oct 2026).",
    url: "https://endpoints.ai.cloud.ovh.net/",
  },
  openrouter: {
    note: "Free suffix or zero input AND output prices. Free usage still has daily limits.",
    url: "https://openrouter.ai/collections/free-models",
  },
  cerebras: {
    note: "Limited free account tier. A model name alone cannot prove your account has free usage.",
    url: "https://inference-docs.cerebras.ai/models/overview",
  },
  groq: {
    note: "Limited free account tier; paid accounts may be billed for the same model.",
    url: "https://console.groq.com/docs/rate-limits",
  },
  nvidia: {
    note: "Trial credits, not permanently free models. Only include while you have unused trial credits.",
    url: "https://build.nvidia.com/",
  },
  mistral: {
    note: "Experiment/free account allowance, not zero-priced models on every plan.",
    url: "https://mistral.ai/pricing",
  },
  cohere: {
    note: "Evaluation trial key only; production keys are paid. Trial usage is limited.",
    url: "https://docs.cohere.com/docs/rate-limits",
  },
  "ollama-cloud": {
    note: "Cloud allowance depends on your plan and current usage; verify in your account.",
    url: "https://ollama.com/pricing",
  },
  sealion: {
    note: "Limited proof-of-concept API access, not an unlimited production service.",
    url: "https://docs.sea-lion.ai/overview/readme/faq",
  },
  meganova: {
    note: "Documented free-quota allowlist; daily allowance and eligibility depend on account tier.",
    url: "https://docs.meganova.ai/free-model-quota",
  },
  puter: {
    note: "User-pays service; only explicit :free variants qualify. No API key does not mean free.",
    url: "https://docs.puter.com/AI/listModels/",
  },
};
export function classifyModel(
  provider: string,
  id: string,
  allowance: boolean,
  pricing?: { prompt?: string | number; completion?: string | number },
): ModelOption {
  if (["pollinations", "ovh"].includes(provider))
    return { id, free: true, evidence: "Free tier · very limited" };
  if (["simulator", "ollama", "lmstudio", "horde"].includes(provider))
    return {
      id,
      free: true,
      evidence: provider === "simulator" ? "Offline practice" : "No hosted model fee",
    };
  if (provider === "openrouter") {
    const free =
      id.endsWith(":free") ||
      id === "openrouter/free" ||
      (!!pricing &&
        pricing.prompt !== undefined &&
        pricing.completion !== undefined &&
        Number(pricing.prompt) === 0 &&
        Number(pricing.completion) === 0);
    return {
      id,
      free,
      evidence: free ? "Zero-price model · limited usage" : "Paid / price unverified",
    };
  }
  if (provider === "puter")
    return {
      id,
      free: id.endsWith(":free"),
      evidence: id.endsWith(":free") ? "Explicit free variant" : "User-pays / unverified",
    };
  if (provider === "meganova")
    return {
      id,
      free: allowance && meganovaFree.has(id),
      evidence: meganovaFree.has(id) ? "Daily quota · account required" : "Paid / unverified",
    };
  if (tierProviders.has(provider))
    return {
      id,
      free: allowance,
      evidence: allowance ? "Your confirmed free/trial allowance" : "Account allowance unconfirmed",
    };
  return { id, free: false, evidence: "Price unverified; excluded from free-only" };
}
export function presetModels(s: LlmSettings): ModelOption[] {
  return (PROVIDERS.find((p) => p.id === s.provider)?.models ?? []).map((id) =>
    classifyModel(s.provider, id, !!s.freeAllowance),
  );
}
export async function fetchModels(s: LlmSettings): Promise<ModelOption[]> {
  if (["simulator", "puter"].includes(s.provider)) return presetModels(s);
  const headers: Record<string, string> = {};
  if (s.apiKey && s.provider !== "openrouter") headers["Authorization"] = `Bearer ${s.apiKey}`;
  const endpoint = new URL(`${s.baseUrl.replace(/\/$/, "")}/models`);
  if (
    endpoint.protocol !== "https:" &&
    !(
      endpoint.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
    )
  )
    throw new Error("Use HTTPS, or a local service on your own computer.");
  const response = await fetch(endpoint, {
    headers,
    signal: AbortSignal.timeout(15000),
    credentials: "omit",
  });
  if (!response.ok)
    throw new Error(
      `Model list failed (${response.status}): ${(await response.text()).slice(0, 250)}`,
    );
  const body = await response.json();
  if (!body || !Array.isArray(body.data))
    throw new Error(
      "This service did not return a compatible model list. Use the suggested models instead.",
    );
  return body.data
    .filter((m: { id?: unknown } | null) => m && typeof m.id === "string")
    .map((m: { id: string; pricing?: { prompt?: string; completion?: string } }) =>
      classifyModel(s.provider, m.id, !!s.freeAllowance, m.pricing),
    );
}
