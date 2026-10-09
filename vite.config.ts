// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { langplayRuntime } from "./vite-plugins/langplay-runtime";

export default defineConfig({
  // Bundles the engine into strings for exported tools (see vite-plugins/langplay-runtime.ts).
  plugins: [langplayRuntime()],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Desktop builds (Tauri) are a static single-page app: no server needed inside the installer.
    ...(process.env["LANGPLAY_DESKTOP"]
      ? { spa: { enabled: true, prerender: { outputPath: "/index.html", crawlLinks: false } } }
      : {}),
  },
});
