// Everything that only exists in the Windows app (Tauri). The web version never loads these
// modules: every function checks isDesktop() and imports Tauri packages lazily.

export const OFFLINE_PORT = 12081;

export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: call } = await import("@tauri-apps/api/core");
  return call<T>(command, args);
}

const isExternal = (url: string) => /^https?:\/\//i.test(url) && !url.startsWith(location.origin);

/**
 * Requests that should go through the app instead of the web view: other sites, and local AI
 * servers. Never Tauri's own internal addresses (*.localhost), which carry the app's messages —
 * routing those through the app would loop forever.
 */
export function routeThroughApp(url: string): boolean {
  if (!isExternal(url)) return false;
  try {
    const host = new URL(url).hostname;
    return host !== "localhost" && !host.endsWith(".localhost");
  } catch {
    return false;
  }
}

/**
 * In the app, AI and tool requests go through the app itself instead of the web view, so services
 * that block browser requests (or "localhost" pages) still answer. Same API as fetch.
 */
export async function installDesktopFetch() {
  if (!isDesktop()) return;
  const { fetch: appFetch } = await import("@tauri-apps/plugin-http");
  const original = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return routeThroughApp(url) ? appFetch(input, init) : original(input, init);
  }) as typeof window.fetch;
}

/** Links to other sites open in the user's browser, not inside the app window. */
export function installExternalLinks() {
  if (!isDesktop()) return;
  document.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement | null)?.closest?.(
      "a[href]",
    ) as HTMLAnchorElement | null;
    if (!link || !isExternal(link.href)) return;
    event.preventDefault();
    void import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(link.href));
  });
}

export type AppMode = "window" | "browser";
export const getMode = () => invoke<AppMode>("get_mode");
export async function setModeAndRestart(mode: AppMode) {
  await invoke("set_mode", { mode });
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}

export async function appVersion(): Promise<string> {
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

export type UpdateInfo = { version: string; notes?: string | undefined } | null;

export async function checkForUpdate(): Promise<UpdateInfo> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  return update ? { version: update.version, notes: update.body } : null;
}

export async function installUpdate(onProgress: (done: number, total: number) => void) {
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return false;
  let done = 0;
  let total = 0;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") total = event.data.contentLength ?? 0;
    if (event.event === "Progress") done += event.data.chunkLength;
    onProgress(done, total);
  });
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
  return true;
}

export const repair = () => invoke<void>("repair");

// ---------- offline AI ----------

export interface OfflineAsset {
  id: string;
  name: string;
  file: string;
  url: string;
  sha256: string;
  bytes: number;
  note: string;
}

/** Pinned engine build and models, with checksums verified after download. */
export const OFFLINE_ENGINE: OfflineAsset = {
  id: "engine",
  name: "Offline engine (llama.cpp b11172, CPU)",
  file: "llama-b11172-bin-win-cpu-x64.zip",
  url: "https://github.com/ggml-org/llama.cpp/releases/download/b11172/llama-b11172-bin-win-cpu-x64.zip",
  sha256: "27935d6ba9c6b7f371203a1d514673cafdcd7f35bb6c1526983b1fcbfbbeffb2",
  bytes: 18_567_826,
  note: "Runs AI models on this computer. MIT licence.",
};

export const OFFLINE_MODELS: OfflineAsset[] = [
  {
    id: "qwen-0.5b",
    name: "Qwen 2.5 · 0.5B (fastest)",
    file: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    sha256: "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db",
    bytes: 491_400_032,
    note: "Quick and light; simple answers. Apache-2.0.",
  },
  {
    id: "qwen-1.5b",
    name: "Qwen 2.5 · 1.5B (recommended)",
    file: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
    sha256: "6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e",
    bytes: 1_117_320_736,
    note: "Good balance for most laptops. Apache-2.0.",
  },
  {
    id: "llama-3b",
    name: "Llama 3.2 · 3B (best, slower)",
    file: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    url: "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    sha256: "6c1a2b41161032677be168d354123594c0e6e67d2b9227c84f296ad037c728ff",
    bytes: 2_019_377_696,
    note: "Smartest of the three; needs ~4 GB free memory. Llama 3.2 Community Licence (Built with Llama).",
  },
];

export interface OfflineStatus {
  engine: boolean;
  models: string[];
  running: boolean;
  port: number;
  folder: string;
}

export const offlineStatus = () => invoke<OfflineStatus>("offline_status");
export const offlineDelete = (file: string) => invoke<void>("offline_delete", { file });
export const offlineStop = () => invoke<void>("offline_stop");

export async function offlineDownload(
  asset: OfflineAsset,
  onProgress: (done: number, total: number) => void,
) {
  const { listen } = await import("@tauri-apps/api/event");
  const stop = await listen<{ id: string; done: number; total: number }>(
    "offline-progress",
    (e) => {
      if (e.payload.id === asset.id) onProgress(e.payload.done, e.payload.total || asset.bytes);
    },
  );
  try {
    await invoke("offline_download", {
      id: asset.id,
      url: asset.url,
      file: asset.file,
      sha256: asset.sha256,
    });
  } finally {
    stop();
  }
}

/** Starts the local AI with half the processor cores, so the computer stays usable. */
export async function offlineStart(model: string): Promise<string> {
  const threads = Math.max(1, Math.floor((navigator.hardwareConcurrency || 4) / 2));
  const port = await invoke<number>("offline_start", { model, threads });
  const base = `http://127.0.0.1:${port}`;
  // Wait until the model is loaded (large models take a few seconds).
  for (let i = 0; i < 120; i++) {
    try {
      const health = await fetch(`${base}/health`);
      if (health.ok) return `${base}/v1`;
    } catch {
      /* still starting */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("The offline AI did not start within 2 minutes.");
}
