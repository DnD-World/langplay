import { useEffect, useRef, useState } from "react";
import { PROVIDERS, type ProviderId } from "@/lib/lp-data";
import { chat, type LlmSettings } from "@/engine";
import { Info, Label, inputCls, btn } from "./Info";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "./AnimatedIcon";
import { fetchModels, presetModels, MODEL_POLICY, type ModelOption } from "@/lib/lp-models";
import { Overlay } from "./Overlay";
import { SquishToggle } from "./EffectControls";
import { DesktopPanel } from "./DesktopPanel";
import { isDesktop } from "@/desktop/bridge";
import { Connections } from "./Connections";

const FREE_KEY_GUIDES: Record<
  string,
  { site: string; url: string; signIn: string; create: string }
> = {
  gemini: {
    site: "Google AI Studio",
    url: "https://aistudio.google.com/apikey",
    signIn: " with a Google account",
    create: 'Press "Create API key" and copy it.',
  },
  groq: {
    site: "Groq Console",
    url: "https://console.groq.com/keys",
    signIn: " (email or Google)",
    create: 'Press "Create API Key", give it any name, and copy it.',
  },
  openrouter: {
    site: "OpenRouter",
    url: "https://openrouter.ai/settings/keys",
    signIn: "",
    create: 'Press "Create Key", copy it, and keep the model on openrouter/free.',
  },
};

