# Guide: Langplay

The complete manual. Everything here also exists inside the app at `/docs` (simple guide + technical reference).

## Concepts

- **Recipe** — an ordered list of steps. Normally each step hands its result to the next; routers and critics can send the run somewhere else. That is a LangGraph _graph_.
- **Shared state** — every step reads and adds to the same memory: your question, the filled-in prompt, notes from tools (with sources), the current draft, reviewer feedback.
- **Trace** — the record of one run: for every step, exactly what was sent to the AI, what came back, any decision, sources, time, tokens and cost.

## Features

### Steps

| Step            | What it does                                                                                   | LangGraph name                |
| --------------- | ---------------------------------------------------------------------------------------------- | ----------------------------- |
| Input Prompt    | Fills `{question}` into a sentence                                                             | `ChatPromptTemplate`          |
| AI Thinking     | Writes a draft from everything so far                                                          | node + chat model             |
| Tool / Search   | Wikipedia, quick web answer, calculator, clock, or practice data; the AI writes the tool input | `@tool` + `ToolNode`          |
| Document Lookup | Finds the best passages in your files, cites file and page                                     | retriever (RAG)               |
| Smart Router    | The AI picks one named path                                                                    | `add_conditional_edges`       |
| Critic          | Says PASS or REVISE; can loop back to an earlier step (max 1–5 times)                          | conditional edge back = cycle |
| Final Answer    | Writes the reply; the run ends here                                                            | `END`                         |

### Building

- **How to use it:** Steps tab — click a step to edit its name and instructions; drag or use ↑↓ to reorder; press and hold × to delete. "After this step" lets any step jump elsewhere. Router: name the paths and pick where each goes. Critic: "If the draft needs work → send back to…".
- **Graph tab:** same recipe as boxes and arrows. Drag from a dot to connect; select an arrow and press Delete to unlink; Full screen shows the step editor alongside; Tidy up re-lays it out.
- **Limits:** 40 steps; a run stops after 50 steps (loop guard).

### Running and inspecting

- **How to use it:** type a question, press Run (or Stop). Click any line in the Inspect Box to open it.
- **Compare:** switch it on, pick B (another AI, or one of your/library recipes); both run at once.
- **Cost:** tokens always; money only when the provider publishes a price (OpenRouter) or the service is free.

### AI services

- **Default:** Pollinations (no key), backed by OVHcloud (no key), then the offline practice Simulator. Each fallback is noted in the trace.
- **Free with a key:** Google Gemini, Groq, OpenRouter — Settings shows a 2-minute guide for each.
- **Others:** OpenAI, Mistral, Cerebras, Cohere, NVIDIA, Ollama Cloud, SEA-LION, Meganova, local Ollama/LM Studio, Puter, any OpenAI-compatible URL.
- **Free only** hides models whose price or allowance is not verified.

### Your documents

- **How to use it:** Documents → drop PDF/TXT/MD/CSV (15 MB each, ~3 million characters total).
- **Limits:** scanned PDFs have no text (run OCR first). Stored in this browser only (IndexedDB).

### Save, share, export

- **Save** keeps a copy in **Mine** (up to 50). **Share** copies a link; the recipe is inside the link after `#` and never reaches a server. Opening someone's link keeps your current recipe in Mine. **Export** downloads JSON; the Library's Import tab reads it back.

### Lessons and rewards

12 lessons (chain → prompt template → Wikipedia → calculator → RAG → routing → third path → loop → drawing an edge → comparing → Python → shipping). Each completes only when the run or recipe shows you did it. Milestones and lessons give XP, coins and ranks.

### Spin out

| Format       | How to use                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Tool page    | Copy the `/tool#r=…` link. On phones, "Add to Home screen".                                                               |
| Embed        | Paste the iframe into a "Custom HTML" block (WordPress) or any HTML block.                                                |
| HTML file    | One file (~30 KB). Open from disk or upload anywhere. Reads .txt/.md documents.                                           |
| Python       | `pip install -U langgraph langchain-openai requests` then `python file.py "question"`; or upload the notebook to Colab.   |
| Claude skill | Upload the zip in Claude (Settings → Capabilities → Skills) or unzip into `~/.claude/skills/`; or copy the system prompt. |
| n8n          | Import the JSON, edit the Settings node, activate, POST `{"question": "…"}` to `/webhook/langplay-<name>`.                |
| MCP (local)  | Add the `.mjs` file to Claude Desktop's config (shown in the dialog) or `claude mcp add`. Needs Node 20+.                 |
| MCP (cloud)  | Unzip, `npx wrangler secret put LANGPLAY_TOKEN`, `npx wrangler deploy`. Requests without the token get 401.               |

Spun-out tools never contain your API key. Set `LANGPLAY_BASE_URL`, `LANGPLAY_MODEL`, `LANGPLAY_API_KEY` where they run to use your own service.

### Windows app

- **Install:** run `Langplay_x.y.z_x64-setup.exe` (no admin rights). "Unknown publisher" warning → More info → Run anyway.
- **Window or browser:** Settings → Open Langplay in. Browser mode serves the app on `127.0.0.1:20136` (this computer only) and puts a tray icon with Open / Switch to window / Quit.
- **Offline AI:** Settings → Offline AI → Get this model (0.5, 1.1 or 2.0 GB, plus an 18 MB engine the first time). Downloads are checked against known checksums. "Use offline" starts it with half your processor cores and switches Langplay to it; Stop frees the computer again.
- **Update / Repair:** Settings → Advanced. Your recipes, settings, progress and models are kept.
- **Uninstall:** Windows Settings → Apps → Installed apps → Langplay.

## Configuration

| Setting                | Default               | What it does                                                                           |
| ---------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| Provider / model       | Pollinations · openai | Which AI answers                                                                       |
| Free only              | off                   | Hide unverified-price models                                                           |
| Motion                 | on                    | Background letters, glows, sparks, confetti (also off with the system's reduce-motion) |
| Spin-out "who answers" | Free AI               | Pollinations→OVH→practice, OVH, visitor's own key, or practice                         |

## Troubleshooting

| Symptom                                 | Cause                                                    | Fix                                              |
| --------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| Answer starts with "🧪 Practice answer" | The AI service did not answer (limit reached or blocked) | Get a free key (Settings guide) or wait a minute |
| "replied (402)" in the trace            | Pollinations' free allowance is used up                  | Use a free key or OVH                            |
| "replied (429)"                         | Rate limit                                               | Wait a minute; free keys have higher limits      |
| Document Lookup says "practice notes"   | No document added, or nothing matched                    | Add a file; use words that appear in it          |
| A PDF says "no readable text"           | Scanned images, no text layer                            | OCR it first                                     |
| Shared link shows "damaged"             | Link cut off when pasted                                 | Copy the whole link                              |

## FAQ

**Do I need to code?** No. The Python export is there when you want to.

**Where is my data?** In your browser: settings, progress, recipes (localStorage) and documents (IndexedDB). Questions go to the AI service you choose.

**Can someone see my API key in a shared link or exported tool?** No — keys are never included.
