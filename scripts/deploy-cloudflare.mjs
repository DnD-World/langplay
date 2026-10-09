// Deploys the built web app to Cloudflare Workers at langplay.stravelakis.com.
// Run after `bun run build`. Uses your `npx wrangler login` session (or CLOUDFLARE_API_TOKEN
// if it has Workers edit rights).
import { execSync } from "node:child_process";
import fs from "node:fs";

const file = ".output/server/wrangler.json";
if (!fs.existsSync(file)) throw new Error("Run `bun run build` first.");
const config = JSON.parse(fs.readFileSync(file, "utf8"));
config.name = "langplay";
config.workers_dev = false;
config.routes = [{ pattern: "langplay.stravelakis.com", custom_domain: true }];
fs.writeFileSync(file, JSON.stringify(config, null, 2));
execSync(`npx -y wrangler@4 deploy --config ${file}`, { stdio: "inherit" });