export function SettingsDrawer({
  open,
  onClose,
  settings,
  setSettings,
  onTested,
  motion,
  setMotion,
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
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const requests = useRef({ test: 0, models: 0 });
  const [loadingModels, setLoadingModels] = useState(false);
  useEffect(() => {
    // Reset suggestions only when the provider or allowance changes, not on every keystroke.
    setModels(presetModels(settingsRef.current));
    setModelStatus("");
  }, [settings.provider, settings.freeAllowance]);
  const visibleModels = models.filter((m) => !settings.freeOnly || m.free);
  const policy = MODEL_POLICY[settings.provider];
  const groups = [...new Set(PROVIDERS.map((p) => p.group))];
  useEffect(() => {
    setStatus("idle");
    setErr("");
  }, [settings]);

  const pick = (id: ProviderId) => {
    const p = PROVIDERS.find((x) => x.id === id);
    if (!p) return;
    setSettings({
      ...settings,
      provider: id,
      apiKey: "",
      baseUrl: p.baseUrl,
      model: p.model,
      freeAllowance: false,
      modelFreeVerified: false,
    });
    setStatus("idle");
  };

  const test = async () => {
    const id = ++requests.current.test;
    const snapshot = settings;
    setStatus("testing");
    setErr("");
    try {
      await chat(settings, [{ role: "user", content: "Say hi in 3 words." }]);
      if (id !== requests.current.test || snapshot !== settingsRef.current) return;
      setStatus("ok");
      onTested();
    } catch (e) {
      if (id !== requests.current.test || snapshot !== settingsRef.current) return;
      setErr(e instanceof Error ? e.message : "Unknown problem");
      setStatus("bad");
    }
  };
  const refreshModels = async () => {
    const id = ++requests.current.models;
    const snapshot = settings;
    setLoadingModels(true);
    setModelStatus("Loading…");
    try {
      const list = await fetchModels(snapshot);
      if (id !== requests.current.models || snapshot !== settingsRef.current) return;
      if (list.length === 0) throw new Error("The service returned an empty model list.");
      setModels(list);
      setModelStatus(`${list.length} models loaded from the service`);
      setSettings({
        ...snapshot,
        modelFreeVerified: list.some((m) => m.id === snapshot.model && m.free),
      });
    } catch (e) {
      if (id !== requests.current.models || snapshot !== settingsRef.current) return;
      const fallback = presetModels(snapshot);
      setModels(fallback);
      const reason = e instanceof Error ? e.message : "Could not load models";
      setModelStatus(
        fallback.length > 0
          ? `Live list unavailable (${reason.slice(0, 120)}). Showing ${fallback.length} suggested models instead — some services block direct browser requests.`
          : reason,
      );
    } finally {
      if (id === requests.current.models) setLoadingModels(false);
    }
  };

  return (
    <Overlay open={open} onClose={onClose}>
      <h2 className="text-xl font-bold">
        <AnimatedIcon name="settings" /> Settings
      </h2>
      <div className="my-4 flex items-center gap-3 border-y py-4">
        <SquishToggle checked={motion} onChange={setMotion} label="Motion" />
        <span className="text-sm">Motion</span>
        <Info tip="Turn letter animations, glowing borders, animated icons and click sparks on or off." />
      </div>
      <DesktopPanel settings={settings} setSettings={setSettings} />
      <Connections settings={settings} setSettings={setSettings} />
      <p className="mb-5 text-sm text-muted-foreground">
        Choose which AI brain powers your recipes.
      </p>

      <Label tip="Pick the company or app whose AI will answer your questions.">Provider</Label>
      <div className="mb-4 space-y-3">
        {groups.map((g) => (
          <div key={g}>
            <div className="mb-1 text-[11px] text-muted-foreground">{g}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {PROVIDERS.filter((p) => p.group === g && (p.id !== "offline" || isDesktop())).map(
                (p) => (
                  <Button
                    variant="ghost"
                    key={p.id}
                    onClick={() => pick(p.id)}
                    aria-label={p.name}
                    className={`flex h-auto min-h-9 items-center justify-between whitespace-normal rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                      settings.provider === p.id
                        ? "border-primary bg-primary/15 text-primary"
                        : "hover:border-primary/50"
                    }`}
                  >
                    <span>{p.name}</span>
                    <Info tip={p.tip} />
                  </Button>
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-5 space-y-3 border-y py-4">
        <div className="flex items-center gap-2 text-sm">
          <SquishToggle
            label="Free models only"
            checked={!!settings.freeOnly}
            onChange={(on) =>
              setSettings({
                ...settings,
                freeOnly: on,
                modelFreeVerified: models.some((m) => m.id === settings.model && m.free),
              })
            }
          />
          Free models only
          <Info tip="Hide models that charge money or whose free allowance has not been confirmed." />
        </div>
        {policy && (
          <>
            <p className="text-xs text-muted-foreground">
              {policy.note}{" "}
              <a
                className="text-primary underline"
                href={policy.url}
                target="_blank"
                rel="noreferrer"
              >
                Provider policy
              </a>
            </p>
            {!["openrouter", "puter"].includes(settings.provider) && (
              <div className="flex items-center gap-2 text-xs">
                <SquishToggle
                  label="Active free or trial allowance"
                  checked={!!settings.freeAllowance}
                  onChange={(on) =>
                    setSettings({ ...settings, freeAllowance: on, modelFreeVerified: false })
                  }
                />
                <span>My key has an active free / trial allowance</span>
                <Info tip="Confirm this in your provider account; Langplay cannot see your balance or plan." />
              </div>
            )}
          </>
        )}
        <Button variant="outline" size="sm" disabled={loadingModels} onClick={refreshModels}>
          <AnimatedIcon name="spark" />
          {loadingModels ? "Loading…" : "Refresh models"}
        </Button>
        <Info tip="Ask this provider for its current model list; some services block direct browser requests." />
        {modelStatus && (
          <p className="text-xs text-muted-foreground" role="status">
            {modelStatus}
          </p>
        )}
        <Label tip="Pick a suggested model; labels say whether its price or allowance qualifies.">
          Available models ({visibleModels.length})
        </Label>
        <select
          aria-label="Available models"
          className={inputCls}
          value={visibleModels.some((m) => m.id === settings.model) ? settings.model : ""}
          onChange={(e) => {
            const m = visibleModels.find((m) => m.id === e.target.value);
            if (m) setSettings({ ...settings, model: m.id, modelFreeVerified: m.free });
          }}
        >
          <option value="" disabled>
            Choose a model
          </option>
          {visibleModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id} · {m.evidence}
            </option>
          ))}
        </select>
        {visibleModels.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No verified free models. Confirm your allowance, refresh, or turn off the filter.
          </p>
        )}
      </div>
      {FREE_KEY_GUIDES[settings.provider] && (
        <div className="mb-4 rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs">
          <p className="mb-2 font-bold text-primary">
            <AnimatedIcon name="spark" /> Get a free key in about 2 minutes
          </p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              Open{" "}
              <a
                className="text-primary underline"
                href={FREE_KEY_GUIDES[settings.provider]!.url}
                target="_blank"
                rel="noreferrer"
              >
                {FREE_KEY_GUIDES[settings.provider]!.site} ↗
              </a>{" "}
              and sign in{FREE_KEY_GUIDES[settings.provider]!.signIn}.
            </li>
            <li>{FREE_KEY_GUIDES[settings.provider]!.create}</li>
            <li>Paste it into API Key below, then press Test Connection.</li>
          </ol>
          <p className="mt-2 text-muted-foreground">
            No card needed for the free allowance. The key stays in this browser only.
          </p>
        </div>
      )}
      {settings.provider !== "simulator" && (
        <div className="space-y-4">
          <div>
            <Label tip="The web address where the AI lives — usually filled in for you.">
              Base URL
            </Label>
            <input
              className={inputCls}
              value={settings.baseUrl}
              onChange={(e) =>
                setSettings({ ...settings, baseUrl: e.target.value, modelFreeVerified: false })
              }
              placeholder="https://..."
            />
          </div>
          <div>
            <Label tip="Your private service key stays in this browser; do not use a shared device.">
              API Key {prov?.needsKey ? "" : "(optional)"}
            </Label>
            <input
              type="password"
              className={inputCls}
              value={settings.apiKey}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  apiKey: e.target.value,
                  freeAllowance: false,
                  modelFreeVerified: false,
                })
              }
              placeholder={prov?.needsKey ? "sk-..." : "Not needed for this one"}
            />
          </div>
          <div>
            <Label tip="Which specific AI 'brain' to use — different ones are smarter, faster or cheaper.">
              Model
            </Label>
            <input
              list="lp-models"
              className={inputCls}
              value={settings.model}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  model: e.target.value,
                  modelFreeVerified: visibleModels.some((m) => m.id === e.target.value && m.free),
                })
              }
              placeholder="e.g. gpt-4o, llama-3, mistral"
            />
            <datalist id="lp-models">
              {visibleModels.map((m) => (
                <option key={m.id} value={m.id} />
              ))}
            </datalist>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <Button
          onClick={test}
          disabled={status === "testing"}
          className={`${btn} hover:brightness-110`}
        >
          {status === "testing" ? "Testing…" : "Test Connection"}
        </Button>
        <Info tip="Sends a tiny hello to the AI to check everything works." />
        {status === "ok" && (
          <span role="status" className="animate-pop text-xs font-bold text-success">
            <AnimatedIcon name="check" /> Ready
          </span>
        )}
        {status === "bad" && (
          <span role="status" className="animate-pop text-xs font-bold text-destructive">
            <AnimatedIcon name="warning" /> Check details
          </span>
        )}
      </div>
      {err && (
        <p className="mt-2 text-xs text-destructive">
          {err} Some free services block browsers or may be busy — try another one or the Simulator.
        </p>
      )}
    </Overlay>
  );
}
