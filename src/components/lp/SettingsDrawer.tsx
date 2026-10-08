import { useState } from "react";
import { PROVIDERS, type ProviderId } from "@/lib/lp-data";
import { chat, type LlmSettings } from "@/lib/lp-llm";
import { Info, Label, inputCls, btn } from "./Info";

export function SettingsDrawer({
  open, onClose, settings, setSettings, onTested,
}: {
  open: boolean;
  onClose: () => void;
  settings: LlmSettings;
  setSettings: (s: LlmSettings) => void;
  onTested: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "bad">("idle");
  const [err, setErr] = useState("");
  const prov = PROVIDERS.find((p) => p.id === settings.provider) ?? PROVIDERS[0]!;
  const groups = [...new Set(PROVIDERS.map((p) => p.group))];

  const pick = (id: ProviderId) => {
    const p = PROVIDERS.find((x) => x.id === id)!;
    setSettings({ ...settings, provider: id, baseUrl: p.baseUrl, model: p.model });
    setStatus("idle");
  };

  const test = async () => {
    setStatus("testing");
    setErr("");
    try {
      await chat(settings, [{ role: "user", content: "Say hi in 3 words." }]);
      setStatus("ok");
      onTested();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown problem");
      setStatus("bad");
    }
  };

  return (
    <Overlay open={open} onClose={onClose}>
      <h2 className="text-xl font-bold">⚙️ AI Connection</h2>
      <p className="mb-5 text-sm text-muted-foreground">Choose which AI brain powers your recipes.</p>

      <Label tip="Pick the company or app whose AI will answer your questions.">Provider</Label>
      <div className="mb-4 space-y-3">
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1 text-[11px] text-muted-foreground">{g}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {PROVIDERS.filter((p) => p.group === g).map((p) => (
                <button
                  key={p.id}
                  onClick={() => pick(p.id)}
                  className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                    settings.provider === p.id ? "border-primary bg-primary/15 text-primary" : "hover:border-primary/50"
                  }`}
                >
                  <span>{p.name}</span>
                  <Info tip={p.tip} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {settings.provider !== "simulator" && (
        <div className="space-y-4">
          <div>
            <Label tip="The web address where the AI lives — usually filled in for you.">Base URL</Label>
            <input className={inputCls} value={settings.baseUrl} onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <Label tip="A secret password for paid AI services; it stays only in this browser.">
              API Key {prov.needsKey ? "" : "(optional)"}
            </Label>
            <input type="password" className={inputCls} value={settings.apiKey} onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })} placeholder={prov.needsKey ? "sk-..." : "Not needed for this one"} />
          </div>
          <div>
            <Label tip="Which specific AI 'brain' to use — different ones are smarter, faster or cheaper.">Model</Label>
            <input list="lp-models" className={inputCls} value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })} placeholder="e.g. gpt-4o, llama-3, mistral" />
            <datalist id="lp-models">{prov.models.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button onClick={test} disabled={status === "testing"} className={`${btn} bg-primary text-primary-foreground hover:brightness-110`}>
          {status === "testing" ? "Testing…" : "Test Connection"}
        </button>
        <Info tip="Sends a tiny hello to the AI to check everything works." />
        {status === "ok" && <span className="animate-pop rounded-full bg-success/20 px-3 py-1 text-xs font-bold text-success">● Ready</span>}
        {status === "bad" && <span className="animate-pop rounded-full bg-destructive/20 px-3 py-1 text-xs font-bold text-destructive">● Check details</span>}
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err} Some free services block browsers or may be busy — try another one or the Simulator.</p>}
    </Overlay>
  );
}

export function Overlay({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`fixed inset-0 z-40 transition ${open ? "" : "pointer-events-none"}`}>
      <div onClick={onClose} className={`absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
      <aside className={`absolute right-0 top-0 h-full w-full ${wide ? "max-w-3xl" : "max-w-md"} overflow-y-auto border-l bg-card p-6 shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}>
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-md px-2 py-1 text-muted-foreground hover:bg-secondary">✕</button>
        {children}
      </aside>
    </div>
  );
}
