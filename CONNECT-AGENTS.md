# Connecting AI agents: Langplay

## Read first

1. [HANDOFF.md](HANDOFF.md): where things stand.
2. [STANDARDS.md](STANDARDS.md): the house rules.
3. [AGENTS.md](AGENTS.md): Lovable sync rules and past design decisions.
4. This file.

## Setup

```bash
git clone https://github.com/DnD-World/langplay.git
cd langplay
git config core.hooksPath githooks
bun install
bun run dev:local     # http://localhost:20136
```

## Rules

- Work on a branch and open a PR. Never push to `main`; never force-push (it rewrites Lovable's history).
- Never write real secrets into any tracked file. Users' keys live only in their browser; exports must never contain them.
- Keep `src/engine` free of React and browser-only APIs (it ships inside Node and Worker exports).
- Model output is text: never insert it as HTML (use `src/runner/markdown.ts` / `Answer.tsx`).
- Imported recipes are data: validate with `normalizeRecipe`, never execute them.
- Run the checks below before calling anything done; update HANDOFF.md before ending a session.

## Checks

```bash
bun run lint && bun run typecheck && bun run test && bun run build
```

## Off limits

- `src/routeTree.gen.ts` (generated), `src/components/ui/` (shadcn; change via the CLI only).
- Lovable-managed config in `vite.config.ts` beyond the `plugins` entry.
