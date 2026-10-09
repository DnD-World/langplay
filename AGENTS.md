<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Provider model pricing and account-allowance classification live in a browser-safe model-policy module; unverified models are excluded from free-only runs to avoid accidental charges.
- Public cookbook and prompt sources are read in the browser and imported only as reviewable text-prompt recipes with provenance links; notebook programs and external tools are never claimed to be executed.
- React Bits effects are lazy-loaded after hydration and honor reduced motion; this keeps browser animation libraries out of SSR execution.
- Workflow achievements are deduplicated with an immediate completion set and awarded only on deliberate learning actions, avoiding automatic or doubled rewards.
- Shared slide-overs and help bubbles use Radix portals with focus management and collision detection so content remains accessible inside frames and near viewport edges.
- Extension discovery uses a typed, source-attributed catalogue with explicit access and execution status; external services require separate consent and are never silently installed.
- External recipe JSON is schema-validated and previewed before installation; imported prompt variables must be filled before running.
- React Bits micro-controls use the shared Button and semantic theme tokens; browser-heavy effects load after hydration, with cleanup for timers and drawing loops.
- Motion effects mount as siblings of page content so changing animation preferences cannot remount the playground or discard unsaved work.
- Async connection and model-list results are applied only to the settings snapshot that started them, preventing late responses from overwriting a new provider selection.
- v2 (2026-10-09): one dependency-free engine in `src/engine` runs the app and every spun-out tool; exported files never contain user API keys; model output is rendered as text/safe Markdown only. See CONNECT-AGENTS.md and HANDOFF.md.
