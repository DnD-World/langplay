# Handoff: Langplay

_Last updated: 2026-10-09 · by: Claude (Opus 5.5) · branch: `phase-10-docs` (stacked PRs #1–#10) · version: 0.2.0 (unreleased)_

## In one paragraph

Langplay is a browser-only playground for learning LangChain/LangGraph without code: build a recipe of steps (or a graph with branches and loops), run it on free real AI, inspect every step, learn through 12 auto-checked lessons, and spin recipes out as standalone tools (tool page, embed, HTML file, LangGraph Python, Claude skill, n8n, MCP). v2 work is done on stacked branches waiting to be merged into `main`; the live site still runs v1 until then.

## Current state

- **Works:** shared engine (`src/engine`), real tools, documents, graph canvas, save/share/export, compare, lessons, all 7 spin-outs, phone layout, docs page.
- **Waiting on the owner:**
  1. Merge PRs #1 → #10 in order (I could not merge: the permission system blocks merging without review).
  2. Click **Publish** in Lovable after merging.
  3. Cloudflare copy: the account has no `workers.dev` subdomain and adding a custom domain (e.g. `langplay.dnd-world.com`) is a DNS change I was not allowed to make. Either register a workers.dev subdomain in the Cloudflare dashboard (Workers → onboarding) or approve the custom domain, then run the deploy in [DEPLOY.md](DEPLOY.md).
- **Known issues:** free keyless AI is thin (Pollinations asks for payment after a few requests per visitor; OVHcloud allows ~2/min); local dev on `localhost` is blocked by Pollinations' bot check (OVH works).
- **Test suite:** yes — `bun run test` (58 tests) plus `bun run lint`, `bun run typecheck`, CI on every PR.

## Next steps, in order

1. Merge and publish (above).
2. Decide the free-AI strategy (see Open questions).
3. Tag `v0.2.0` after the release gate in STANDARDS.md.
4. Optional: in-browser AI with WebLLM (unlimited, private; ~0.5–1 GB download per user).

## Run it

See [INSTALL.md](INSTALL.md). The one command that proves it works:

```bash
bun run test
```

## Where things live

| Path                                                | What                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/engine/`                                       | The runner (no React): recipe model, AI calls, tools, documents (BM25), share codec, cost, layout |
| `src/runner/`                                       | Dependency-free tool UI used by `/tool`, embeds and exported HTML; safe Markdown                  |
| `src/export/`                                       | Spin-out generators: Python, notebook, skill, n8n, MCP stdio, Worker, HTML                        |
| `src/runtime/` + `vite-plugins/langplay-runtime.ts` | Bundles engine/runner into strings (`virtual:langplay-runtime`) for exports                       |
| `src/components/lp/play/`                           | Playground panels: builder, graph, run, trace, learn, lessons, documents, spin out                |
| `src/lib/`                                          | Providers, model policy, library recipes, lessons, saved recipes, documents, sources              |
| `src/routes/`                                       | `/` playground, `/tool` spun-out page, `/docs`                                                    |
| `docs/`                                             | Screenshots, design spec, evaluation, v1 history                                                  |

## Decisions and why

| Date       | Decision                                           | Why                                                                                      |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 2026-10-09 | One engine bundled into every spin-out             | Exported tools behave exactly like the app                                               |
| 2026-10-09 | Recipe = ordered nodes + `next`/`routes`/`retryTo` | Maps 1:1 to LangGraph edges and still works as a simple list on phones                   |
| 2026-10-09 | Pollinations default, fallback OVH → Simulator     | Owner's choice; keyless free tiers are thin, so failures degrade visibly, never silently |
| 2026-10-09 | Keys never exported; visitor can bring their own   | Spun-out files are shared with others                                                    |
| 2026-10-09 | MIT licence kept                                   | STANDARDS.md says MIT; CLAUDE SPACE/CLAUDE.md said Apache — owner chose MIT              |
| 2026-10-09 | Local dev port 20136                               | Picked with `pick-port.mjs`, recorded in PORTS.md; 8080 is Docker on this machine        |

## Gotchas

- Pollinations returns 403 "Missing Turnstile token" from `localhost` only; test real AI locally with OVH.
- OVH free tier: 2 requests/minute per model per IP; multi-step recipes fall back after that.
- Lovable asset URLs (`/__l5e/...`) only work on lovable.app — use files in `public/` instead.
- `Blob.text()` is missing in jsdom; polyfilled in `src/test/setup.ts`.
- The Python client refuses an empty API key; generated code strips the Authorization header instead.
- The `bash` heredocs on this machine eat `\n` escapes — write multi-line code with the editor.

## Secrets and access

Names only. Langplay itself needs none (see `.env.example`).

| Name                                            | What for                 | Where                                   |
| ----------------------------------------------- | ------------------------ | --------------------------------------- |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Optional Cloudflare copy | Master key file in CLAUDE SPACE/SECRETS |

## Open questions

- Free AI for everyone: (a) keep keyless + free-key guide, (b) add WebLLM in-browser AI, or (c) an owner-funded proxy (Worker + owner key, per-visitor daily cap). Needs the owner's call — (c) costs money and needs a deployed Worker.
