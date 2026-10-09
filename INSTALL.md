# Install: Langplay

Langplay is a website, so there is nothing to install to use it: open https://langplay.lovable.app.

## From source

### Requirements

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
