## What it is

Langplay teaches LangChain and LangGraph — the popular toolkits for building AI apps — without code. You build a *recipe*: a few steps that turn a question into an answer. Run it, and watch every step: what the AI was asked, what it said, which tool it used, which path it chose.

## Install

1. Download **Langplay_x.y.z_x64-setup.exe** from the latest release and run it.
2. Open Langplay from the Start menu.
3. Ask a question and press **Run**.

Prefer no install? Use the web version at langplay.stravelakis.com.

## Which AI answers

- **Straight after install:** free services answer, but only a few questions at a time.
- **For real use:** open **Settings** and pick Google Gemini, Groq or OpenRouter — each has a 2-minute guide to a free key — or any of 19 services, or type the address of any OpenAI-compatible service. Save several under **My AI connections**.
- **No internet, no key:** in the Windows app, **Settings → Offline AI** downloads a model (0.5–2 GB) that runs on your computer.

Your keys stay on your computer and are never put into anything you export.

## The steps

| Step | What it does |
|---|---|
| Input Prompt | Fills your question into a sentence |
| AI Thinking | Writes a draft |
| Tool / Search | Wikipedia, a quick web answer, a calculator or the clock |
| Document Lookup | Finds passages in your PDFs and names the page |
| Smart Router | The AI picks which path to follow |
| Critic | Checks the draft and can send it back to be redone |
| Final Answer | Writes the reply |

Edit them as a list, or open **Graph** to draw arrows between them.

## Learn, compare, share

- **Lessons:** twelve small challenges on the right; each ticks itself off when you do it.
- **Compare:** run one question through two AIs or two recipes side by side, with time and cost.
- **Save / Share / Export:** keep recipes, copy a link that opens one, or download it as a file.

## Spin out

**Spin out** turns a recipe into your own tool: a page link, a widget for your website, a single HTML file, Python code, a Claude skill, an n8n workflow, or an MCP tool Claude can call.

## Window or browser

Settings → **Open Langplay in**: its own window, or a tab in your usual browser (it stays on your computer; a tray icon lets you quit).

## Update, repair, uninstall

- **Settings → Advanced → Update** installs the newest release.
- **Repair** reinstalls the same version. Recipes, settings and models are kept.
- Uninstall from Windows **Settings → Apps → Installed apps**.

## Troubleshooting

| You see | Do this |
|---|---|
| "🧪 Practice answer" | The free AI is busy or used up. Add a free key, or use Offline AI. |
| "replied (402)" or "(429)" | A free limit was reached. Wait a minute or use your own key. |
| Windows says "unknown publisher" | Choose *More info → Run anyway* (the app is not code-signed). |
| A PDF has "no readable text" | It is a scan; run it through OCR first. |
