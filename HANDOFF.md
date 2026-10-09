# Handoff: Langplay

_Last updated: 2026-10-09 · by: Claude (Opus 5.5) · branch: `main` · version: 0.2.0 (unreleased)_

## In one paragraph

Langplay is a browser-only playground for learning LangChain/LangGraph without code: build a recipe of steps (or a graph with branches and loops), run it on free real AI, inspect every step, learn through 12 auto-checked lessons, and spin recipes out as standalone tools (tool page, embed, HTML file, LangGraph Python, Claude skill, n8n, MCP). v2 is merged into `main` and live at langplay.stravelakis.com; next comes the installable Windows app.

## Current state

- **Works:** shared engine (`src/engine`), real tools, documents, graph canvas, save/share/export, compare, lessons, all 7 spin-outs, phone layout, docs page.
- **Live:** https://langplay.stravelakis.com (Cloudflare, deployed 2026-10-09) and langplay.lovable.app (after Publish in Lovable).
- **Direction (owner, 2026-10-09):** free forever, no money; personal + downloadable Windows app to the signature standards (installer, Repair/Update, app-or-browser mode, triple docs); optional offline AI download; the website stays a live web version. Never anything the owner pays for.
- **Known issues:** free keyless AI is thin (Pollinations asks for payment after a few requests per visitor; OVHcloud allows ~2/min); local dev on `localhost` is blocked by Pollinations' bot check (OVH works).
- **Test suite:** yes — `bun run test` (58 tests) plus `bun run lint`, `bun run typecheck`, CI on every PR.

## Next steps, in order

1. Windows app with Tauri v2, built and released by GitHub Actions (installer + uninstaller, Settings → Advanced Repair/Update from GitHub Releases, window or browser mode on port 20136).
2. Optional offline AI: llama.cpp server + a small model, downloaded on request, shown as a provider.
3. Save several custom OpenAI-compatible endpoints.
4. Triple-level docs site (Dev / English / ELI5) from the docs theme; tag v1.0.0.

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

| Name                                            | What for                 | Where                                          |
| ----------------------------------------------- | ------------------------ | ---------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Optional Cloudflare copy | Owner's private key store (never in this repo) |

## Open questions

- None blocking. Free keyless services are only for a working first run; users bring their own keys.
