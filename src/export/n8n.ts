import { layoutRecipe } from "../engine/layout";
import { DEFAULT_MAX_LOOPS, defaultNextId, slugify } from "../engine/recipe";
import { TOOL_INFO } from "../engine/tools";
import type { LlmSettings, Recipe, RecipeNode } from "../engine/types";

// A recipe as an n8n workflow: Webhook → Settings → one Code node per step → Respond.
// Routers become Switch nodes and critic loops become IF nodes that loop back, so the
// workflow on the n8n canvas looks like the recipe graph.

type N8nNode = {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  webhookId?: string;
};
type Link = { node: string; type: "main"; index: number };

const js = (v: unknown) => JSON.stringify(v);

const PREAMBLE = `const state = { ...$json, notes: [...($json.notes || [])], loops: { ...($json.loops || {}) }, trace: [...($json.trace || [])] };
const S = state.settings;
const helpers = this.helpers;
const STYLE = "Keep it short and beginner-friendly.";
async function ask(system, user) {
  const headers = { "Content-Type": "application/json" };
  if (S.apiKey) headers.Authorization = "Bearer " + S.apiKey;
  const base = S.baseUrl.replace(/\\/$/, "");
  const url = base.endsWith("/openai") ? base : base + "/chat/completions";
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await helpers.httpRequest({ method: "POST", url, headers, json: true, timeout: 90000,
        body: { model: S.model, messages: [{ role: "system", content: system }, { role: "user", content: user }] } });
      return String(r.choices?.[0]?.message?.content ?? "").trim();
    } catch (error) {
      // Free tiers rate-limit: wait and retry a few times.
      if (attempt >= 4 || !/429|503|rate/i.test(String(error.message || error))) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20000));
    }
  }
}
function requestText(withFeedback) {
  const parts = ["Request:\\n" + (state.context || state.question)];
  if (state.notes.length) parts.push("Notes from earlier steps:\\n" + state.notes.map((n) => "- " + n).join("\\n"));
  if (state.draft) parts.push("Current draft:\\n" + state.draft);
  if (withFeedback && state.feedback) parts.push("Reviewer feedback to fix:\\n" + state.feedback);
  return parts.join("\\n\\n");
}
`;

const CALC = `function calculate(src) {
  src = src.replace(/\\s+/g, "").toLowerCase(); let i = 0;
  const F = { sqrt: Math.sqrt, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil };
  const eat = (c) => (src[i] === c ? (i++, true) : false);
  const expr = () => { let v = term(); for (;;) { if (eat("+")) v += term(); else if (eat("-")) v -= term(); else return v; } };
  const term = () => { let v = pow(); for (;;) { if (eat("*")) v *= pow(); else if (eat("/")) v /= pow(); else if (eat("%")) v %= pow(); else return v; } };
  const pow = () => { const b = unary(); return eat("^") ? Math.pow(b, pow()) : b; };
  const unary = () => (eat("-") ? -unary() : eat("+") ? unary() : atom());
  const atom = () => {
    if (eat("(")) { const v = expr(); if (!eat(")")) throw new Error("missing )"); return v; }
    const n = /^\\d*\\.?\\d+/.exec(src.slice(i)); if (n) { i += n[0].length; return parseFloat(n[0]); }
    const w = /^[a-z]+/.exec(src.slice(i)); if (w && F[w[0]]) { i += w[0].length; return F[w[0]](atom()); }
    throw new Error("unexpected " + (src[i] || "end"));
  };
  const v = expr(); if (i < src.length) throw new Error("unexpected " + src[i]); return v;
}
`;

function toolCall(tool: string): string {
  switch (tool) {
    case "wikipedia":
    case "websearch":
      return `const data = await helpers.httpRequest({ json: true, headers: { "User-Agent": "langplay-n8n/1.0" },
    url: "https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=3&prop=extracts|info&exintro=1&explaintext=1&exlimit=3&inprop=url&format=json&gsrsearch=" + encodeURIComponent(input) });
  const pages = Object.values(data.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  result = pages.map((p) => p.title + ": " + String(p.extract || "").slice(0, 600) + " (" + p.fullurl + ")").join("\\n") || "nothing found";`;
    case "calculator":
      return `result = input + " = " + calculate(input);`;
    case "datetime":
      return `result = "Right now it is " + new Date().toString();`;
    default:
      return `result = "Practice data (made up): Source A says the idea is well documented; Source B gives an everyday example.";`;
  }
}

