# Deploy: Langplay

## Where it runs

1. **Web:** https://langplay.stravelakis.com — Cloudflare Workers (custom domain on the stravelakis.com zone). Deploy with `bun run deploy:web` after `npx wrangler login`.
2. **Lovable:** https://langplay.lovable.app — commits merged into `main` sync into the Lovable project; it updates when **Publish** is clicked in Lovable.
3. **Windows app:** Tauri installer built by GitHub Actions (`.github/workflows/desktop.yml`) and published as a GitHub Release with a signed `latest.json` for in-app updates.
4. **Docs site:** https://dnd-world.github.io/langplay/ — `docs-site/`, deployed by `.github/workflows/docs-site.yml` on version tags.

## Environment variables

None for the app (see `.env.example`).

## Release

Follow the release gate in STANDARDS.md §2 (README/HANDOFF current, full audit, `gitleaks git -v` clean, CHANGELOG entry), then:

1. Bump the version in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`; add the CHANGELOG entry.
2. Merge the PR into `main` (CI green, Windows build green).
3. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`. GitHub builds the installer, signs the update and publishes the Release; the docs site redeploys.
4. Web: `bun run deploy:web` (needs a `npx wrangler login` session). Lovable: Publish.

The update-signing private key is a GitHub secret (`TAURI_SIGNING_PRIVATE_KEY`, empty password) with a copy in the owner's private key store. Losing it means existing installs can no longer auto-update.

## Rollback

- Lovable: open the project history and restore the previous version, then Publish.
- Git: `git revert <merge commit>` on a branch, PR, merge. Never force-push `main` (it rewrites Lovable's history).
- Cloudflare: `npx wrangler rollback`.
- Windows app: mark the bad GitHub Release as a draft and re-publish the previous one as "latest" (apps check `releases/latest/download/latest.json`).

## After deploying, check

- [ ] Home page runs a recipe with the default AI (and falls back cleanly if it is busy)
- [ ] `/tool#r=…` link from Spin out opens and runs
- [ ] `/docs` loads
- [ ] Browser console shows no new errors
