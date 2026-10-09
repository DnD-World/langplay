# Changelog

All notable changes to this project are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

## [0.2.0] - 2026-10-09

### Added

- Windows app (Tauri): installer with uninstaller, its own window or your browser (127.0.0.1:20136, tray icon), Settings → Advanced → Update (signed, from GitHub Releases) and Repair.
- Offline AI in the Windows app: download a model (Qwen 2.5 0.5B / 1.5B, Llama 3.2 3B) and a pinned llama.cpp engine, checksum-verified, running on this computer with half the CPU cores.
- My AI connections: save several services (any OpenAI-compatible URL + key) and switch in one click; they also appear in Compare.
- Docs site with Dev / English / ELI5 reading levels and a live demo.
- Web version at langplay.stravelakis.com.
- Shared engine (`src/engine`) with AI-chosen routes, critic loops (with a limit), a 50-step guard and a full per-step trace (prompts, outputs, decisions, sources, time, tokens, cost when known).
- Real tools without keys: Wikipedia, DuckDuckGo instant answers, a calculator with its own parser, the clock.
- Your own documents: PDF/TXT/MD/CSV read in the browser, BM25 search, file-and-page citations.
- Graph canvas (React Flow) with labelled router paths, loop edges, drag-to-connect and full-screen editing.
- Save to My recipes, share by link (`#r=`), JSON export.
- Compare two AIs or two recipes side by side.
- 12 auto-checked lessons; new milestones and ranks; confetti on lesson completion.
- Spin out: tool page (`/tool`), embed, single HTML file, LangGraph Python + notebook, Claude skill, n8n workflow, MCP (stdio and Cloudflare Worker with token).
- Google Gemini provider and a "get a free key" guide for Gemini, Groq and OpenRouter.
- Safe Markdown rendering of AI answers.
- Repo standards doc set, CI workflow, secret-scan hook, NOTICE.

### Changed

- Default AI is free and real (Pollinations), backed by OVHcloud then the Simulator; every fallback is shown.
- Library recipes rewritten to use real routing, loops and tools.
- Page split into panels; recipe autosaves; phones show Live Run first.
- Practice-mode answers say plainly they are not a real AI.

### Fixed

- Autosave could overwrite saved data while the page loaded.
- AI Horde used a model name that no longer exists.
- Delete buttons repeated their label three times to screen readers.
- The logo only loaded on lovable.app.
- The letter background redrew every letter every frame (froze slow machines).

## [0.1.0] - 2026-10-08

### Added

- Initial Lovable prototype: linear recipes, Simulator and OpenAI-compatible providers, library, XP and quests.
