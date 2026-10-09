import { useEffect, useState } from "react";
import type { LlmSettings } from "@/engine";
import { PROVIDERS } from "@/lib/lp-data";
import {
  deleteConnection,
  listConnections,
  saveConnection,
  type Connection,
} from "@/lib/lp-connections";
import { Button } from "@/components/ui/button";
import { Info, inputCls } from "./Info";

/** Save the current AI setup under a name, and switch between saved ones in one click. */
export function Connections({
  settings,
  setSettings,
}: {
  settings: LlmSettings;
  setSettings: (s: LlmSettings) => void;
}) {
  const [list, setList] = useState<Connection[]>([]);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => setList(listConnections()), []);
  const label = (s: LlmSettings) =>
    `${PROVIDERS.find((p) => p.id === s.provider)?.name ?? s.provider}${s.model ? ` · ${s.model}` : ""}`;
  const same = (s: LlmSettings) =>
    s.provider === settings.provider &&
    s.baseUrl === settings.baseUrl &&
    s.model === settings.model;

  return (
    <div className="mb-5 space-y-2 border-b pb-5">
      <h3 className="flex items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
        My AI connections
        <Info tip="Save the AI you have set up below (service, address, model and key) under a name. Add as many OpenAI-compatible services as you like and switch with one click. Keys stay on this device." />
      </h3>
      {list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg border p-2 text-xs">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="truncate text-muted-foreground">{label(c.settings)}</div>
              </div>
              {same(c.settings) ? (
                <span className="text-primary">In use</span>
              ) : (
                <Button size="sm" className="h-7" onClick={() => setSettings({ ...c.settings })}>
                  Use
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                aria-label={`Delete ${c.name}`}
                onClick={() => setList(deleteConnection(c.id))}
              >
                ×
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setList(saveConnection(name, settings));
            setMsg(`Saved "${name.trim() || label(settings)}".`);
            setName("");
          } catch (error) {
            setMsg(error instanceof Error ? error.message : "Could not save.");
          }
        }}
      >
        <input
          aria-label="Connection name"
          className={`${inputCls} py-1.5 text-xs`}
          placeholder={`Name for ${label(settings)}`}
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <Button size="sm" variant="outline" type="submit">
          Save current
        </Button>
      </form>
      {msg && <p className="text-xs text-primary">{msg}</p>}
    </div>
  );
}
