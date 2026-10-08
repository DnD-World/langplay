import { useState } from "react";
import { CATEGORIES, KINDS, RECIPES, type Category, type Recipe } from "@/lib/lp-data";
import { Overlay } from "./SettingsDrawer";
import { Info, Label, inputCls, btn } from "./Info";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "./AnimatedIcon";
import { SOURCES, listSource, readSource, pullHub, promptRecipe, type SourceFile } from "@/lib/lp-sources";

export function RecipeHub({ open, onClose, onInstall }: { open: boolean; onClose: () => void; onInstall: (r: Recipe) => void }) {
  const [tab, setTab] = useState<"browse" | "sources" | "hub" | "import">("browse");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState("");

  const [source, setSource] = useState(SOURCES[0]?.id ?? "langchain-ai/cookbooks");
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [selected, setSelected] = useState<SourceFile | null>(null);
  const [sourceText, setSourceText] = useState("");
  const [prompts, setPrompts] = useState<string[]>([]);
  const [chosenPrompt, setChosenPrompt] = useState("");
  const [hubName, setHubName] = useState("rlm/rag-prompt");
  const [hubSource, setHubSource] = useState("");
  const [busy, setBusy] = useState(false);
  const loadSource = async () => { setBusy(true); setMsg(""); setSelected(null); try { setFiles(await listSource(source)); } catch(e) { setMsg(e instanceof Error ? e.message : "Could not load source"); } finally { setBusy(false); } };
  const openFile = async (file: SourceFile) => { setBusy(true); setMsg(""); setSelected(file); setChosenPrompt(""); try { const result = await readSource(file); setSourceText(result.text); setPrompts(result.prompts); setChosenPrompt(result.prompts[0] ?? ""); } catch(e) { setMsg(e instanceof Error ? e.message : "Could not open example"); } finally { setBusy(false); } };
  const list = RECIPES.filter(
    (r) => (!cat || r.categories.includes(cat)) && (r.title + r.summary).toLowerCase().includes(q.toLowerCase()),
  );

  const doImport = async () => {
    setMsg("");
    try {
      let text = raw.trim();
      if (/^https?:\/\//.test(text)) text = await (await fetch(text)).text();
      const j = JSON.parse(text);
      if (!Array.isArray(j.steps)) throw new Error();
      onInstall({ id: "import", title: j.title ?? "Imported Recipe", summary: j.summary ?? "", difficulty: "Easy", categories: [], tools: [], cost: "Cheap", steps: j.steps.filter((s: { kind: string }) => s.kind in KINDS) });
      onClose();
    } catch {
      setMsg("Hmm, that doesn't look like a valid recipe. It needs a list of 'steps'.");
    }
  };

  return (
    <Overlay open={open} onClose={onClose} wide>
      <h2 className="text-xl font-bold"><AnimatedIcon name="blocks" /> Recipe Library</h2>
      <p className="mb-4 text-sm text-muted-foreground">LangChain · LangSmith · Community · Prompt Hub</p>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border p-1">
        {(["browse", "sources", "hub", "import"] as const).map((t) => (
          <Button variant="ghost" key={t} onClick={() => { setTab(t); setMsg(""); }} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {{ browse: "Recipes", sources: "Cookbooks", hub: "Prompt Hub", import: "Import" }[t]}
          </Button>
        ))}
      </div>

      {tab === "browse" ? (
        <>
          <div className="mb-3 flex items-center gap-2">
            <AnimatedIcon name="tool" /><input className={inputCls} placeholder="Search recipes…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Info tip="Type a word to find recipes that mention it." />
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Button variant="ghost" key={c} onClick={() => setCat(cat === c ? null : c)} className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${cat === c ? "border-accent bg-accent text-accent-foreground" : "hover:border-accent"}`}>
                {c}
              </Button>
            ))}
            <Info tip="Tap a category to only show recipes of that kind." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((r) => (
              <div key={r.id} className="flex flex-col rounded-lg border bg-secondary/40 p-4 transition hover:-translate-y-0.5 hover:border-primary/60">
                <h3 className="font-bold">{r.title}</h3>
                <p className="mb-3 mt-1 text-sm text-muted-foreground">{r.summary}</p>
                <div className="mb-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  <span className="rounded bg-primary/15 px-2 py-0.5 text-primary">{r.difficulty}</span>
                  {r.tools.map((t) => <span key={t} className="rounded bg-muted px-2 py-0.5"><AnimatedIcon name="tool" /> {t}</span>)}
                  <span className="rounded bg-coin/15 px-2 py-0.5 text-coin"><AnimatedIcon name="coin" /> {r.cost}</span>
                </div>
                {inspect === r.id && (
                  <div className="mb-3 flex flex-wrap items-center gap-1 rounded-lg bg-background/60 p-2 text-xs">
                    {r.steps.map((s, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="rounded border px-1.5 py-0.5"><AnimatedIcon name={s.kind} /> {s.label ?? KINDS[s.kind].title}</span>
                        {i < r.steps.length - 1 && <span className="text-primary">→</span>}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex gap-2">
                  <Button variant="ghost" onClick={() => setInspect(inspect === r.id ? null : r.id)} className={`${btn} border hover:bg-secondary`}>Inspect</Button>
                  <Button variant="ghost" onClick={() => { onInstall(r); onClose(); }} className={`${btn} flex-1 bg-primary text-primary-foreground hover:brightness-110`}><AnimatedIcon name="spark" /> Install · +40 XP</Button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : tab === "sources" ? (
        <div className="space-y-4">
          <Label tip="Choose which public collection to browse; originals stay linked to their authors.">Collection</Label>
          <select className={inputCls} aria-label="Cookbook collection" value={source} onChange={e => { setSource(e.target.value); setFiles([]); setSelected(null); }}>{SOURCES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <Button variant="outline" onClick={loadSource} disabled={busy}><AnimatedIcon name="retriever" />{busy ? "Loading…" : "Load examples"}</Button><Info tip="Read the latest public files from this collection without needing a GitHub account." />
          <input aria-label="Search cookbook files" className={inputCls} placeholder="Search example names…" value={q} onChange={e => setQ(e.target.value)} /><Info tip="Filter examples by words in their name." />
          <div className="max-h-56 overflow-y-auto divide-y border-y">{files.filter(f => f.path.toLowerCase().includes(q.toLowerCase())).map(f => <Button key={f.path} variant="ghost" className="h-auto w-full justify-start whitespace-normal break-all py-2 text-left text-xs" onClick={() => openFile(f)}>{f.path}</Button>)}</div>
          {selected && <div className="space-y-3"><a className="text-primary underline text-sm" href={selected.url} target="_blank" rel="noreferrer">Original example ↗</a><p className="text-xs text-muted-foreground">Text-only prompt adaptation. Tools, document stores and notebook programs are not imported.</p>
            <details><summary className="cursor-pointer text-sm">View original text</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs mt-2">{sourceText.slice(0, 50000)}</pre></details>
            {prompts.length > 0 && <select aria-label="Extracted prompt" className={inputCls} value={chosenPrompt} onChange={e => setChosenPrompt(e.target.value)}>{prompts.map((p,i) => <option key={i} value={p}>Prompt {i+1}: {p.slice(0,70)}</option>)}</select>}
            <Label tip="Review the extracted prompt, or paste a prompt from the original example; replace missing blanks before running.">Prompt text</Label><textarea className={`${inputCls} h-44`} value={chosenPrompt} onChange={e => setChosenPrompt(e.target.value)} placeholder="No plain prompt found automatically. Paste a prompt from the original above." />
            <Button disabled={!chosenPrompt.trim() || busy} onClick={() => { onInstall(promptRecipe(selected.path, chosenPrompt, selected.url)); onClose(); }}><AnimatedIcon name="spark" />Install prompt recipe</Button>
          </div>}
        </div>
      ) : tab === "hub" ? (
        <div className="space-y-4"><a href="https://smith.langchain.com/hub" target="_blank" rel="noreferrer" className="text-primary underline text-sm">Browse public LangSmith prompts ↗</a>
          <Label tip="Paste a public prompt link or its author/name, such as rlm/rag-prompt.">Public prompt</Label>
          <input className={inputCls} value={hubName} onChange={e => { setHubName(e.target.value); setHubSource(""); }} />
          <Button disabled={busy} variant="outline" onClick={async () => { setBusy(true); setMsg(""); setHubSource(""); try { const p = await pullHub(hubName); setChosenPrompt(p.text); setHubSource(p.source); } catch(e) { setMsg(e instanceof Error ? e.message : "Could not pull prompt"); } finally { setBusy(false); } }}><AnimatedIcon name="retriever" />{busy ? "Loading…" : "Pull public prompt"}</Button>
          {hubSource && <><Label tip="Review this public prompt; fill in any extra blanks such as context before running.">Prompt preview</Label><textarea className={`${inputCls} h-64`} value={chosenPrompt} onChange={e => setChosenPrompt(e.target.value)} /><a href={hubSource} target="_blank" rel="noreferrer" className="text-primary underline text-xs">Original prompt ↗</a><p className="text-xs text-muted-foreground">Text-only import; supply any required context yourself.</p><Button disabled={!chosenPrompt.trim()} onClick={() => { onInstall(promptRecipe(hubName, chosenPrompt, hubSource)); onClose(); }}>Install prompt · +40 XP</Button></>}
        </div>
      ) : (
        <div>
          <Label tip="Paste a web link to a recipe file, or the recipe text itself.">Recipe link or JSON</Label>
          <textarea className={`${inputCls} h-48 font-mono text-xs`} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'{\n  "title": "My Recipe",\n  "steps": [\n    { "kind": "input", "instruction": "{question}" },\n    { "kind": "agent", "instruction": "Answer kindly" },\n    { "kind": "final", "instruction": "Be brief" }\n  ]\n}'} />
          <Button variant="ghost" onClick={doImport} className={`${btn} mt-3 bg-primary text-primary-foreground`}>Import Recipe</Button>

        </div>
      )}
      {msg && <p role="alert" className="mt-3 text-sm text-destructive">{msg}</p>}
    </Overlay>
  );
}
