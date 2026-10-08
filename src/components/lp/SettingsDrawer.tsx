import { useEffect, useState } from "react";
import { PROVIDERS, type ProviderId } from "@/lib/lp-data";
import { chat, type LlmSettings } from "@/lib/lp-llm";
import { Info, Label, inputCls, btn } from "./Info";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "./AnimatedIcon";
import { fetchModels, presetModels, MODEL_POLICY, type ModelOption } from "@/lib/lp-models";
import { Overlay } from './Overlay';
import { SquishToggle } from './EffectControls';

export function SettingsDrawer({
  open, onClose, settings, setSettings, onTested, motion, setMotion,
}: {
  open: boolean;
  onClose: () => void;
  settings: LlmSettings;
  setSettings: (s: LlmSettings) => void;
  onTested: () => void;
  motion: boolean;
  setMotion: (on: boolean) => void;
}) {
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "bad">("idle");
  const [err, setErr] = useState("");
  const prov = PROVIDERS.find((p) => p.id === settings.provider) ?? PROVIDERS[0];
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelStatus, setModelStatus] = useState("");
  useEffect(() => { setModels(presetModels(settings)); setModelStatus(""); }, [settings.provider, settings.freeAllowance]);
  const visibleModels = models.filter(m => !settings.freeOnly || m.free);
  const policy = MODEL_POLICY[settings.provider];
  const groups = [...new Set(PROVIDERS.map((p) => p.group))];
  useEffect(() => { setStatus('idle'); setErr(''); }, [settings]);

  const pick = (id: ProviderId) => {
    const p = PROVIDERS.find((x) => x.id === id);
    if (!p) return;
    setSettings({ ...settings, provider: id, apiKey: "", baseUrl: p.baseUrl, model: p.model, freeAllowance: false, modelFreeVerified: false });
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
      <h2 className="text-xl font-bold"><AnimatedIcon name="settings" /> Settings</h2>
      <div className="my-4 flex items-center gap-3 border-y py-4"><SquishToggle checked={motion} onChange={setMotion} label="Motion" /><span className="text-sm">Motion</span><Info tip="Turn letter animations, glowing borders, animated icons and click sparks on or off." /></div>
      <p className="mb-5 text-sm text-muted-foreground">Choose which AI brain powers your recipes.</p>

      <Label tip="Pick the company or app whose AI will answer your questions.">Provider</Label>
      <div className="mb-4 space-y-3">
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1 text-[11px] text-muted-foreground">{g}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {PROVIDERS.filter((p) => p.group === g).map((p) => (
                <Button variant="ghost"
                  key={p.id}
                  onClick={() => pick(p.id)}
                  aria-label={p.name}
                  className={`flex h-auto min-h-9 items-center justify-between whitespace-normal rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                    settings.provider === p.id ? "border-primary bg-primary/15 text-primary" : "hover:border-primary/50"
                  }`}
                >
                  <span>{p.name}</span>
                  <Info tip={p.tip} />
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-5 space-y-3 border-y py-4">
        <div className="flex items-center gap-2 text-sm"><SquishToggle label="Free models only" checked={!!settings.freeOnly} onChange={on => setSettings({ ...settings, freeOnly: on, modelFreeVerified: models.some(m => m.id === settings.model && m.free) })} />Free models only<Info tip="Hide models that charge money or whose free allowance has not been confirmed." /></div>
        {policy && <><p className="text-xs text-muted-foreground">{policy.note} <a className="text-primary underline" href={policy.url} target="_blank" rel="noreferrer">Provider policy</a></p>
        {!["openrouter", "puter"].includes(settings.provider) && <div className="flex items-center gap-2 text-xs"><SquishToggle label="Active free or trial allowance" checked={!!settings.freeAllowance} onChange={on => setSettings({ ...settings, freeAllowance: on, modelFreeVerified: false })} /><span>My key has an active free / trial allowance</span><Info tip="Confirm this in your provider account; Langplay cannot see your balance or plan." /></div>}</>}
        <Button variant="outline" size="sm" onClick={async () => { setModelStatus("Loading…"); try { const list = await fetchModels(settings); setModels(list); setModelStatus(`${list.length} models loaded`); setSettings({ ...settings, modelFreeVerified: list.some(m => m.id === settings.model && m.free) }); } catch(e) { setModelStatus(e instanceof Error ? e.message : "Could not load models"); } }}><AnimatedIcon name="spark" />Refresh models</Button><Info tip="Ask this provider for its current model list; some services block direct browser requests." />
        {modelStatus && <p className="text-xs text-muted-foreground" role="status">{modelStatus}</p>}
        <Label tip="Pick a suggested model; labels say whether its price or allowance qualifies.">Available models ({visibleModels.length})</Label>
        <select aria-label="Available models" className={inputCls} value={visibleModels.some(m => m.id === settings.model) ? settings.model : ""} onChange={e => { const m = visibleModels.find(m => m.id === e.target.value); if(m) setSettings({ ...settings, model: m.id, modelFreeVerified: m.free }); }}>
          <option value="" disabled>Choose a model</option>{visibleModels.map(m => <option key={m.id} value={m.id}>{m.id} · {m.evidence}</option>)}
        </select>
        {visibleModels.length === 0 && <p className="text-xs text-muted-foreground">No verified free models. Confirm your allowance, refresh, or turn off the filter.</p>}
      </div>
      {settings.provider !== "simulator" && (
        <div className="space-y-4">
          <div>
            <Label tip="The web address where the AI lives — usually filled in for you.">Base URL</Label>
            <input className={inputCls} value={settings.baseUrl} onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value, modelFreeVerified: false })} placeholder="https://..." />
          </div>
          <div>
            <Label tip="Your private service key stays in this browser; do not use a shared device.">
              API Key {prov?.needsKey ? "" : "(optional)"}
            </Label>
            <input type="password" className={inputCls} value={settings.apiKey} onChange={(e) => setSettings({ ...settings, apiKey: e.target.value, freeAllowance: false, modelFreeVerified: false })} placeholder={prov?.needsKey ? "sk-..." : "Not needed for this one"} />
          </div>
          <div>
            <Label tip="Which specific AI 'brain' to use — different ones are smarter, faster or cheaper.">Model</Label>
            <input list="lp-models" className={inputCls} value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value, modelFreeVerified: visibleModels.some(m => m.id === e.target.value && m.free) })} placeholder="e.g. gpt-4o, llama-3, mistral" />
            <datalist id="lp-models">{visibleModels.map((m) => <option key={m.id} value={m.id} />)}</datalist>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button variant="ghost" onClick={test} disabled={status === "testing"} className={`${btn} bg-primary text-primary-foreground hover:brightness-110`}>
          {status === "testing" ? "Testing…" : "Test Connection"}
        </Button>
        <Info tip="Sends a tiny hello to the AI to check everything works." />
        {status === "ok" && <span className="animate-pop rounded-full bg-success/20 px-3 py-1 text-xs font-bold text-success">● Ready</span>}
        {status === "bad" && <span className="animate-pop rounded-full bg-destructive/20 px-3 py-1 text-xs font-bold text-destructive">● Check details</span>}
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err} Some free services block browsers or may be busy — try another one or the Simulator.</p>}
    </Overlay>
  );
}

