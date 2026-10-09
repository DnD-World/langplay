import { useRef, useState } from "react";
import { CATEGORIES, KINDS, type Category } from "@/lib/lp-data";
import { RECIPES } from "@/lib/lp-recipes";
import type { Recipe } from "@/engine";
import { Overlay } from "./Overlay";
import { Info, Label, inputCls, btn } from "./Info";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "./AnimatedIcon";
import { ExtensionsLibrary } from "./ExtensionsLibrary";
import BorderGlow from "./react-bits/BorderGlow";
import { humanize, describeExample, parseRecipe } from "@/lib/lp-library";
import {
  SOURCES,
  listSource,
  readSource,
  pullHub,
  promptRecipe,
  type SourceFile,
} from "@/lib/lp-sources";

export function RecipeHub({
  open,
  onClose,
  onInstall,
}: {
  open: boolean;
  onClose: () => void;
  onInstall: (r: Recipe) => void;
}) {
  const [tab, setTab] = useState<"browse" | "sources" | "hub" | "extensions" | "import">("browse");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState("");

  const [source, setSource] = useState(SOURCES[0]?.id ?? "langchain-ai/cookbooks");
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [selected, setSelected] = useState<SourceFile | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [overview, setOverview] = useState("");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [chosenPrompt, setChosenPrompt] = useState("");
  const [hubName, setHubName] = useState("rlm/rag-prompt");
  const [hubSource, setHubSource] = useState("");
  const [sourceCategory, setSourceCategory] = useState("All");
  const [sort, setSort] = useState("name");
  const [reviewedImport, setReviewedImport] = useState<Recipe | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const requestId = useRef(0);
  const placeholders = [
    ...new Set(
      [...chosenPrompt.matchAll(/(?<!\{)\{([a-zA-Z_]\w*)\}(?!\})/g)]
        .map((m) => m[1] ?? "")
        .filter((k) => k && k !== "question"),
    ),
  ];
  const prepared = chosenPrompt.replace(/(?<!\{)\{([a-zA-Z_]\w*)\}(?!\})/g, (all, key: string) =>
    key === "question" ? all : fields[key]?.trim() || all,
  );
  const missing = placeholders.some((k) => !fields[k]?.trim());
  const [busy, setBusy] = useState(false);
  const loadSource = async () => {
    const id = ++requestId.current;
    setBusy(true);
    setMsg("");
    setSelected(null);
    setFiles([]);
    try {
      const result = await listSource(source);
      if (id === requestId.current) setFiles(result);
    } catch (e) {
      if (id === requestId.current)
        setMsg(e instanceof Error ? e.message : "Could not load source");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  };
  const openFile = async (file: SourceFile) => {
    const id = ++requestId.current;
    setBusy(true);
    setMsg("");
    setSelected(file);
    setChosenPrompt("");
    setSourceText("");
    setOverview("");
    setRequirements([]);
    setPrompts([]);
    setFields({});
    try {
      const result = await readSource(file);
      if (id === requestId.current) {
        setSourceText(result.text);
        setOverview(result.overview);
        setRequirements(result.requirements);
        setPrompts(result.prompts);
        setChosenPrompt(result.prompts[0] ?? "");
      }
    } catch (e) {
      if (id === requestId.current)
        setMsg(e instanceof Error ? e.message : "Could not open example");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  };
  const extraFields = (
    <>
      {placeholders.map((k) => (
        <div key={k}>
          <Label tip="Fill this missing part so your imported prompt can run without empty blanks.">
            {k.replaceAll("_", " ")}
          </Label>
          <textarea
            aria-label={`Prompt value ${k}`}
            className={inputCls}
            value={fields[k] ?? ""}
            onChange={(e) => setFields((old) => ({ ...old, [k]: e.target.value }))}
          />
        </div>
      ))}
    </>
  );
  const list = RECIPES.filter(
    (r) =>
      (!cat || r.categories.includes(cat)) &&
      (r.title + r.summary).toLowerCase().includes(q.toLowerCase()),
  );

  const doImport = async () => {
    setMsg("");
    try {
      let text = raw.trim();
      if (/^https?:\/\//.test(text)) {
        const url = new URL(text);
        if (url.protocol !== "https:") throw new Error("Use a secure HTTPS recipe link.");
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          credentials: "omit",
        });
        if (!response.ok) throw new Error("Could not read this recipe link.");
        text = await response.text();
      }
      setReviewedImport(parseRecipe(text));
    } catch (e) {
      setMsg(
        e instanceof Error
          ? e.message
          : "Hmm, that doesn't look like a valid recipe. It needs a list of 'steps'.",
      );
    }
  };

  return (
    <Overlay open={open} onClose={onClose} wide>
      <h2 className="text-xl font-bold">
        <AnimatedIcon name="blocks" /> Explore Library
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Recipes · Prompts · Tools · MCPs · Plugins · Skills
      </p>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border p-1">
        {(["browse", "sources", "hub", "extensions", "import"] as const).map((t) => (
          <Button
            variant="ghost"
            key={t}
            onClick={() => {
              setTab(t);
              setMsg("");
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "border text-foreground"}`}
          >
            {
              {
                browse: "Recipes",
                sources: "Cookbooks",
                hub: "Prompt Hub",
                extensions: "Extensions",
                import: "Import",
              }[t]
            }
          </Button>
        ))}
      </div>

      {tab === "browse" ? (
        <>
          <div className="mb-3 flex items-center gap-2">
            <AnimatedIcon name="tool" />
            <input
              className={inputCls}
              placeholder="Search recipes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Info tip="Type a word to find recipes that mention it." />
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Button
                variant="ghost"
                key={c}
                onClick={() => setCat(cat === c ? null : c)}
                className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${cat === c ? "border-accent bg-accent text-accent-foreground" : "hover:border-accent"}`}
              >
                {c}
              </Button>
            ))}
            <Info tip="Tap a category to only show recipes of that kind." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((r) => (
              <BorderGlow key={r.id}>
                <article className="flex h-full flex-col p-4">
                  <h3 className="font-bold">{r.title}</h3>
                  <p className="mb-3 mt-1 text-sm text-muted-foreground">{r.summary}</p>
                  <div className="mb-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                    <span className="rounded bg-primary/15 px-2 py-0.5 text-primary">
                      {r.difficulty}
                    </span>
                    {r.tools.map((t) => (
                      <span key={t} className="rounded bg-muted px-2 py-0.5">
                        <AnimatedIcon name="tool" /> {t}
                      </span>
                    ))}
                    <span className="rounded bg-coin/15 px-2 py-0.5 text-coin">
                      <AnimatedIcon name="coin" /> {r.cost}
                    </span>
                  </div>
                  {inspect === r.id && (
                    <div className="mb-3 flex flex-wrap items-center gap-1 rounded-lg bg-background/60 p-2 text-xs">
                      {r.nodes.map((s, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="rounded border px-1.5 py-0.5">
                            <AnimatedIcon name={s.kind} /> {s.label ?? KINDS[s.kind].title}
                          </span>
                          {i < r.nodes.length - 1 && <span className="text-primary">→</span>}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => setInspect(inspect === r.id ? null : r.id)}
                      className={`${btn} border hover:bg-secondary`}
                    >
                      Inspect
                    </Button>
                    <Button
                      onClick={() => {
                        onInstall(r);
                        onClose();
                      }}
                      className={`${btn} flex-1 hover:brightness-110`}
                    >
                      <AnimatedIcon name="spark" /> Install · +40 XP
                    </Button>
                  </div>
                </article>
              </BorderGlow>
            ))}
          </div>
        </>
      ) : tab === "sources" ? (
        <div className="space-y-4">
          <Label tip="Choose which public collection to browse; originals stay linked to their authors.">
            Collection
          </Label>
          <select
            className={inputCls}
            aria-label="Cookbook collection"
            value={source}
            onChange={(e) => {
              ++requestId.current;
              setBusy(false);
              setSource(e.target.value);
              setFiles([]);
              setSelected(null);
            }}
          >
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={loadSource} disabled={busy}>
            <AnimatedIcon name="retriever" />
            {busy ? "Loading…" : "Load examples"}
          </Button>
          <Info tip="Read the latest public files from this collection without needing a GitHub account." />
          <input
            aria-label="Search cookbook files"
            className={inputCls}
            placeholder="Search example names…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Info tip="Filter examples by words in their name." />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label tip="Filter examples by their likely learning topic, based on the file name.">
                Topic
              </Label>
              <select
                className={inputCls}
                aria-label="Cookbook topic"
                value={sourceCategory}
                onChange={(e) => setSourceCategory(e.target.value)}
              >
                {[
                  "All",
                  "Beginner Friendly",
                  "Document Q&A",
                  "Multi-Agent",
                  "Tool User",
                  "Evaluation",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <Label tip="Sort examples alphabetically or group them by learning topic.">
                Sort
              </Label>
              <select
                className={inputCls}
                aria-label="Sort cookbook examples"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="name">Name A–Z</option>
                <option value="topic">Topic</option>
              </select>
            </div>
          </div>
          <p role="status" className="text-xs text-muted-foreground">
            {files.length} source files loaded · Topic summaries are inferred from names; open an
            example to verify.
          </p>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {files
              .filter(
                (f) =>
                  f.path.toLowerCase().includes(q.toLowerCase()) &&
                  (sourceCategory === "All" || describeExample(f.path).category === sourceCategory),
              )
              .sort((a, b) =>
                sort === "topic"
                  ? describeExample(a.path).category.localeCompare(
                      describeExample(b.path).category,
                    ) || a.path.localeCompare(b.path)
                  : a.path.localeCompare(b.path),
              )
              .map((f) => (
                <article key={f.path} className="border-b py-3">
                  <h3 className="font-bold text-sm">{humanize(f.path)}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {describeExample(f.path).summary}
                  </p>
                  <p className="text-xs text-primary mt-1">
                    {describeExample(f.path).category} ·{" "}
                    {f.path.endsWith(".ipynb")
                      ? "Notebook"
                      : f.path.endsWith(".py")
                        ? "Python example"
                        : "Guide"}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={busy}
                    onClick={() => openFile(f)}
                  >
                    <AnimatedIcon name="inspect" />
                    Open learning preview
                  </Button>
                </article>
              ))}
          </div>
          {selected && (
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-lg font-bold">{humanize(selected.path)}</h3>
              <p className="text-sm">{describeExample(selected.path).summary}</p>
              <p className="text-xs text-muted-foreground">
                {describeExample(selected.path).needs}
              </p>
              <a
                className="text-primary underline text-sm"
                href={selected.url}
                target="_blank"
                rel="noreferrer"
              >
                Original example ↗
              </a>
              <p className="text-xs text-muted-foreground">
                Text-only prompt adaptation. Tools, document stores and notebook programs are not
                imported.
              </p>
              {overview && (
                <div className="border-y py-3">
                  <h4 className="text-xs font-bold">From the author</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{overview}</p>
                </div>
              )}
              {requirements.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold">Connections mentioned in the example</h4>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {requirements.map((r) => (
                      <li key={r}>
                        {r.replace(/_(?:API_KEY|TOKEN|BASE_URL)$/, "").replaceAll("_", " ")} ·
                        external account or connection
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <details>
                <summary className="cursor-pointer rounded-md border px-3 py-2 text-sm hover:bg-secondary">
                  View original text
                </summary>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs mt-2">
                  {sourceText.slice(0, 50000)}
                </pre>
              </details>
              {prompts.length > 0 && (
                <select
                  aria-label="Extracted prompt"
                  className={inputCls}
                  value={chosenPrompt}
                  onChange={(e) => setChosenPrompt(e.target.value)}
                >
                  {prompts.map((p, i) => (
                    <option key={i} value={p}>
                      Prompt {i + 1}: {p.slice(0, 70)}
                    </option>
                  ))}
                </select>
              )}
              <Label tip="Review the extracted prompt, or paste a prompt from the original example; replace missing blanks before running.">
                Prompt text
              </Label>
              <textarea
                className={`${inputCls} h-44`}
                value={chosenPrompt}
                onChange={(e) => setChosenPrompt(e.target.value)}
                placeholder="No plain prompt found automatically. Paste a prompt from the original above."
              />
              {extraFields}
              <Button
                disabled={!chosenPrompt.trim() || busy || missing}
                onClick={() => {
                  onInstall(promptRecipe(humanize(selected.path), prepared, selected.url));
                  onClose();
                }}
              >
                <AnimatedIcon name="spark" />
                Install prompt recipe
              </Button>
            </div>
          )}
        </div>
      ) : tab === "hub" ? (
        <div className="space-y-4">
          <a
            href="https://smith.langchain.com/hub"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline text-sm"
          >
            Browse public LangSmith prompts ↗
          </a>
          <div className="flex flex-wrap gap-2">
            {[
              { name: "rlm/rag-prompt", summary: "Answer using document passages you provide." },
              {
                name: "hwchase17/react",
                summary:
                  "Inspect an agent prompt; tool placeholders need your own descriptions, not a live connection.",
              },
            ].map((p) => (
              <Button
                variant="outline"
                className="h-auto whitespace-normal text-left"
                key={p.name}
                onClick={() => {
                  setHubName(p.name);
                  setHubSource("");
                  setFields({});
                }}
              >
                <span>
                  <b className="block">{p.name}</b>
                  <span className="text-xs">{p.summary}</span>
                </span>
              </Button>
            ))}
          </div>
          <Label tip="Paste a public prompt link or its author/name, such as rlm/rag-prompt.">
            Public prompt
          </Label>
          <input
            className={inputCls}
            value={hubName}
            onChange={(e) => {
              setHubName(e.target.value);
              setHubSource("");
            }}
          />
          <Button
            disabled={busy}
            variant="outline"
            onClick={async () => {
              setBusy(true);
              setMsg("");
              setHubSource("");
              setChosenPrompt("");
              setFields({});
              try {
                const p = await pullHub(hubName);
                setChosenPrompt(p.text);
                setHubSource(p.source);
              } catch (e) {
                setMsg(e instanceof Error ? e.message : "Could not pull prompt");
              } finally {
                setBusy(false);
              }
            }}
          >
            <AnimatedIcon name="retriever" />
            {busy ? "Loading…" : "Pull public prompt"}
          </Button>
          {hubSource && (
            <>
              <Label tip="Review this public prompt; fill in any extra blanks such as context before running.">
                Prompt preview
              </Label>
              <textarea
                className={`${inputCls} h-64`}
                value={chosenPrompt}
                onChange={(e) => setChosenPrompt(e.target.value)}
              />
              <a
                href={hubSource}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline text-xs"
              >
                Original prompt ↗
              </a>
              <p className="text-xs text-muted-foreground">
                Text-only import; supply any required context yourself.
              </p>
              {extraFields}
              <p className="text-xs text-primary">
                Input question → AI prompt · {placeholders.length} extra values needed
              </p>
              <Button
                disabled={!chosenPrompt.trim() || missing}
                onClick={() => {
                  onInstall(promptRecipe(hubName, prepared, hubSource));
                  onClose();
                }}
              >
                Install prompt · +40 XP
              </Button>
            </>
          )}
        </div>
      ) : tab === "extensions" ? (
        <ExtensionsLibrary />
      ) : (
        <div>
          <Label tip="Paste a web link to a recipe file, or the recipe text itself.">
            Recipe link or JSON
          </Label>
          <textarea
            className={`${inputCls} h-48 font-mono text-xs`}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              setReviewedImport(null);
            }}
            placeholder={
              '{\n  "title": "My Recipe",\n  "steps": [\n    { "kind": "input", "instruction": "{question}" },\n    { "kind": "agent", "instruction": "Answer kindly" },\n    { "kind": "final", "instruction": "Be brief" }\n  ]\n}'
            }
          />
          <Button onClick={doImport} className={`${btn} mt-3`}>
            Preview Recipe
          </Button>
          {reviewedImport && (
            <div className="mt-4 space-y-3 border-t pt-4">
              <h3 className="font-bold">{reviewedImport.title}</h3>
              <p className="text-sm">{reviewedImport.summary}</p>
              <ol className="space-y-2 text-sm">
                {reviewedImport.nodes.map((s, i) => (
                  <li key={i}>
                    <b>
                      {i + 1}. {s.label ?? KINDS[s.kind].title}
                    </b>
                    <p className="text-muted-foreground whitespace-pre-wrap">{s.instruction}</p>
                  </li>
                ))}
              </ol>
              <Button
                onClick={() => {
                  onInstall(reviewedImport);
                  onClose();
                }}
              >
                Install reviewed recipe
              </Button>
            </div>
          )}
        </div>
      )}
      {msg && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {msg}
        </p>
      )}
    </Overlay>
  );
}
