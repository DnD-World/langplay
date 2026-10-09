import { extractExpression } from "./calc";
import { DEFAULT_MAX_LOOPS, defaultNextId } from "./recipe";
import { CRITIC_MARK, QUERY_MARK, ROUTER_MARK } from "./simulator";
import { DEFAULT_TOOLS, TOOL_INFO } from "./tools";
import type {
  ChatResult,
  Msg,
  Recipe,
  RecipeNode,
  RunDeps,
  RunEvent,
  RunResult,
  Source,
  StepTrace,
  ToolId,
  Usage,
} from "./types";

// Walks a recipe like LangGraph walks a StateGraph: every step reads the shared state,
// adds to it, and decides (or lets the AI decide) which step runs next.

export const MAX_STEPS = 50;
const STYLE = "Keep it short and beginner-friendly.";

interface State {
  question: string;
  context: string;
  notes: { from: string; text: string }[];
  draft: string;
  answer: string;
  feedback: string;
  loops: Record<string, number>;
}

export function fillQuestion(template: string, question: string): string {
  return template.includes("{question}")
    ? template.replaceAll("{question}", question)
    : `${template}\n${question}`.trim();
}

function userMessage(state: State, withFeedback: boolean): string {
  const parts = [`Request:\n${state.context || state.question}`];
  if (state.notes.length)
    parts.push(
      `Notes from earlier steps:\n${state.notes.map((n) => `- [${n.from}] ${n.text}`).join("\n")}`,
    );
  if (state.draft) parts.push(`Current draft:\n${state.draft}`);
  if (withFeedback && state.feedback) parts.push(`Reviewer feedback to fix:\n${state.feedback}`);
  return parts.join("\n\n");
}

export function buildMessages(node: RecipeNode, state: State, routeLabels: string[] = []): Msg[] {
  const instruction = node.instruction.replaceAll("{question}", state.question).trim();
  if (node.kind === "router")
    return [
      {
        role: "system",
        content: `You are a router. ${instruction}\n${ROUTER_MARK} ${routeLabels.join(", ")}.\nReply with only that one option.`,
      },
      { role: "user", content: `Request:\n${state.context || state.question}` },
    ];
  if (node.kind === "critic" && node.retryTo)
    return [
      {
        role: "system",
        content: `You are a careful reviewer. ${instruction}\n${CRITIC_MARK} if the current draft fully and correctly answers the request. Otherwise reply REVISE: followed by the specific fixes needed.`,
      },
      { role: "user", content: userMessage(state, false) },
    ];
  return [
    { role: "system", content: `${instruction || "Answer the request."} ${STYLE}`.trim() },
    { role: "user", content: userMessage(state, node.kind === "agent") },
  ];
}

const addUsage = (total: Usage, u?: Usage) => {
  if (!u) return;
  total.prompt += u.prompt;
  total.completion += u.completion;
  total.estimated = total.estimated || u.estimated;
};

function pickRoute(reply: string, labels: string[]): string | undefined {
  const clean = reply.toLowerCase();
  return (
    labels.find((l) => clean.trim() === l.toLowerCase()) ??
    labels
      .map((l) => ({ l, at: clean.indexOf(l.toLowerCase()) }))
      .filter((x) => x.at >= 0)
      .sort((a, b) => a.at - b.at)[0]?.l
  );
}

