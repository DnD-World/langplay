import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Langplay Docs — Simple guide and full reference" },
      {
        name: "description",
        content:
          "Learn Langplay two ways: a plain-English guide for beginners and a full technical reference.",
      },
      { property: "og:title", content: "Langplay Docs — Simple guide and full reference" },
      {
        property: "og:description",
        content: "A plain-English guide and a full technical reference for Langplay.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocsPage,
});

type Section = { id: string; title: string; body: React.ReactNode };

const ELI5: Section[] = [
  {
    id: "what",
    title: "What is Langplay?",
    body: (
      <p>
        Langplay is a toy box for building AI helpers. You snap steps together like LEGO bricks,
        press Run, and watch the AI work through them one by one.
      </p>
    ),
  },
  {
    id: "start",
    title: "Your first run in 30 seconds",
    body: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Leave Settings on <b>Offline Simulator</b> — it needs no internet or account.
        </li>
        <li>Type a question in the middle panel.</li>
        <li>
          Press <b>Run</b> and watch each step light up.
        </li>
        <li>
          Open the <b>Inspect Box</b> to read what happened in plain words.
        </li>
      </ol>
    ),
  },
  {
    id: "steps",
    title: "The steps (bricks)",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <b>Input</b> — the question you ask.
        </li>
        <li>
          <b>AI Thinking</b> — the AI reads and thinks, like a student working on homework.
        </li>
        <li>
          <b>Tool / Search</b> — the AI grabs a helper, like looking something up in a book.
        </li>
        <li>
          <b>Final Answer</b> — the AI writes its reply neatly.
        </li>
      </ul>
    ),
  },
  {
    id: "builder",
    title: "Changing your recipe",
    body: (
      <p>
        Use the arrows (or drag) to reorder steps. To delete one, <b>press and hold</b> the delete
        button — a quick tap does nothing, so you can't delete by accident.
      </p>
    ),
  },
  {
    id: "learn",
    title: "Learning the real names",
    body: (
      <p>
        Click any step and the right panel tells you what it is, what grown-up developers call it,
        and (if you flip the switch) the real Python code behind it.
      </p>
    ),
  },
  {
    id: "connect",
    title: "Using a real AI",
    body: (
      <p>
        Open <b>Settings</b>, pick a service, and press <b>Test Connection</b>. Green "Ready" means
        it works. Keep <b>Free only</b> on so you never pick something that costs money. Your keys
        stay only in this browser.
      </p>
    ),
  },
  {
    id: "library",
    title: "The Library",
    body: (
      <p>
        <b>Explore Library</b> has ready-made recipes, real examples from LangChain cookbooks,
        shared prompts from the Prompt Hub, and a list of tools and add-ons. Preview anything before
        you install it.
      </p>
    ),
  },
  {
    id: "game",
    title: "Points, coins and ranks",
    body: (
      <p>
        You earn XP and coins for learning moves — first run, first tool, peeking at code. Collect
        enough and you rank up from Novice Apprentice to Graph Overlord. There may be a secret code
        hidden somewhere…
      </p>
    ),
  },
];

const TECH: Section[] = [
  {
    id: "stack",
    title: "Stack",
    body: (
      <p>
        TanStack Start v1 (React 19, file-based routing, SSR) on Vite 7, Tailwind CSS v4 tokens in{" "}
        <code>src/styles.css</code>, shadcn/Radix UI, GSAP/motion for React Bits effects. Deployed
        as an edge worker. No backend; state lives in <code>localStorage</code> (
        <code>lp-settings</code>, <code>lp-game</code>, <code>lp-motion</code>).
      </p>
    ),
  },
  {
    id: "arch",
    title: "Architecture",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <code>src/lib/lp-data.ts</code> — step kinds, recipes, providers, ranks, quests.
        </li>
        <li>
          <code>src/lib/lp-llm.ts</code> — <code>chat()</code>: simulator, Puter SDK, or
          OpenAI-compatible <code>/chat/completions</code> with timeouts and HTTPS checks.
        </li>
        <li>
          <code>src/lib/lp-models.ts</code> — model-policy and free classification,{" "}
          <code>fetchModels()</code> with fallback.
        </li>
        <li>
          <code>src/lib/lp-sources.ts</code> — GitHub cookbook listing/reading and LangChain Hub
          pulls.
        </li>
        <li>
          <code>src/lib/lp-library.ts</code> — extension catalogue and schema-validated{" "}
          <code>parseRecipe()</code>.
        </li>
        <li>
          <code>src/components/lp/*</code> — Settings drawer, Recipe Hub, overlays, effects.
        </li>
      </ul>
    ),
  },
  {
    id: "exec",
    title: "Execution model",
    body: (
      <p>
        Steps run sequentially; each AI step sends the accumulated context to <code>chat()</code>.
        Tool/Search and Document steps return sample results (no real tool calls). Imported recipes
        are text-only — notebook code is never executed.
      </p>
    ),
  },
  {
    id: "free",
    title: "Free-model policy",
    body: (
      <p>
        A model counts as free only if verified: OpenRouter <code>:free</code> suffix or zero
        pricing, Puter <code>:free</code>, Meganova allowlist, tier providers with user-confirmed
        allowance, and local/simulator/Horde. With <b>Free only</b> on, <code>chat()</code> refuses
        unverified models.
      </p>
    ),
  },
  {
    id: "recipe",
    title: "Recipe JSON format",
    body: (
      <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs">{`{
  "title": "My recipe",
  "summary": "One sentence.",
  "steps": [
    { "kind": "input",  "label": "Question", "instructions": "..." },
    { "kind": "agent",  "label": "Think",    "instructions": "..." },
    { "kind": "tool",   "label": "Search",   "instructions": "..." },
    { "kind": "output", "label": "Answer",   "instructions": "..." }
  ]
}`}</pre>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        API keys stay in browser storage and are sent only to the chosen endpoint. External URLs
        must be HTTPS (HTTP only for localhost). Imports are validated before preview and install.
      </p>
    ),
  },
  {
    id: "dev",
    title: "Development",
    body: (
      <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs">{`bun install
bun run dev      # http://localhost:8080
bun run test     # vitest
bun run build`}</pre>
    ),
  },
];

function DocsPage() {
  const [mode, setMode] = useState<"eli5" | "tech">("eli5");
  const sections = mode === "eli5" ? ELI5 : TECH;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 text-foreground">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Langplay Docs</h1>
        <Button asChild variant="outline">
          <Link to="/">Back to playground</Link>
        </Button>
      </div>
      <div role="tablist" className="mb-6 inline-flex gap-1 rounded-xl border bg-card p-1">
        <Button
          role="tab"
          aria-selected={mode === "eli5"}
          variant={mode === "eli5" ? "default" : "ghost"}
          onClick={() => setMode("eli5")}
        >
          Simple guide
        </Button>
        <Button
          role="tab"
          aria-selected={mode === "tech"}
          variant={mode === "tech" ? "default" : "ghost"}
          onClick={() => setMode("tech")}
        >
          Technical reference
        </Button>
      </div>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="hidden md:block">
          <ul className="sticky top-6 space-y-1 text-sm">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  href={`#${s.id}`}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-4">
          {sections.map((s) => (
            <section
              key={s.id}
              id={s.id}
              className="rounded-2xl border bg-card p-5 leading-relaxed"
            >
              <h2 className="mb-2 text-xl font-semibold">{s.title}</h2>
              <div className="text-sm text-muted-foreground [&_b]:text-foreground [&_code]:text-primary">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
