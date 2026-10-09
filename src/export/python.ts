import { DEFAULT_MAX_LOOPS, defaultNextId, slugify } from "../engine/recipe";
import { TOOL_INFO } from "../engine/tools";
import type { LlmSettings, Recipe, RecipeNode } from "../engine/types";

// Turns a recipe into runnable LangGraph code. Each step becomes a node function, routers
// and critic loops become add_conditional_edges, and the code mirrors the in-app engine.

type Cell = { kind: "markdown" | "code"; text: string };

/** Python string literal (double-quoted, escaped). */
const py = (s: string) => JSON.stringify(s);

const OVH = {
  base: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
  model: "Mistral-Small-3.2-24B-Instruct-2506",
};

function connection(settings?: LlmSettings) {
  if (
    settings &&
    !["simulator", "pollinations", "ovh", "puter", "horde"].includes(settings.provider) &&
    settings.baseUrl
  )
    return { base: settings.baseUrl.replace(/\/$/, ""), model: settings.model, keyed: true };
  if (settings?.provider === "ovh") return { base: OVH.base, model: settings.model, keyed: false };
  return { base: OVH.base, model: OVH.model, keyed: false };
}

const fnName = (recipe: Recipe, node: RecipeNode) => {
  const i = recipe.nodes.indexOf(node);
  return `step_${i + 1}_${slugify(node.label).replace(/-/g, "_").slice(0, 30) || node.kind}`;
};

function target(recipe: Recipe, id: string | null | undefined) {
  if (!id) return "END";
  const node = recipe.nodes.find((n) => n.id === id);
  return node ? py(fnName(recipe, node)) : "END";
}

function nodeCode(recipe: Recipe, node: RecipeNode): string {
  const name = fnName(recipe, node);
  const instr = py(node.instruction);
  const header = `def ${name}(state: State) -> dict:\n    """${node.label.replace(/"/g, "'")} — ${node.kind}."""\n`;
  const fill = `${instr}.replace("{question}", state["question"])`;
  switch (node.kind) {
    case "input":
      return `${header}    template = ${instr}
    if not template.strip():
        return {"context": state["question"]}
    if "{question}" in template:
        return {"context": template.replace("{question}", state["question"])}
    return {"context": f"{template}\\n{state['question']}".strip()}\n`;
    case "agent":
      return `${header}    draft = ask(${fill} + " " + STYLE, request_text(state, with_feedback=True))
    return {"draft": draft, "feedback": ""}\n`;
    case "final":
      return `${header}    answer = ask(${fill} + " " + STYLE, request_text(state))
    return {"answer": answer, "draft": answer}\n`;
    case "tool": {
      const tool = node.tool ?? "sample";
      const info = TOOL_INFO[tool];
      if (!info.needsInput)
        return `${header}    result = ${tool === "datetime" ? "today()" : "practice_results(state['question'])"}
    return {"notes": state.get("notes", []) + [f"[${info.name}] {result}"]}\n`;
      return `${header}    # The AI writes the tool input, then the tool runs for real.
    query = ask(
        ${py(`You prepare input for the "${info.name}" tool. `)} + ${fill} + ${py(` ${info.hint}\nReply with the tool input only.`)},
        request_text(state),
    ).splitlines()[0].strip(" \\"'\`")
    try:
        result = ${tool}(query)
    except Exception as error:  # a failing tool should not stop the recipe
        result = f"tool failed: {error}"
    return {"notes": state.get("notes", []) + [f"[${info.name}] {query} -> {result}"]}\n`;
    }
    case "retriever":
      return `${header}    passages = search_docs(state["question"] + " " + state.get("draft", ""))
    notes = passages or ["No matching passage in ./docs (add .txt or .md files there)."]
    return {"notes": state.get("notes", []) + notes}\n`;
    case "router": {
      const labels = (node.routes ?? []).map((r) => r.label);
      return `${header}    labels = ${JSON.stringify(labels)}
    reply = ask(
        "You are a router. " + ${fill} + "\\nChoose exactly one option: " + ", ".join(labels) + ".\\nReply with only that one option.",
        "Request:\\n" + (state.get("context") or state["question"]),
    )
    choice = next((label for label in labels if reply.strip().lower() == label.lower()), None) or next(
        (label for label in labels if label.lower() in reply.lower()), labels[0]
    )
    return {"route": choice, "notes": state.get("notes", []) + [f"This request was routed to: {choice}"]}\n`;
    }
    case "critic":
      if (!node.retryTo)
        return `${header}    draft = ask(${fill} + " " + STYLE, request_text(state))
    return {"draft": draft}\n`;
      return `${header}    reply = ask(
        "You are a careful reviewer. " + ${fill}
        + "\\nReply PASS if the current draft fully and correctly answers the request."
        + " Otherwise reply REVISE: followed by the specific fixes needed.",
        request_text(state),
    )
    loops = dict(state.get("loops", {}))
    if reply.lstrip(" *#").upper().startswith("PASS") or loops.get(${py(name)}, 0) >= ${node.maxLoops ?? DEFAULT_MAX_LOOPS}:
        return {"verdict": "good", "loops": loops}
    loops[${py(name)}] = loops.get(${py(name)}, 0) + 1
    return {"verdict": "needs_work", "feedback": reply.split(":", 1)[-1].strip(), "loops": loops}\n`;
  }
}

