# Langplay — evaluation (2026-10-09)

Local file, not committed. Source: code read in full + live site https://langplay.lovable.app driven in a browser.

## What it is
Browser-only "learn LangChain/LangGraph" toy. You stack blocks (Input → AI → Tool → Final), type a question, it runs top to bottom. XP/coins/ranks on top. Library browser for cookbooks, LangChain Hub prompts, MCP/skills directory.

## Health check (tested)
| Check | Result |
|---|---|
| Unit tests | 13/13 pass |
| Type check | clean |
| Build | OK |
| Lint | clean apart from Windows line endings (local checkout only) + ~25 small warnings |
| Live default run | works, but answer is simulator filler text |
| Pollinations (free, no key) from browser | works — real answer |
| OVH (free, no key) from browser | works — real answer |
| AI Horde preset | **broken** — `406 Model None not known` |
| LangChain Hub pull, GitHub cookbook list | work |
| Screenshot / visual / mobile | not checked — browser pane would not render a screenshot |

## Core problems
1. **It doesn't teach the "Graph" part.** Recipes are a straight list. No branches, no loops, no shared state. The "Smart Router" is a keyword regex and then carries on to the same next step either way. A learner never sees what LangGraph actually is (nodes + edges + state + conditional routing + cycles).
2. **First run gives nonsense.** Default AI is the Offline Simulator, whose reply is a canned template ("it's a bit like a recipe…"). Two free no-key providers work today and give real answers.
3. **Tool and Document steps are fake.** Hard-coded "Source A says…" text. Free, no-key, browser-friendly real options exist (Wikipedia API; local file upload + in-browser search).
4. **You can't see what each step did.** Inspect Box says "wrote a draft (315 characters)" — not the prompt sent or the text received. That *is* the lesson, and it's hidden.
5. **Work is lost on refresh.** Settings and XP are saved; the recipe you built is not. No export, no share link (import exists).
6. **The "Python code" is a fixed snippet per block type**, not code for *your* recipe.
7. **Game runs out in ~5 minutes.** 6 milestones, all trivial; then nothing to do.

## Smaller issues
- Screen readers hear "Hold to delete step / Deleted" three times per step (12 times for the default recipe).
- Each AI step only sees the previous draft; ordering is confusing (default recipe drafts the answer *before* searching).
- API keys sit in browser storage in plain text (acceptable for bring-your-own-key, but no warning shown).
- `src/routes/index.tsx` is one 384-line component with very long lines; run engine has no tests.
- Licence MIT; your standards say Apache-2.0 + NOTICE.

## Opportunities, ranked (human work hours)
| # | Change | Why | Hours |
|---|---|---|---|
| 1 | Default to Pollinations, fall back to Simulator automatically on error; fix/remove Horde | Real answer on first click | 1 |
| 2 | Step trace: click a step → see exact prompt in, text out, time taken | Turns it from toy into teacher | 3 |
| 3 | Save recipe locally + share-by-link + export JSON | Stop losing work; virality | 3 |
| 4 | Real Wikipedia search tool + "upload a PDF/text" document step (all in browser) | Tools stop being fake | 6 |
| 5 | Visual graph canvas (React Flow): branches, router with real AI decision, critic loop "until good / max 3" | Actually teaches LangGraph | 16–24 |
| 6 | "Export as Python" — generate runnable LangGraph code from the user's own recipe | Bridge from toy to real code | 6 |
| 7 | Lesson path: 10–15 guided challenges ("make refund questions go to billing") checked automatically | Gives the game a point | 8–12 |
| 8 | Side-by-side run: same question, two models or two recipes | Shows why structure matters | 4 |
| 9 | Cost/token meter per run | Teaches the money side | 2 |
| 10 | Split index.tsx, test the run engine, fix a11y repeat | Keeps it maintainable | 4 |
