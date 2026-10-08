import { useState } from "react";
import { CATEGORIES, KINDS, RECIPES, type Category, type Recipe } from "@/lib/lp-data";
import { Overlay } from "./SettingsDrawer";
import { Info, Label, inputCls, btn } from "./Info";

export function RecipeHub({ open, onClose, onInstall }: { open: boolean; onClose: () => void; onInstall: (r: Recipe) => void }) {
  const [tab, setTab] = useState<"browse" | "import">("browse");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState("");

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
      <h2 className="text-xl font-bold">🍳 Community Recipe Hub</h2>
      <p className="mb-4 text-sm text-muted-foreground">Ready-made AI recipes. Install one with a single click.</p>
      <div className="mb-4 inline-flex rounded-lg border p-1">
        {(["browse", "import"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            {t === "browse" ? "Browse" : "Import JSON / Link"}
          </button>
        ))}
      </div>

      {tab === "browse" ? (
        <>
          <div className="mb-3 flex items-center gap-2">
            <input className={inputCls} placeholder="🔍 Search recipes…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Info tip="Type a word to find recipes that mention it." />
          </div>
          <div className="mb-5 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCat(cat === c ? null : c)} className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${cat === c ? "border-accent bg-accent text-accent-foreground" : "hover:border-accent"}`}>
                {c}
              </button>
            ))}
            <Info tip="Tap a category to only show recipes of that kind." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((r) => (
              <div key={r.id} className="flex flex-col rounded-xl border bg-secondary/40 p-4 transition hover:-translate-y-0.5 hover:border-primary/60">
                <h3 className="font-bold">{r.title}</h3>
                <p className="mb-3 mt-1 text-sm text-muted-foreground">{r.summary}</p>
                <div className="mb-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  <span className="rounded bg-primary/15 px-2 py-0.5 text-primary">{r.difficulty}</span>
                  {r.tools.map((t) => <span key={t} className="rounded bg-muted px-2 py-0.5">🧰 {t}</span>)}
                  <span className="rounded bg-coin/15 px-2 py-0.5 text-coin">💰 {r.cost}</span>
                </div>
                {inspect === r.id && (
                  <div className="mb-3 flex flex-wrap items-center gap-1 rounded-lg bg-background/60 p-2 text-xs">
                    {r.steps.map((s, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className="rounded border px-1.5 py-0.5">{KINDS[s.kind].emoji} {s.label ?? KINDS[s.kind].title}</span>
                        {i < r.steps.length - 1 && <span className="text-primary">→</span>}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex gap-2">
                  <button onClick={() => setInspect(inspect === r.id ? null : r.id)} className={`${btn} border hover:bg-secondary`}>Inspect</button>
                  <button onClick={() => { onInstall(r); onClose(); }} className={`${btn} flex-1 bg-primary text-primary-foreground hover:brightness-110`}>⚡ 1-Click Install</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div>
          <Label tip="Paste a web link to a recipe file, or the recipe text itself.">Recipe link or JSON</Label>
          <textarea className={`${inputCls} h-48 font-mono text-xs`} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'{\n  "title": "My Recipe",\n  "steps": [\n    { "kind": "input", "instruction": "{question}" },\n    { "kind": "agent", "instruction": "Answer kindly" },\n    { "kind": "final", "instruction": "Be brief" }\n  ]\n}'} />
          <button onClick={doImport} className={`${btn} mt-3 bg-primary text-primary-foreground`}>Import Recipe</button>
          {msg && <p className="mt-2 text-sm text-destructive">{msg}</p>}
        </div>
      )}
    </Overlay>
  );
}
