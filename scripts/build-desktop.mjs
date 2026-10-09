// Static single-page build for the Tauri desktop app (no server inside the installer).
import { execSync } from "node:child_process";

execSync("vite build", { stdio: "inherit", env: { ...process.env, LANGPLAY_DESKTOP: "1" } });
