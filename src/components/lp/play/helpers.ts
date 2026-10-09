import { costOf, formatCost, type LlmSettings, type RunResult } from "@/engine";
import { RANKS } from "@/lib/lp-data";

export function rankFor(points: number) {
  const rank = [...RANKS].reverse().find((r) => points >= r.min) ?? RANKS[0]!;
  const next = RANKS.find((r) => r.min > points);
  return { rank, next };
}

export function runMeta(result: RunResult, settings: LlmSettings) {
  const total = result.usage.prompt + result.usage.completion;
  return `${(result.ms / 1000).toFixed(1)}s · ${total}${result.usage.estimated ? "≈" : ""} tokens · ${formatCost(costOf(settings, result.usage))}`;
}
