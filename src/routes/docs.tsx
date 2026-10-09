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
        press Run, and watch a real AI work through them — then turn what you built into your own
        tool.
      </p>
    ),
  },
  {
    id: "start",
    title: "Your first run in 30 seconds",
    body: (
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Type a question in <b>Live Run</b> and press <b>Run</b>. A free AI answers.
        </li>
        <li>Watch each step light up in the builder.</li>
        <li>
          Open the <b>Inspect Box</b> and click a step to see exactly what was sent to the AI and
          what came back.
        </li>
        <li>
          Follow the <b>Lessons</b> card on the right — twelve small challenges.
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
          <b>Input Prompt</b> — fills your question into a sentence, like mad-libs.
        </li>
        <li>
          <b>AI Thinking</b> — the AI writes a draft.
        </li>
        <li>
          <b>Tool / Search</b> — a real tool: Wikipedia, a quick web answer, a calculator or a
          clock.
        </li>
        <li>
          <b>Document Lookup</b> — searches files you add and quotes the page.
        </li>
        <li>
          <b>Smart Router</b> — the AI picks which path to take next.
        </li>
        <li>
          <b>Critic</b> — checks the draft and can send it back to be redone (a loop).
        </li>
        <li>
          <b>Final Answer</b> — writes the reply neatly.
        </li>
      </ul>
    ),
  },
  {
    id: "builder",
    title: "Changing your recipe",
    body: (
      <p>
        <b>Steps</b> shows a list: drag or use the arrows to reorder, click a step to edit it, and
        press-and-hold × to delete. <b>Graph</b> shows the same recipe as boxes and arrows: drag
        from the dot under one step to another to connect them. Routers get one dot per path; a
        critic&apos;s side dot makes a loop.
      </p>
    ),
  },
  {
    id: "connect",
    title: "Which AI answers",
    body: (
      <p>
        By default a free service answers (Pollinations, then OVHcloud). Free services only allow a
        few questions, so for lots of runs open <b>Settings</b>, pick <b>Google Gemini</b>,{" "}
        <b>Groq</b> or <b>OpenRouter</b>, and follow the 2-minute guide to get a free key. If a
        service does not answer, the step uses the offline practice Simulator and says so.
      </p>
    ),
  },
  {
    id: "docs",
    title: "Your own documents",
    body: (
      <p>
        Press <b>Documents</b> and drop in a PDF or text file. It is read inside your browser and
        kept on your device — nothing is uploaded. The Document Lookup step finds the best passages
        and names the page.
      </p>
    ),
  },
  {
    id: "save",
    title: "Save, share and compare",
    body: (
      <p>
        <b>Save</b> keeps a copy in <b>Mine</b>. <b>Share</b> copies a link that opens your recipe
        for anyone. <b>Export</b> downloads it as a file. Switch on <b>Compare</b> to run one
        question through two AIs or two recipes side by side, with time and cost.
      </p>
    ),
  },
  {
    id: "spin",
    title: "Spin out your own tool",
    body: (
      <p>
        <b>Spin out</b> turns a recipe into something real: a tool page link, a widget for your
        website, a single HTML file, Python code, a Claude skill, an n8n workflow, or an MCP tool
        Claude can call. Your API key is never put inside them.
      </p>
    ),
  },
  {
    id: "game",
    title: "Points, lessons and ranks",
    body: (
      <p>
        Lessons and milestones give XP and coins, from Novice Apprentice up to LangGraph Legend.
        Lessons only tick when you really do the thing. There may be a secret code hidden somewhere…
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
        TanStack Start v1 (React 19, SSR) on Vite, Tailwind v4 tokens in <code>src/styles.css</code>
        , shadcn/Radix, React Flow for the graph, pdf.js for PDFs. No backend; state lives in{" "}
        <code>localStorage</code> (<code>lp-settings</code>, <code>lp-game</code>,{" "}
        <code>lp-recipe</code>, <code>lp-recipes</code>, <code>lp-motion</code>) and IndexedDB (
        <code>lp-docs</code>).
      </p>
    ),
  },
  {
    id: "engine",
    title: "Engine",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <code>src/engine</code> — dependency-free runner shared by the app and every spin-out.
        </li>
        <li>
          Recipe = ordered <code>nodes</code>; <code>next</code> is an edge, router{" "}
          <code>routes</code> and critic <code>retryTo</code> are conditional edges (cycles
          allowed).
        </li>
        <li>
          Shared state: question, context, notes (with sources), draft, feedback, loops. 50-step
          guard.
        </li>
        <li>
          Every step records a trace: messages sent, output, decision, sources, time, tokens,
          provider and notes.
        </li>
        <li>
          Failures fall back to a free backup (Pollinations → OVH) or the Simulator, and the trace
          says so.
        </li>
        <li>
          Cost: tokens always; money only when the provider published a price (OpenRouter) or is
          free.
        </li>
      </ul>
    ),
  },
  {
    id: "tools",
    title: "Tools and documents",
    body: (
      <p>
        Browser-safe, no keys: Wikipedia search, DuckDuckGo instant answers (falls back to
        Wikipedia), a calculator with its own parser (no <code>eval</code>), the clock, and labelled
        practice data. With a real AI the model writes the tool input; with the Simulator it is
        derived from the question. Documents are chunked and ranked with BM25 in the browser.
      </p>
    ),
  },
  {
    id: "spinouts",
    title: "Spin-outs",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <code>vite-plugins/langplay-runtime.ts</code> bundles the engine and runner UI into
          strings (<code>virtual:langplay-runtime</code>).
        </li>
        <li>
          Tool page <code>/tool#r=…</code> (+ <code>?embed=1</code>) and the single HTML file use{" "}
          <code>src/runner/ui.ts</code>; model output is inserted as text only.
        </li>
        <li>
          <code>src/export/</code>: LangGraph Python and notebook, SKILL.md zip, n8n workflow, MCP
          stdio script, Cloudflare Worker with Bearer token.
        </li>
        <li>
          Recipes travel compressed (deflate-raw, base64url) after <code>#r=</code>, never sent to a
          server.
        </li>
      </ul>
    ),
  },
  {
    id: "free",
    title: "Free-model policy",
    body: (
      <p>
        A model counts as free only if verified: OpenRouter <code>:free</code> or zero pricing,
        Puter <code>:free</code>, Meganova allowlist, tier providers (incl. Gemini) with
        user-confirmed allowance, keyless free tiers, local and Simulator. With <b>Free only</b> on,
        unverified models are refused.
      </p>
    ),
  },
  {
    id: "recipe",
    title: "Recipe JSON format",
    body: (
      <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs">{`{
  "version": 2,
  "title": "Smart Support Router",
  "summary": "One sentence.",
  "nodes": [
    { "id": "in", "kind": "input", "label": "Input", "instruction": "Customer says: {question}" },
    { "id": "route", "kind": "router", "label": "Router", "instruction": "Billing or tech?",
      "routes": [{ "label": "billing", "to": "bill" }, { "label": "tech", "to": "tech" }] },
    { "id": "bill", "kind": "agent", "label": "Billing", "instruction": "...", "next": "final" },
    { "id": "tech", "kind": "agent", "label": "Tech", "instruction": "..." },
    { "id": "final", "kind": "final", "label": "Answer", "instruction": "Under 80 words." }
  ]
}
// Tool steps: "tool": "wikipedia" | "websearch" | "calculator" | "datetime" | "sample"
// Critic loops: "retryTo": "<node id>", "maxLoops": 1-5
// Older { "steps": [...] } recipes still import.`}</pre>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Keys stay in browser storage, are sent only to the chosen endpoint, and are never exported.
        External URLs must be HTTPS (HTTP only for localhost). Imports and links are validated;
        unknown fields are dropped and nothing imported is executed. Spun-out Workers refuse
        requests without their token.
      </p>
    ),
  },
  {
    id: "dev",
    title: "Development",
    body: (
      <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs">{`bun install
bun run dev      # Lovable uses 8080; locally: vite dev --port 20136
bun run test     # vitest
bun run lint
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
