## Architecture

Langplay is a React 19 + TanStack Start app (Vite, Tailwind v4, shadcn/Radix) with **no backend**. The same code ships three ways:

| Target | Build | Where |
|---|---|---|
| Web | `bun run build` (SSR, Nitro → Cloudflare Workers) | langplay.stravelakis.com, Lovable |
| Windows | `bun run tauri build` (static SPA via `LANGPLAY_DESKTOP=1`, Tauri v2, NSIS) | GitHub Releases |
| Spin-outs | `virtual:langplay-runtime` (rolldown IIFE bundles of engine + runner) | inside exported files |

## The engine (`src/engine`)

Dependency-free TypeScript that runs in the browser, Node, Workers and n8n.

- **Recipe** — ordered `nodes`. `next` = edge (undefined = following node, `"end"` = stop). Routers have `routes: {label, to?}[]`; critics have `retryTo` + `maxLoops`. That is a LangGraph `StateGraph` with `add_edge` / `add_conditional_edges` and cycles.
- **State** — `question, context, notes[] (with sources), draft, feedback, loops`.
- **runRecipe(recipe, question, deps, onEvent)** — walks the graph (50-step guard), emits a `StepTrace` per step: messages, output, decision, sources, ms, usage, provider/model, note.
- **Routing** — the model is asked to `Choose exactly one option: a, b` and the reply is matched to labels.
- **Critic loop** — replies `PASS` or `REVISE: …`; feedback is fed to the retry target.
- **Tools** — Wikipedia, DuckDuckGo instant answer (→ Wikipedia fallback), calculator (own recursive-descent parser, no `eval`), clock, labelled practice data. With a real model the LLM writes the tool input.
- **Documents** — chunked passages ranked with BM25 in-process.
- **AI calls** — any OpenAI-compatible `/chat/completions`, Puter (browser), Simulator. 429/503 → polite retry; failures → `fallbackChat` (Pollinations → OVH → Simulator) and the trace says so.
- **Cost** — tokens always; money only when a price is published (OpenRouter) or the service is free.

## Recipe JSON

```json
{
  "version": 2,
  "title": "Smart Support Router",
  "summary": "One sentence.",
  "nodes": [
    { "id": "in", "kind": "input", "label": "Input", "instruction": "Customer says: {question}" },
    { "id": "route", "kind": "router", "label": "Router", "instruction": "Billing or tech?",
      "routes": [{ "label": "billing", "to": "bill" }, { "label": "tech", "to": "tech" }] },
    { "id": "bill", "kind": "agent", "label": "Billing", "instruction": "…", "next": "final" },
    { "id": "tech", "kind": "agent", "label": "Tech", "instruction": "…" },
    { "id": "final", "kind": "final", "label": "Answer", "instruction": "Under 80 words." }
  ]
}
```

`normalizeRecipe()` validates untrusted input by hand (no schema library), drops unknown fields and dangling references. Links carry recipes after `#r=` (deflate-raw + base64url), so they never reach a server.

## Spin-outs (`src/export`)

| Output | What is generated |
|---|---|
| Tool page / embed | `/tool#r=…` (+ `?embed=1`) rendering `src/runner/ui.ts` |
| HTML file | runner IIFE + recipe JSON (`<` escaped) in one file |
| Python | LangGraph `StateGraph`; routers and critics → `add_conditional_edges`; free endpoints get no `Authorization` header |
| Notebook | the same cells as `.ipynb` |
| Claude skill | `SKILL.md` (Agent Skills frontmatter) in a zip |
| n8n | Webhook → Settings → one Code node per step (`this.helpers.httpRequest`) → Switch / IF loop → Respond |
| MCP | stdio JSON-RPC script (initialize, tools/list, tools/call, ping) or a Worker with constant-time Bearer check |

Model output is only ever inserted as text or through `src/runner/markdown.ts` (builds elements, never HTML).

## Windows app (`src-tauri`)

- Window mode, or browser mode: `tiny_http` serves the bundled assets on `127.0.0.1:20136` with a tray icon.
- In the window, `fetch` to other origins goes through `tauri-plugin-http` (no CORS, no localhost bot checks).
- Offline AI: SHA-256-verified downloads of a pinned llama.cpp build and GGUF models (allow-listed hosts), `llama-server` on `127.0.0.1:12081` with half the CPU cores.
- Update: `tauri-plugin-updater` with a signed `latest.json` on GitHub Releases. Repair: re-download and run this version's installer.

## Develop

```bash
bun install
bun run dev:local     # http://localhost:20136
bun run lint && bun run typecheck && bun run test && bun run build
```

Tags `vX.Y.Z` build the Windows release and this docs site.