function stepCode(node: RecipeNode): string {
  const instr = `${js(node.instruction)}.replaceAll("{question}", state.question)`;
  let body: string;
  switch (node.kind) {
    case "input":
      body = `const t = ${js(node.instruction)};
state.context = !t.trim() ? state.question : t.includes("{question}") ? t.replaceAll("{question}", state.question) : (t + "\\n" + state.question).trim();
const output = state.context;`;
      break;
    case "agent":
      body = `state.draft = await ask(${instr} + " " + STYLE, requestText(true));
state.feedback = "";
const output = state.draft;`;
      break;
    case "final":
      body = `state.answer = await ask(${instr} + " " + STYLE, requestText(false));
state.draft = state.answer;
const output = state.answer;`;
      break;
    case "tool": {
      const tool = node.tool ?? "sample";
      const info = TOOL_INFO[tool];
      body = `${tool === "calculator" ? CALC : ""}let input = state.question;
${info.needsInput ? `input = (await ask(${js(`You prepare input for the "${info.name}" tool. `)} + ${instr} + ${js(` ${info.hint}\nReply with the tool input only.`)}, requestText(false))).split("\\n")[0].replace(/^["'\`]|["'\`]$/g, "").trim() || state.question;` : ""}
let result;
try {
  ${toolCall(tool)}
} catch (error) { result = "tool failed: " + (error.message || error); }
state.notes.push("[${info.name}] " + result);
const output = result;`;
      break;
    }
    case "retriever":
      body = `// Documents can be sent with the request: { "question": "...", "documents": [{ "name": "a.txt", "text": "..." }] }
const words = new Set((state.question + " " + (state.draft || "")).toLowerCase().match(/\\w{3,}/g) || []);
const passages = [];
for (const d of state.documents || [])
  String(d.text || "").split(/\\n\\s*\\n/).forEach((p, i) => {
    const score = (p.toLowerCase().match(/\\w{3,}/g) || []).filter((w) => words.has(w)).length;
    if (score) passages.push({ score, text: (d.name || "document") + " · part " + (i + 1) + ": " + p.trim().slice(0, 700) });
  });
const found = passages.sort((a, b) => b.score - a.score).slice(0, 3).map((p) => p.text);
state.notes.push(...(found.length ? found : ["No documents were sent, so there are no passages."]));
const output = found.join("\\n") || "no passages";`;
      break;
    case "router": {
      const labels = (node.routes ?? []).map((r) => r.label);
      body = `const labels = ${js(labels)};
const reply = await ask("You are a router. " + ${instr} + "\\nChoose exactly one option: " + labels.join(", ") + ".\\nReply with only that one option.", "Request:\\n" + (state.context || state.question));
state.route = labels.find((l) => reply.trim().toLowerCase() === l.toLowerCase()) || labels.find((l) => reply.toLowerCase().includes(l.toLowerCase())) || labels[0];
state.notes.push("This request was routed to: " + state.route);
const output = "chose " + state.route;`;
      break;
    }
    case "critic":
      body = node.retryTo
        ? `const reply = await ask("You are a careful reviewer. " + ${instr} + "\\nReply PASS if the current draft fully and correctly answers the request. Otherwise reply REVISE: followed by the specific fixes needed.", requestText(false));
const used = state.loops[${js(node.id)}] || 0;
if (/^\\W*pass\\b/i.test(reply) || used >= ${node.maxLoops ?? DEFAULT_MAX_LOOPS}) state.verdict = "good";
else { state.verdict = "needs_work"; state.loops[${js(node.id)}] = used + 1; state.feedback = reply.replace(/^\\W*revise\\W*/i, "").trim(); }
const output = reply;`
        : `state.draft = await ask(${instr} + " " + STYLE, requestText(false));
const output = state.draft;`;
      break;
  }
  return `// Langplay step: ${node.label.replace(/\n/g, " ")} (${node.kind})
${PREAMBLE}
${body}
state.trace.push({ step: ${js(node.label)}, output: String(output).slice(0, 2000) });
return [{ json: state }];
`;
}

export function n8nWorkflow(recipe: Recipe, settings?: LlmSettings) {
  const slug = slugify(recipe.title);
  const pos = layoutRecipe(recipe);
  const keyed =
    settings && !["simulator", "pollinations", "ovh", "puter", "horde"].includes(settings.provider);
  const conn = keyed
    ? { baseUrl: settings.baseUrl, model: settings.model }
    : {
        baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
        model: "Mistral-Small-3.2-24B-Instruct-2506",
      };
  const nodes: N8nNode[] = [];
  const connections: Record<string, { main: Link[][] }> = {};
  const link = (from: string, to: string, output = 0) => {
    connections[from] ??= { main: [] };
    const outs = connections[from].main;
    while (outs.length <= output) outs.push([]);
    outs[output]!.push({ node: to, type: "main", index: 0 });
  };
  const names = new Map<string, string>();
  recipe.nodes.forEach((n, i) => names.set(n.id, `${i + 1}. ${n.label}`.slice(0, 60)));
  const nameOf = (id: string | null | undefined) => (id ? (names.get(id) ?? "Respond") : "Respond");
  const xy = (id: string, dx = 0): [number, number] => {
    const p = pos[id] ?? { x: 0, y: 0 };
    return [480 + Math.round((p.y / 130) * 300) + dx, Math.round(p.x * 1.2)];
  };

  nodes.push({
    id: "webhook",
    name: "Webhook",
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [0, 0],
    webhookId: crypto.randomUUID(),
    parameters: {
      httpMethod: "POST",
      path: `langplay-${slug}`,
      responseMode: "responseNode",
      options: {},
    },
  });
  nodes.push({
    id: "settings",
    name: "Settings",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [240, 0],
    parameters: {
      jsCode: `// Which AI answers. ${keyed ? "Put your API key here (it is never exported from Langplay)." : "OVHcloud's free endpoint needs no key (about 2 requests a minute)."}
const settings = { baseUrl: ${js(conn.baseUrl)}, model: ${js(conn.model)}, apiKey: "" };
const body = $json.body || $json;
return [{ json: {
  settings,
  question: String(body.question || "Why is the sky blue?").slice(0, 4000),
  documents: Array.isArray(body.documents) ? body.documents.slice(0, 20) : [],
  context: "", notes: [], draft: "", feedback: "", answer: "", route: "", verdict: "", loops: {}, trace: [],
} }];
`,
    },
  });
  link("Webhook", "Settings");
  const first = recipe.nodes[0];
  if (first) link("Settings", nameOf(first.id));

  for (const node of recipe.nodes) {
    const name = nameOf(node.id);
    nodes.push({
      id: node.id,
      name,
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: xy(node.id),
      parameters: { jsCode: stepCode(node) },
    });
    const auto = defaultNextId(recipe, node);
    if (node.kind === "final") link(name, "Respond");
    else if (node.kind === "router" && node.routes?.length) {
      const sw = `${name} → paths`.slice(0, 60);
      nodes.push({
        id: `${node.id}-switch`,
        name: sw,
        type: "n8n-nodes-base.switch",
        typeVersion: 3.2,
        position: xy(node.id, 150),
        parameters: {
          rules: {
            values: node.routes.map((r) => ({
              conditions: {
                options: {
                  caseSensitive: true,
                  leftValue: "",
                  typeValidation: "strict",
                  version: 2,
                },
                conditions: [
                  {
                    leftValue: "={{ $json.route }}",
                    rightValue: r.label,
                    operator: { type: "string", operation: "equals" },
                  },
                ],
                combinator: "and",
              },
              renameOutput: true,
              outputKey: r.label,
            })),
          },
          options: {},
        },
      });
      link(name, sw);
      node.routes.forEach((r, i) => link(sw, nameOf(r.to ?? auto), i));
    } else if (node.kind === "critic" && node.retryTo) {
      const gate = `${name} → good?`.slice(0, 60);
      nodes.push({
        id: `${node.id}-if`,
        name: gate,
        type: "n8n-nodes-base.if",
        typeVersion: 2.2,
        position: xy(node.id, 150),
        parameters: {
          conditions: {
            options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 2 },
            conditions: [
              {
                leftValue: "={{ $json.verdict }}",
                rightValue: "good",
                operator: { type: "string", operation: "equals" },
              },
            ],
            combinator: "and",
          },
          options: {},
        },
      });
      link(name, gate);
      link(gate, nameOf(auto), 0);
      link(gate, nameOf(node.retryTo), 1);
    } else link(name, nameOf(auto));
  }

  const maxX = Math.max(...nodes.map((n) => n.position[0]));
  nodes.push({
    id: "respond",
    name: "Respond",
    type: "n8n-nodes-base.respondToWebhook",
    typeVersion: 1.1,
    position: [maxX + 300, 0],
    parameters: {
      respondWith: "json",
      responseBody:
        "={{ JSON.stringify({ answer: $json.answer || $json.draft || $json.notes.join('\\n'), steps: $json.trace }) }}",
      options: {},
    },
  });

  return {
    name: `Langplay · ${recipe.title}`,
    nodes,
    connections,
    settings: { executionOrder: "v1" },
  };
}
