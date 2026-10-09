# Langplay v2 — design (2026-10-09)

Approved by the owner in chat: fix everything from `EVALUATION.md`, add spin-outs (tool page, HTML file, embed, Claude skill, n8n, MCP), keep MIT, Pollinations as default AI with Simulator fallback, go live on Lovable (owner clicks Publish) **and** a Cloudflare copy deployed by the agent.

## 1. Recipe model (graph without edge bookkeeping)

```ts
type Recipe = {
  version: 2;
  title;
  summary;
  source?;
  nodes: Node[]; // array order = display order in the Steps list
  spinout?: { provider: "pollinations" | "ovh" | "simulator" | "visitor"; model?: string };
};
type Node = {
  id;
  kind: "input" | "agent" | "tool" | "retriever" | "router" | "critic" | "final";
  label;
  instruction;
  next?: string | "end"; // undefined = the following node in the list
  tool?: "wikipedia" | "websearch" | "calculator" | "datetime" | "sample"; // tool nodes
  routes?: { label: string; to?: string }[]; // router nodes
  retryTo?: string;
  maxLoops?: number; // critic nodes
  x?: number;
  y?: number; // canvas position
};
```

- Maps 1:1 to LangGraph: `next` = `add_edge`, `routes` / critic = `add_conditional_edges`, critic `retryTo` = a cycle.
- v1 recipes (`steps[]`) convert by keeping order and leaving `next` undefined.
- Steps list stays usable on phones: branch targets are picked from dropdowns; the canvas is a second view of the same data.

## 2. Engine (`src/engine/`, no React, runs in browser, Node and Workers)

- `runRecipe(recipe, question, deps, onEvent)` walks the graph from the first node. Guard: 50 steps.
- Shared state: `question, context, notes[] (with sources), draft, feedback, route, loops`.
- Router: the AI picks one route label; reply is matched to labels, fallback = first route; decision recorded.
- Critic with `retryTo`: replies `PASS` or `REVISE: …`; loops back until PASS or `maxLoops` (default 2). Critic without `retryTo` rewrites the draft (v1 behaviour).
- Tools (browser-safe, no keys): Wikipedia search, DuckDuckGo instant answers, calculator (own parser, no `eval`), date/time, labelled sample. AI writes the search query when a real model is connected.
- Documents: user uploads .txt/.md/.pdf; chunked and ranked in the browser (BM25); stored in IndexedDB; citations "file p.N".
- Every step produces a trace: exact messages sent, output, decision, sources, ms, tokens (reported or estimated), provider/model, fallback note.
- LLM layer: OpenAI-compatible + Puter (browser only) + Simulator. On failure of a real provider the step falls back to the Simulator and says so.
- Cost: tokens always; money only when the provider gave a price (OpenRouter list) or is known free; otherwise "price unknown".

## 3. App

- `index.tsx` split into panels: Builder (Steps | Graph tabs), Run (chat, trace, compare), Learn (concept card, lessons).
- Autosave current recipe; "My recipes" list; share link `/#r=<compressed>`; JSON export/import (v1 + v2).
- Graph canvas: `@xyflow/react`, lazy-loaded, custom nodes in the existing look, handles per route / pass / revise.
- Compare: same question through two models or two recipes, side by side, with time/tokens/cost.
- Lessons: 12 auto-checked challenges with starter recipes; XP/ranks kept; old progress migrated.
- Look: unchanged established theme (dark indigo, mint primary, Bricolage Grotesque, LetterGlitch, BorderGlow, ClickSpark).

## 4. Spin-outs (one "Spin out" dialog)

| Output                       | How                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Tool page                    | `/tool#r=…` — clean runner, no builder; `?embed=1` for iframes                 |
| Embed                        | iframe snippet (+ WordPress note)                                              |
| HTML file                    | one self-contained file: runner + engine + recipe (+ optional document text)   |
| Python / notebook            | LangGraph code generated from the recipe; runs against Pollinations by default |
| Claude skill / system prompt | `SKILL.md` in a zip; plain prompt to copy                                      |
| n8n                          | workflow JSON: Webhook → per-step nodes → Respond; tested on the minipc n8n    |
| MCP (local)                  | single `.mjs` file, stdio, zero dependencies; Claude Desktop config snippet    |
| MCP (Cloudflare)             | Worker script + `wrangler.toml`, Bearer-token protected                        |

The engine and runner are bundled to strings at build time by a small Vite plugin (rolldown), so exported files carry the same engine as the app. Visitor keys are never embedded; creator keys never leave the creator's browser.

## 5. Safety

- No `eval`; imported text never executes. Calculator uses its own parser.
- Spin-outs only embed keyless provider choices; "visitor" mode asks the visitor for their own key.
- Cloudflare MCP worker refuses requests without the Bearer token.
- Questions go to the chosen AI service; Settings says so plainly.

## 6. Testing

- Vitest: engine traversal, router, critic loop limit, fallback, tools (mocked fetch), BM25, codec round-trip, v1→v2 migration, every exporter.
- Real checks: generated Python run against Pollinations; MCP script driven over stdio; n8n workflow imported and executed on the minipc then removed; Worker deployed, called with and without token, then removed; app driven in a browser.

## 7. Delivery

Phased branches + PRs, each merged only after tests and a browser check. Cloudflare copy redeployed after merges; owner clicks Publish in Lovable.
