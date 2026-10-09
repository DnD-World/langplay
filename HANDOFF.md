# Handoff: Langplay

_Last updated: 2026-10-09 · by: Claude (Opus 5.5) · branch: `main` · version: 0.2.0 (unreleased)_

## In one paragraph

Langplay is a browser-only playground for learning LangChain/LangGraph without code: build a recipe of steps (or a graph with branches and loops), run it on free real AI, inspect every step, learn through 12 auto-checked lessons, and spin recipes out as standalone tools (tool page, embed, HTML file, LangGraph Python, Claude skill, n8n, MCP). v2 is merged into `main` and live at langplay.stravelakis.com; next comes the installable Windows app.

## Current state

- **Works:** shared engine, real tools, documents, graph canvas, save/share/export, compare, lessons, 7 spin-outs, saved AI connections, docs site, and the **Windows app** (installer, window/browser mode, offline AI, Update, Repair) — all tested on this laptop from the GitHub-built installer.
- **Live:** https://langplay.stravelakis.com (Cloudflare, deployed 2026-10-09) and langplay.lovable.app (after Publish in Lovable).
- **Direction (owner, 2026-10-09):** free forever, no money; personal + downloadable Windows app to the signature standards (installer, Repair/Update, app-or-browser mode, triple docs); optional offline AI download; the website stays a live web version. Never anything the owner pays for.
- **Known issues:** free keyless AI is thin (Pollinations asks for payment after a few requests per visitor; OVHcloud allows ~2/min); local dev on `localhost` is blocked by Pollinations' bot check (OVH works).
- **Test suite:** yes — `bun run test` (58 tests) plus `bun run lint`, `bun run typecheck`, CI on every PR.

## Next steps, in order

1. Keep releasing with tags (DEPLOY.md). Bump versions in `src-tauri/tauri.conf.json` + `Cargo.toml` first.
2. Optional: GPU (Vulkan) build of the offline engine for faster local answers.
3. Optional: code signing — removes the "unknown publisher" warning but costs money every year (owner is frugal: not planned).
4. v1.0.0 = move to the Stravelakis org and docs.stravelakis.com/langplay.

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

- Tauri's internal messages on Windows are web requests to `*.localhost`; the desktop fetch hook must never route those (it hung every call once). Covered by `src/test/desktop.test.ts`.
- Test the installed app with `LANGPLAY_WEBVIEW_DEBUG_PORT=20143`; the port listens on IPv6 `[::1]`, then Playwright `connectOverCDP("http://[::1]:20143")`.
- Port 20136 is both the local dev server and the app's browser mode — stop one before testing the other.
- GitHub Pages only deploys from `main` and `v*` tags (environment rule set 2026-10-09).

- Pollinations returns 403 "Missing Turnstile token" from `localhost` only; test real AI locally with OVH.
- OVH free tier: 2 requests/minute per model per IP; multi-step recipes fall back after that.
- Lovable asset URLs (`/__l5e/...`) only work on lovable.app — use files in `public/` instead.
- `Blob.text()` is missing in jsdom; polyfilled in `src/test/setup.ts`.
- The Python client refuses an empty API key; generated code strips the Authorization header instead.
- The `bash` heredocs on this machine eat `\n` escapes — write multi-line code with the editor.

## Secrets and access

Names only. Langplay itself needs none (see `.env.example`).

| Name                                              | What for            | Where                                                                                                          |
| ------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Cloudflare deploy                                 | Web version         | `npx wrangler login` session on the owner's machine (the API token in the key store lacks Workers edit rights) |
| `TAURI_SIGNING_PRIVATE_KEY` (+ empty `_PASSWORD`) | Signing app updates | GitHub Actions secret; copy in the owner's private key store                                                   |

## Open questions

- None blocking. Free keyless services are only for a working first run; users bring their own keys.