function toolHelpers(recipe: Recipe): string {
  const used = new Set(
    recipe.nodes.filter((n) => n.kind === "tool").map((n) => n.tool ?? "sample"),
  );
  const parts: string[] = [];
  if (used.has("wikipedia") || used.has("websearch"))
    parts.push(`def wikipedia(query: str) -> str:
    """Search Wikipedia and return the intros of the top 3 articles."""
    data = requests.get(
        "https://en.wikipedia.org/w/api.php",
        params={"action": "query", "generator": "search", "gsrsearch": query, "gsrlimit": 3,
                "prop": "extracts|info", "exintro": 1, "explaintext": 1, "exlimit": 3,
                "inprop": "url", "format": "json"},
        headers={"User-Agent": "langplay-export/1.0"},
        timeout=15,
    ).json()
    pages = sorted(data.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    return "\\n".join(f"{p['title']}: {p.get('extract', '')[:600]} ({p.get('fullurl', '')})" for p in pages) or "nothing found"
`);
  if (used.has("websearch"))
    parts.push(`def websearch(query: str) -> str:
    """DuckDuckGo instant answer, falling back to Wikipedia."""
    data = requests.get("https://api.duckduckgo.com/",
                        params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1}, timeout=15).json()
    found = [data.get("Answer"), data.get("AbstractText"), data.get("Definition")]
    found += [t.get("Text") for t in data.get("RelatedTopics", [])[:3] if isinstance(t, dict)]
    found = [f for f in found if f]
    return "\\n".join(found) if found else wikipedia(query)
`);
  if (used.has("calculator"))
    parts.push(`_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.Pow: operator.pow, ast.Mod: operator.mod, ast.USub: operator.neg, ast.UAdd: operator.pos}
_FUNCS = {"sqrt": math.sqrt, "abs": abs, "round": round, "floor": math.floor, "ceil": math.ceil}


def calculator(expression: str) -> str:
    """Exact maths without eval(): only numbers, + - * / ^ % ( ) and a few functions."""
    def walk(node):
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](walk(node.left), walk(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](walk(node.operand))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in _FUNCS:
            return _FUNCS[node.func.id](*[walk(a) for a in node.args])
        raise ValueError("unsupported expression")
    value = walk(ast.parse(expression.replace("^", "**"), mode="eval").body)
    return f"{expression} = {value:g}"
`);
  if (used.has("datetime"))
    parts.push(`def today() -> str:
    return datetime.datetime.now().astimezone().strftime("%A %d %B %Y, %H:%M %Z")
`);
  if (used.has("sample"))
    parts.push(`def practice_results(question: str) -> str:
    return "Practice data (made up): Source A says the idea is well documented; Source B gives an everyday example."
`);
  if (recipe.nodes.some((n) => n.kind === "retriever"))
    parts.push(`def search_docs(query: str, k: int = 3) -> list[str]:
    """Keyword search over .txt/.md files in ./docs (a tiny stand-in for a vector store)."""
    words = {w for w in re.findall(r"\\w+", query.lower()) if len(w) > 2}
    passages = []
    for path in pathlib.Path("docs").glob("*.*"):
        if path.suffix.lower() not in {".txt", ".md"}:
            continue
        for i, para in enumerate(path.read_text(encoding="utf-8", errors="ignore").split("\\n\\n")):
            score = len(words & set(re.findall(r"\\w+", para.lower())))
            if score:
                passages.append((score, f"{path.name} · part {i + 1}: {para.strip()[:700]}"))
    return [p for _, p in sorted(passages, reverse=True)[:k]]
`);
  return parts.join("\n\n");
}

