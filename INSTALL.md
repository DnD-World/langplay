# Install: Langplay

## Windows (installer)

1. Download `Langplay_x.y.z_x64-setup.exe` from the [latest release](https://github.com/DnD-World/langplay/releases/latest).
2. Run it. It installs for your user only (no admin rights). Windows may say "unknown publisher" because the app is not code-signed: choose **More info → Run anyway**.
3. Open Langplay from the Start menu. Settings → **Open Langplay in** chooses its own window or your browser.

Update or repair: **Settings → Advanced**. Uninstall: Windows **Settings → Apps → Installed apps → Langplay**. Your recipes, settings and offline models are kept in `%APPDATA%\com.stravelakis.langplay` and `%LOCALAPPDATA%\com.stravelakis.langplay`.

## Web

Nothing to install: https://langplay.stravelakis.com

## From source

### Requirements

- For the Windows app build: Rust and the MSVC build tools (or let GitHub Actions build it — see DEPLOY.md)
- [Bun](https://bun.sh) 1.3+ (or Node 22 with `npx bun@1.3.0 …`)
- [gitleaks](https://github.com/gitleaks/gitleaks#installing) for the pre-commit secret check

### Steps

```bash
git clone https://github.com/DnD-World/langplay.git
cd langplay
git config core.hooksPath githooks
bun install
bun run dev:local
```

No `.env` is needed (see `.env.example`).

### Check it works

Open http://localhost:20136, type a question and press Run. Locally, Pollinations refuses `localhost` requests, so pick **OVHcloud AI Endpoints** in Settings (or a free key) to see real answers; the Simulator always works.

```bash
bun run test        # 58 tests
bun run lint
bun run typecheck
bun run build
```
