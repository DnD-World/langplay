# Langplay — Handoff

## Status

Feature-complete prototype, published at https://langplay.lovable.app. Frontend-only; no server or database.

## Architecture

- **Framework:** TanStack Start v1 (React 19, SSR) on Vite 7, Tailwind v4 tokens in `src/styles.css`, shadcn/Radix.
- **Routes:** `/` playground, `/docs` simple guide + technical reference.
- **State:** localStorage keys `lp-settings` (provider, URL, key, model), `lp-game` (XP, coins, quests), `lp-motion`.
- **AI calls:** `src/lib/lp-llm.ts` → simulator, Puter SDK, or OpenAI-compatible `/chat/completions` (60s timeout, HTTPS only except localhost).
- **Models:** `src/lib/lp-models.ts` holds pricing policy and free classification; `fetchModels()` falls back to preset lists when a provider blocks browser requests.
- **Libraries:** `lp-sources.ts` (GitHub cookbooks, LangChain Hub), `lp-library.ts` (extensions catalogue, recipe schema validation).
- **Effects:** React Bits ports in `src/components/lp/react-bits/`, lazy-loaded after hydration, respect reduced motion and the Settings motion toggle.

## Key decisions

See `AGENTS.md`. Highlights: imports are text-only (no code execution); unverified models are blocked in free-only mode; rewards are deduped; tooltips use Radix portals.

## Known limits

- Tool/Search and Document steps return sample results.
- Many providers block browser (CORS) requests; keyed providers not tested with private accounts.
- GitHub API is rate-limited for anonymous users (60 req/h).
- Progress and keys are per-browser; no accounts or sync.

## Next opportunities

- Add a backend (accounts, saved recipes, server-side proxy for CORS-blocked providers and key safety).
- Real web-search and document-upload tools with permissions.
- MCP/tool connections with per-user login.
- Split `src/routes/index.tsx` into panel components.

## Testing

`bun run test` runs `src/test/*.test.ts` (model policy, library parsing, source extraction).

## Further reading

`README.md`, `REVIEW.md`, `AGENTS.md`, `roadmap.md`.
