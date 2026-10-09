import fs from "node:fs";
import path from "node:path";
import { rolldown } from "rolldown";
import type { Plugin } from "vite";

// Bundles the engine (and the tool runner UI) into plain scripts at build time, exposed as
// strings through `virtual:langplay-runtime`. Exported tools embed these strings, so a
// spun-out file runs exactly the same engine as the app — with no CDN or server.

const VIRTUAL = "virtual:langplay-runtime";
const RESOLVED = `\0${VIRTUAL}`;

export async function buildRuntime(root: string, entry: "engine" | "runner"): Promise<string> {
  const bundle = await rolldown({
    input: path.join(root, "src/runtime", `${entry}-entry.ts`),
    platform: "neutral",
    logLevel: "silent",
  });
  try {
    const { output } = await bundle.generate({ format: "iife", name: "Langplay", minify: true });
    return output[0].code;
  } finally {
    await bundle.close();
  }
}

export function langplayRuntime(): Plugin {
  let root = process.cwd();
  return {
    name: "langplay-runtime",
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : undefined;
    },
    async load(id) {
      if (id !== RESOLVED) return undefined;
      // Rebuild when any engine/runner source file changes.
      for (const dir of ["src/engine", "src/runner", "src/runtime"])
        for (const file of fs.readdirSync(path.join(root, dir)))
          if (file.endsWith(".ts")) this.addWatchFile(path.join(root, dir, file));
      const [engine, runner] = await Promise.all([
        buildRuntime(root, "engine"),
        buildRuntime(root, "runner"),
      ]);
      return `export const ENGINE_JS = ${JSON.stringify(engine)};\nexport const RUNNER_JS = ${JSON.stringify(runner)};\n`;
    },
  };
}
