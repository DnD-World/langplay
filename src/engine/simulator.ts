import { extractExpression } from "./calc";
import { tokenize } from "./docs";
import type { ChatFn, Msg } from "./types";

// The offline practice "AI". It never pretends to know facts: it echoes the request,
// shows how each step type behaves, and labels itself as practice.

export const ROUTER_MARK = "Choose exactly one option:";
export const CRITIC_MARK = "Reply PASS";
export const QUERY_MARK = "Reply with the tool input only.";

const estimate = (text: string) => Math.max(1, Math.round(text.length / 4));

function section(user: string, name: string): string {
  const match = new RegExp(`${name}:\\n([\\s\\S]*?)(?:\\n\\n[A-Z][\\w ]+:\\n|$)`).exec(user);
  return match?.[1]?.trim() ?? "";
}

export function simulateReply(messages: Msg[]): string {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const user = messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const request = section(user, "Request") || user;
  const topic = request.replace(/\s+/g, " ").slice(0, 90);

  if (system.includes(ROUTER_MARK)) {
    const options = (system.split(ROUTER_MARK)[1] ?? "")
      .split("\n")[0]!
      .split(",")
      .map((o) => o.trim().replace(/\.$/, ""))
      .filter(Boolean);
    const words = new Set(tokenize(request));
    const billing = /refund|bill|pay|price|charge|invoice|money|cost/i.test(request);
    const picked =
      options.find((o) => tokenize(o).some((w) => words.has(w))) ??
      (billing ? options.find((o) => /bill|pay|money/i.test(o)) : undefined) ??
      options.find((o) => !/bill|pay|money/i.test(o)) ??
      options[0] ??
      "";
    return picked;
  }
  if (system.includes(QUERY_MARK)) {
    if (/maths expression/i.test(system)) return extractExpression(request) || "2+2";
    return tokenize(request).slice(0, 6).join(" ") || request.slice(0, 60);
  }
  if (system.includes(CRITIC_MARK)) {
    return user.includes("(revised practice answer)")
      ? "PASS — the draft now has a concrete example."
      : "REVISE: add one concrete everyday example so a beginner can picture it.";
  }
  const notes = section(user, "Notes from earlier steps");
  const feedback = section(user, "Reviewer feedback to fix");
  const prefix = feedback ? "(revised practice answer)" : "(practice answer)";
  const evidence = notes ? ` Using the notes: ${notes.split("\n")[0]?.slice(0, 140)}` : "";
  const fix = feedback ? ` Fixed: ${feedback.slice(0, 100)}` : "";
  return `${prefix} Following "${system.split("\n")[0]?.slice(0, 70)}" for "${topic}": break it into small pieces, explain each in plain words, and end with one clear takeaway.${evidence}${fix} Connect a real AI in Settings for a real answer.`;
}

export const simulatorChat: ChatFn = async (messages) => {
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 350));
  const text = simulateReply(messages);
  return {
    text,
    usage: {
      prompt: estimate(messages.map((m) => m.content).join("\n")),
      completion: estimate(text),
      estimated: true,
    },
    provider: "simulator",
    model: "sim-1",
  };
};
