import { KEYLESS_FREE } from "./llm";
import type { LlmSettings, Usage } from "./types";

export type Cost =
  | { kind: "free"; reason: string }
  | { kind: "priced"; usd: number }
  | { kind: "unknown"; reason: string };

/**
 * Money only when it is known: free services, or a price the provider itself published
 * (OpenRouter's model list). Everything else says "unknown" rather than guessing.
 */
export function costOf(settings: Pick<LlmSettings, "provider" | "pricing">, usage: Usage): Cost {
  if (KEYLESS_FREE.includes(settings.provider))
    return {
      kind: "free",
      reason:
        settings.provider === "simulator"
          ? "Offline practice"
          : "Free service (usage limits may apply)",
    };
  if (settings.pricing)
    return {
      kind: "priced",
      usd: usage.prompt * settings.pricing.prompt + usage.completion * settings.pricing.completion,
    };
  return { kind: "unknown", reason: "This provider did not publish a price Langplay can read." };
}

export function formatCost(cost: Cost): string {
  if (cost.kind === "free") return "$0 · free";
  if (cost.kind === "unknown") return "price unknown";
  if (cost.usd === 0) return "$0";
  return cost.usd < 0.01 ? `≈ $${cost.usd.toFixed(5)}` : `≈ $${cost.usd.toFixed(3)}`;
}
