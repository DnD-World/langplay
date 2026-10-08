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