export function pythonCells(recipe: Recipe, settings?: LlmSettings): Cell[] {
  const conn = connection(settings);
  const cells: Cell[] = [];
  const file = `${slugify(recipe.title).replace(/-/g, "_")}.py`;
  cells.push({
    kind: "markdown",
    text: `# ${recipe.title}\n\n${recipe.summary}\n\nGenerated by Langplay as real LangGraph code: every step is a node, routers and critic loops are conditional edges.\n\n**Run it:** \`pip install -U langgraph langchain-openai requests\` then \`python ${file} "your question"\`.\n\nBy default it uses ${conn.keyed ? "the service you picked in Langplay" : "OVHcloud's free endpoint (about 2 requests a minute)"}. Set \`LANGPLAY_BASE_URL\`, \`LANGPLAY_API_KEY\` and \`LANGPLAY_MODEL\` to use any OpenAI-compatible service.`,
  });
  cells.push({
    kind: "code",
    text: `import ast
import datetime
import math
import operator
import os
import pathlib
import re
import sys
from typing import TypedDict

import httpx
import requests
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph

API_KEY = os.getenv("LANGPLAY_API_KEY", "")  # ${conn.keyed ? "set this; keys are never exported" : "not needed for the free endpoint"}


def _no_key(request: httpx.Request) -> None:
    """Free endpoints reject made-up keys, so send no Authorization header at all."""
    request.headers.pop("Authorization", None)


llm = ChatOpenAI(
    base_url=os.getenv("LANGPLAY_BASE_URL", ${py(conn.base)}),
    api_key=API_KEY or "no-key",
    http_client=None if API_KEY else httpx.Client(event_hooks={"request": [_no_key]}),
    model=os.getenv("LANGPLAY_MODEL", ${py(conn.model)}),
    max_retries=6,  # free tiers rate-limit; the client waits and retries
)
STYLE = "Keep it short and beginner-friendly."


class State(TypedDict, total=False):
    """Shared memory every step reads from and writes to."""
    question: str
    context: str
    notes: list[str]
    draft: str
    feedback: str
    answer: str
    route: str
    verdict: str
    loops: dict


def ask(system: str, user: str) -> str:
    return llm.invoke([("system", system), ("human", user)]).content.strip()


def request_text(state: State, with_feedback: bool = False) -> str:
    parts = [f"Request:\\n{state.get('context') or state['question']}"]
    if state.get("notes"):
        parts.append("Notes from earlier steps:\\n" + "\\n".join(f"- {n}" for n in state["notes"]))
    if state.get("draft"):
        parts.append(f"Current draft:\\n{state['draft']}")
    if with_feedback and state.get("feedback"):
        parts.append(f"Reviewer feedback to fix:\\n{state['feedback']}")
    return "\\n\\n".join(parts)
`,
  });
  const helpers = toolHelpers(recipe);
  if (helpers) {
    cells.push({
      kind: "markdown",
      text: "## Tools\n\nPlain Python functions the steps can call. No keys needed.",
    });
    cells.push({ kind: "code", text: helpers });
  }
  cells.push({
    kind: "markdown",
    text: "## Steps (graph nodes)\n\nEach function reads the shared state and returns what it changed.",
  });
  for (const node of recipe.nodes) cells.push({ kind: "code", text: nodeCode(recipe, node) });

  const lines: string[] = ["graph = StateGraph(State)"];
  for (const node of recipe.nodes)
    lines.push(`graph.add_node(${py(fnName(recipe, node))}, ${fnName(recipe, node)})`);
  if (recipe.nodes[0]) lines.push(`graph.add_edge(START, ${py(fnName(recipe, recipe.nodes[0]))})`);
  for (const node of recipe.nodes) {
    const name = py(fnName(recipe, node));
    const auto = defaultNextId(recipe, node);
    if (node.kind === "final") lines.push(`graph.add_edge(${name}, END)`);
    else if (node.kind === "router" && node.routes?.length) {
      const map = node.routes
        .map((r) => `${py(r.label)}: ${target(recipe, r.to ?? auto)}`)
        .join(", ");
      lines.push(`graph.add_conditional_edges(${name}, lambda state: state["route"], {${map}})`);
    } else if (node.kind === "critic" && node.retryTo)
      lines.push(
        `graph.add_conditional_edges(${name}, lambda state: state["verdict"], {"good": ${target(recipe, auto)}, "needs_work": ${target(recipe, node.retryTo)}})  # a loop!`,
      );
    else lines.push(`graph.add_edge(${name}, ${target(recipe, auto)})`);
  }
  lines.push("app = graph.compile()");
  cells.push({
    kind: "markdown",
    text: "## Wire the graph\n\n`add_edge` = always go next; `add_conditional_edges` = let a function pick the next node.",
  });
  cells.push({ kind: "code", text: lines.join("\n") });
  cells.push({
    kind: "code",
    text: `def run(question: str) -> str:
    result = app.invoke({"question": question, "notes": [], "loops": {}}, {"recursion_limit": 60})
    return result.get("answer") or result.get("draft") or "\\n".join(result.get("notes", []))


if __name__ == "__main__":
    print(run(" ".join(sys.argv[1:]) or "Why is the sky blue?"))
`,
  });
  return cells;
}

