import { useCallback, useEffect, useState } from "react";
import type { LlmSettings } from "@/engine";
import {
  OFFLINE_ENGINE,
  OFFLINE_MODELS,
  appVersion,
  checkForUpdate,
  getMode,
  installUpdate,
  isDesktop,
  offlineDelete,
  offlineDownload,
  offlineStart,
  offlineStatus,
  offlineStop,
  repair,
  setModeAndRestart,
  type AppMode,
  type OfflineAsset,
  type OfflineStatus,
} from "@/desktop/bridge";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "./AnimatedIcon";
import { Info } from "./Info";

const gb = (bytes: number) =>
  bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="mt-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">
        {gb(done)} of {gb(total)} · {pct}%
      </div>
    </div>
  );
}

/** Settings sections that only exist in the Windows app. */
export function DesktopPanel({
  settings,
  setSettings,
}: {
  settings: LlmSettings;
  setSettings: (s: LlmSettings) => void;
}) {
  const [desktop, setDesktop] = useState(false);
  const [mode, setMode] = useState<AppMode>("window");
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState<OfflineStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  const refresh = useCallback(async () => setStatus(await offlineStatus()), []);
  useEffect(() => {
    if (!isDesktop()) return;
    setDesktop(true);
    void getMode().then(setMode);
    void appVersion().then(setVersion);
    void refresh();
  }, [refresh]);
  if (!desktop) return null;

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    setMessage("");
    setProgress(null);
    try {
      await task();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setProgress(null);
      void refresh();
    }
  };

  const download = (asset: OfflineAsset) =>
    run(asset.id, async () => {
      if (!status?.engine && asset.id !== "engine")
        await offlineDownload(OFFLINE_ENGINE, (done, total) => setProgress({ done, total }));
      await offlineDownload(asset, (done, total) => setProgress({ done, total }));
      setMessage(`${asset.name} is ready.`);
    });

  const start = (asset: OfflineAsset) =>
    run(`start-${asset.id}`, async () => {
      const baseUrl = await offlineStart(asset.file);
      setSettings({ ...settings, provider: "offline", baseUrl, apiKey: "", model: asset.file });
      setMessage(`${asset.name} is running. Langplay now uses it.`);
    });

  return (
    <div className="mb-5 space-y-4 border-b pb-5">
      <section>
        <h3 className="mb-2 flex items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Open Langplay in
          <Info tip="Its own window, or a tab in your usual browser (served only on this computer at 127.0.0.1:20136, with a tray icon to quit). Takes effect after a restart." />
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {(["window", "browser"] as const).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "outline"}
              size="sm"
              disabled={!!busy}
              onClick={() =>
                m === mode ? undefined : void run("mode", () => setModeAndRestart(m))
              }
            >
              {m === "window" ? "Its own window" : "My browser"}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-1 flex items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Offline AI
          <Info tip="Download an AI model once and use it with no key and no internet. Everything stays on this computer." />
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          While it answers, your processor works hard (Langplay uses half its cores). Downloads come
          from Hugging Face and GitHub and are checked before use.
        </p>
        <ul className="space-y-2">
          {OFFLINE_MODELS.map((m) => {
            const have = status?.models.includes(m.file);
            const active =
              settings.provider === "offline" && settings.model === m.file && status?.running;
            return (
              <li key={m.id} className="rounded-lg border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <b>{m.name}</b>
                  <span className="text-muted-foreground">{gb(m.bytes)}</span>
                </div>
                <p className="text-muted-foreground">{m.note}</p>
                {busy === m.id && progress && <Bar {...progress} />}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {!have &&
                    (confirm === m.id ? (
                      <>
                        <Button size="sm" onClick={() => (setConfirm(null), void download(m))}>
                          Download {gb(m.bytes + (status?.engine ? 0 : OFFLINE_ENGINE.bytes))}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!busy}
                        onClick={() => setConfirm(m.id)}
                      >
                        <AnimatedIcon name="spark" /> Get this model
                      </Button>
                    ))}
                  {have && !active && (
                    <Button size="sm" disabled={!!busy} onClick={() => void start(m)}>
                      {busy === `start-${m.id}` ? "Starting…" : "Use offline"}
                    </Button>
                  )}
                  {active && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void run("stop", offlineStop)}
                    >
                      Stop
                    </Button>
                  )}
                  {have && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!!busy}
                      onClick={() => void run("delete", () => offlineDelete(m.file))}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Advanced · version {version}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            disabled={!!busy}
            onClick={() =>
              void run("update", async () => {
                const update = await checkForUpdate();
                if (!update) return setMessage("You have the latest version.");
                setMessage(`Installing version ${update.version}…`);
                await installUpdate((done, total) => setProgress({ done, total }));
              })
            }
          >
            {busy === "update" ? "Updating…" : "Update"}
          </Button>
          {confirm === "repair" ? (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => (setConfirm(null), void run("repair", repair))}
              >
                Reinstall version {version}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() => setConfirm("repair")}
            >
              Repair
            </Button>
          )}
          <Info tip="Update installs the newest release from GitHub. Repair re-downloads and reinstalls this same version. Your recipes, settings, progress and offline models are kept." />
        </div>
        {(busy === "update" || busy === "repair") && progress && <Bar {...progress} />}
      </section>
      {message && (
        <p role="status" className="text-xs text-primary">
          {message}
        </p>
      )}
    </div>
  );
}
