# Langplay

A visual playground for beginners (no coding needed) to learn and experiment with LangChain and LangGraph concepts.

- Build a recipe of steps (Input → AI Thinking → Tool/Search → Final Answer), run it, and read a plain-English explanation of every step.
- Connect free or keyed AI providers (OpenAI-compatible), or use the zero-network Offline Simulator.
- Browse ready recipes, LangChain cookbooks, LangChain Hub prompts and an extensions catalogue.
- XP, coins, ranks and quests built into the learning flow.

Live: https://langplay.lovable.app · In-app docs: `/docs`

## Quick start

```bash
bun install        # or npm install
bun run dev        # http://localhost:8080
bun run test       # unit tests (vitest)
bun run build      # production build
```

## Project layout

```
src/routes/        index.tsx (playground), docs.tsx (documentation), __root.tsx
src/lib/           lp-data, lp-llm, lp-models, lp-sources, lp-library
src/components/lp/ Settings drawer, Recipe Hub, overlays, effects, React Bits ports
src/test/          vitest suites
```

See `HANDOFF.md` for architecture, decisions and open work, and `AGENTS.md` for coding rules.

## Privacy

No backend. Settings, API keys and progress are stored only in the browser's localStorage.

## Credits

Animations adapted from [React Bits](https://reactbits.dev). Recipes and prompts sourced from LangChain cookbooks and the LangChain Hub, with links to originals.

## License

MIT — see `LICENSE`.