export function pythonScript(recipe: Recipe, settings?: LlmSettings): string {
  return pythonCells(recipe, settings)
    .map((c) =>
      c.kind === "markdown"
        ? c.text
            .split("\n")
            .map((l) => `# ${l.replace(/^#+\s*/, "").replace(/\*\*/g, "")}`.trimEnd())
            .join("\n")
        : c.text,
    )
    .join("\n\n");
}

export function pythonNotebook(recipe: Recipe, settings?: LlmSettings): string {
  const cells = pythonCells(recipe, settings).map((c) => ({
    cell_type: c.kind,
    metadata: {},
    source: c.text.split("\n").map((l, i, a) => (i < a.length - 1 ? `${l}\n` : l)),
    ...(c.kind === "code" ? { outputs: [], execution_count: null } : {}),
  }));
  cells.splice(1, 0, {
    cell_type: "code",
    metadata: {},
    source: ["%pip install -q -U langgraph langchain-openai requests"],
    outputs: [],
    execution_count: null,
  });
  // In a notebook, run the example instead of reading sys.argv.
  const last = cells[cells.length - 1]!;
  last.source = [`print(run("Why is the sky blue?"))`];
  return JSON.stringify(
    {
      cells,
      metadata: {
        kernelspec: { name: "python3", display_name: "Python 3", language: "python" },
        language_info: { name: "python" },
      },
      nbformat: 4,
      nbformat_minor: 5,
    },
    null,
    1,
  );
}
