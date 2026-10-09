import type { LlmSettings } from "@/engine";

// "My AI connections": named copies of AI settings (service URL, model, key) kept in this
// browser or app, so switching between several services is one click.

export interface Connection {
  id: string;
  name: string;
  settings: LlmSettings;
}

const KEY = "lp-connections";
export const MAX_CONNECTIONS = 30;

export function listConnections(): Connection[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (c): c is Connection =>
        !!c &&
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        !!c.settings &&
        typeof c.settings.provider === "string" &&
        typeof c.settings.baseUrl === "string" &&
        typeof c.settings.apiKey === "string" &&
        typeof c.settings.model === "string",
    );
  } catch {
    return [];
  }
}

function write(list: Connection[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function saveConnection(name: string, settings: LlmSettings): Connection[] {
  const clean = name.trim().slice(0, 60) || `${settings.provider} · ${settings.model}`;
  const list = listConnections().filter((c) => c.name !== clean);
  if (list.length >= MAX_CONNECTIONS) throw new Error(`Keep up to ${MAX_CONNECTIONS} connections.`);
  const { modelFreeVerified: _v, ...rest } = settings;
  const next = [{ id: `c${Date.now().toString(36)}`, name: clean, settings: rest }, ...list];
  write(next);
  return next;
}

export function deleteConnection(id: string): Connection[] {
  const next = listConnections().filter((c) => c.id !== id);
  write(next);
  return next;
}
