# Deploy: Langplay

## Where it runs

1. **Lovable (primary):** https://langplay.lovable.app. Commits merged into `main` sync into the Lovable project; the site updates when **Publish** is clicked in Lovable.
2. **Cloudflare Workers (copy, optional):** the build already produces a Worker (`.output/server/wrangler.json`, TanStack Start + Nitro). Not live yet — see below.

## Environment variables

None for the app (see `.env.example`).

## Release

Follow the release gate in STANDARDS.md §2 (README/HANDOFF current, full audit, `gitleaks git -v` clean, CHANGELOG entry), then:

1. Merge the PR into `main` (CI must be green).
2. Lovable → Publish.
3. Optional Cloudflare copy:
   ```bash
   bun run build
   npx wrangler deploy --config .output/server/wrangler.json
   ```
   Needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the environment, plus either a registered `workers.dev` subdomain or a custom-domain route (e.g. `routes = [{ pattern = "langplay.dnd-world.com", custom_domain = true }]`) — both are one-time account/DNS changes the owner must approve.
4. Tag `vX.Y.Z` and publish the GitHub Release.

## Rollback

- Lovable: open the project history and restore the previous version, then Publish.
- Git: `git revert <merge commit>` on a branch, PR, merge. Never force-push `main` (it rewrites Lovable's history).
- Cloudflare: `npx wrangler rollback`.

## After deploying, check

- [ ] Home page runs a recipe with the default AI (and falls back cleanly if it is busy)
- [ ] `/tool#r=…` link from Spin out opens and runs
- [ ] `/docs` loads
- [ ] Browser console shows no new errors
