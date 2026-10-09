import fs from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { pythonNotebook, pythonScript } from "@/export/python";
import { n8nWorkflow } from "@/export/n8n";
import { mcpStdioScript, mcpWorker } from "@/export/mcp";
import { toolHtml } from "@/export/html";
import { skillZip } from "@/export/skill";
import { ENGINE_JS, RUNNER_JS } from "virtual:langplay-runtime";
import { RECIPES } from "@/lib/lp-recipes";

// Writes generated files for manual end-to-end checks when LP_EXPORT_DIR is set.
const dir = process.env["LP_EXPORT_DIR"];
describe.runIf(!!dir)("write exports for manual checks", () => {
  it("writes Python and notebooks for every library recipe", () => {
    fs.mkdirSync(dir!, { recursive: true });
    for (const r of RECIPES) {
      fs.writeFileSync(path.join(dir!, `${r.id}.py`), pythonScript(r));
      fs.writeFileSync(path.join(dir!, `${r.id}.ipynb`), pythonNotebook(r));
      fs.writeFileSync(
        path.join(dir!, `${r.id}.n8n.json`),
        JSON.stringify(n8nWorkflow(r), null, 2),
      );
      fs.writeFileSync(path.join(dir!, `${r.id}-mcp.mjs`), mcpStdioScript(r, ENGINE_JS));
      fs.writeFileSync(
        path.join(dir!, `${r.id}.html`),
        toolHtml({ recipe: r, runnerJs: RUNNER_JS }),
      );
      fs.writeFileSync(path.join(dir!, `${r.id}-skill.zip`), skillZip(r));
      const w = mcpWorker(r, ENGINE_JS);
      fs.mkdirSync(path.join(dir!, `${r.id}-worker`), { recursive: true });
      fs.writeFileSync(path.join(dir!, `${r.id}-worker`, "worker.mjs"), w.worker);
      fs.writeFileSync(path.join(dir!, `${r.id}-worker`, "wrangler.toml"), w.wrangler);
    }
  });
});
