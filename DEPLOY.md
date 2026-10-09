# Deploy: Langplay

## Where it runs

1. **Web:** https://langplay.stravelakis.com — Cloudflare Workers (custom domain on the stravelakis.com zone). Deploy with `bun run deploy:web` after `npx wrangler login`.
2. **Lovable:** https://langplay.lovable.app — commits merged into `main` sync into the Lovable project; it updates when **Publish** is clicked in Lovable.
3. **Windows app:** coming (Tauri, built by GitHub Actions, published as GitHub Releases).

## Environment variables

None for the app (see `.env.example`).

## Release

Follow the release gate in STANDARDS.md §2 (README/HANDOFF current, full audit, `gitleaks git -v` clean, CHANGELOG entry), then:

1. Merge the PR into `main` (CI must be green).
2. Lovable → Publish.
3. Web: `bun run deploy:web` (needs a `npx wrangler login` session).
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