export async function runRecipe(
  recipe: Recipe,
  question: string,
  deps: RunDeps,
  onEvent?: (event: RunEvent) => void,
): Promise<RunResult> {
  const now = deps.now ?? (() => Date.now());
  const started = now();
  const tools = { ...DEFAULT_TOOLS, ...deps.tools };
  const state: State = {
    question: question.trim(),
    context: "",
    notes: [],
    draft: "",
    answer: "",
    feedback: "",
    loops: {},
  };
  const steps: StepTrace[] = [];
  const usage: Usage = { prompt: 0, completion: 0, estimated: false };
  let fallbacks = 0;
  let node: RecipeNode | undefined = recipe.nodes[0];
  let stoppedByGuard = false;

  const ask = async (messages: Msg[]): Promise<{ result: ChatResult; note?: string }> => {
    try {
      return { result: await deps.chat(messages, deps.signal) };
    } catch (error) {
      if (deps.signal?.aborted || !deps.fallbackChat) throw error;
      fallbacks++;
      const reason = error instanceof Error ? error.message.slice(0, 160) : "error";
      const result = await deps.fallbackChat(messages, deps.signal);
      return {
        result,
        note:
          result.provider === "simulator"
            ? `The AI service did not answer (${reason}), so the practice Simulator answered this step.`
            : `The AI service did not answer (${reason}), so the free backup (${result.provider}) answered this step.`,
      };
    }
  };

  while (node) {
    if (deps.signal?.aborted) throw new Error("Run stopped.");
    if (steps.length >= MAX_STEPS) {
      stoppedByGuard = true;
      break;
    }
    const current: RecipeNode = node;
    const index = steps.length;
    onEvent?.({ type: "step-start", nodeId: current.id, index });
    const t0 = now();
    let nextId = defaultNextId(recipe, current);
    const trace: StepTrace = {
      index,
      nodeId: current.id,
      kind: current.kind,
      label: current.label,
      ms: 0,
      output: "",
    };
    const callAi = async (messages: Msg[]) => {
      const { result, note } = await ask(messages);
      trace.messages = messages;
      trace.usage = result.usage;
      trace.provider = result.provider;
      trace.model = result.model;
      if (note) trace.note = note;
      addUsage(usage, result.usage);
      return result.text;
    };

    switch (current.kind) {
      case "input": {
        state.context = current.instruction.trim()
          ? fillQuestion(current.instruction, state.question)
          : state.question;
        trace.input = current.instruction;
        trace.output = state.context;
        break;
      }
      case "agent": {
        state.draft = await callAi(buildMessages(current, state));
        state.feedback = "";
        trace.output = state.draft;
        break;
      }
      case "final": {
        state.answer = await callAi(buildMessages(current, state));
        state.draft = state.answer;
        trace.output = state.answer;
        break;
      }
      case "critic": {
        if (!current.retryTo) {
          // No loop configured: the critic rewrites the draft itself (simple reflection).
          state.draft = await callAi(buildMessages(current, state));
          trace.output = state.draft;
          break;
        }
        const reply = await callAi(buildMessages(current, state));
        trace.output = reply;
        const pass = /^\W*pass\b/i.test(reply);
        const used = state.loops[current.id] ?? 0;
        const max = current.maxLoops ?? DEFAULT_MAX_LOOPS;
        const target = recipe.nodes.find((n) => n.id === current.retryTo);
        if (pass) trace.decision = "Good enough — moving on.";
        else if (used < max && target) {
          state.loops[current.id] = used + 1;
          state.feedback = reply.replace(/^\W*revise\W*/i, "").trim();
          nextId = target.id;
          trace.decision = `Needs work — back to "${target.label}" (loop ${used + 1} of ${max}).`;
        } else
          trace.decision = `Still not perfect, but the loop limit (${max}) is reached — moving on.`;
        break;
      }
      case "router": {
        const routes = current.routes?.length ? current.routes : [];
        const labels = routes.map((r) => r.label);
        const reply = labels.length ? await callAi(buildMessages(current, state, labels)) : "";
        const chosen = pickRoute(reply, labels) ?? labels[0];
        const route = routes.find((r) => r.label === chosen);
        trace.output = reply || "(no routes set)";
        if (route) {
          if (route.to && recipe.nodes.some((n) => n.id === route.to)) nextId = route.to;
          const target = recipe.nodes.find((n) => n.id === nextId);
          trace.decision = `Chose "${route.label}"${pickRoute(reply, labels) ? "" : " (reply unclear, used the first option)"} → ${target ? `"${target.label}"` : "end"}.`;
          state.notes.push({
            from: current.label,
            text: `This request was routed to: ${route.label}`,
          });
        }
        break;
      }
      case "tool": {
        const toolId: ToolId = current.tool ?? "sample";
        const info = TOOL_INFO[toolId];
        let input = state.question;
        if (info.needsInput) {
          if (deps.simulated)
            input =
              toolId === "calculator"
                ? extractExpression(state.question) || state.question
                : state.question;
          else {
            const messages: Msg[] = [
              {
                role: "system",
                content: `You prepare input for the "${info.name}" tool. ${current.instruction} ${info.hint}\n${QUERY_MARK}`,
              },
              { role: "user", content: userMessage(state, false) },
            ];
            input =
              (await callAi(messages))
                .split("\n")[0]
                ?.replace(/^["'`]|["'`]$/g, "")
                .trim() || state.question;
          }
        }
        trace.input = input;
        try {
          const result = await (tools[toolId] ?? DEFAULT_TOOLS.sample)(input, deps.signal);
          trace.output = result.text;
          trace.sources = result.sources;
          trace.practice = result.practice;
          if (result.practice)
            trace.note = "Practice results: made up for learning, no live search was performed.";
          state.notes.push(...noteLines(info.name, result.sources, result.text));
        } catch (error) {
          const reason = error instanceof Error ? error.message : "unknown error";
          trace.output = `${info.name} failed: ${reason}`;
          trace.note = "The tool failed, so the recipe continued without its results.";
        }
        break;
      }
      case "retriever": {
        const query = [state.question, state.draft].filter(Boolean).join(" ");
        trace.input = query;
        const found: Source[] = deps.searchDocs ? deps.searchDocs(query, 3) : [];
        if (found.length) {
          trace.sources = found;
          trace.output = found.map((s) => `${s.title}: ${s.snippet}`).join("\n\n");
          state.notes.push(...noteLines("Documents", found, ""));
        } else {
          trace.practice = true;
          trace.note = deps.searchDocs
            ? "No passage in your documents matched, so practice page notes were used."
            : "No documents added, so practice page notes were used. Add a file to search your own text.";
          trace.output = "Page 3: key definition. Page 7: a worked example. Page 12: a summary.";
          state.notes.push({ from: "Documents (practice)", text: trace.output });
        }
        break;
      }
    }

    trace.ms = Math.max(0, now() - t0);
    steps.push(trace);
    onEvent?.({ type: "step", trace });
    if (current.kind === "final") break;
    node = nextId ? recipe.nodes.find((n) => n.id === nextId) : undefined;
  }

  const result: RunResult = {
    answer:
      state.answer ||
      state.draft ||
      state.notes.map((n) => n.text).join("\n") ||
      state.context ||
      state.question,
    steps,
    ms: Math.max(0, now() - started),
    usage,
    fallbacks,
    stoppedByGuard,
  };
  onEvent?.({ type: "done", result });
  return result;
}

function noteLines(from: string, sources: Source[], fallback: string) {
  if (!sources.length) return fallback ? [{ from, text: fallback }] : [];
  return sources.map((s) => ({
    from,
    text: `${s.title}: ${s.snippet}${s.url ? ` (${s.url})` : ""}`,
  }));
}
