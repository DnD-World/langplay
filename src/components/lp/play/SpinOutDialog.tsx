import { useEffect, useMemo, useState } from "react";
import { ENGINE_JS, RUNNER_JS } from "virtual:langplay-runtime";
import {
  encodeRecipe,
  slugify,
  type DocChunk,
  type LlmSettings,
  type Recipe,
  type SpinoutProvider,
} from "@/engine";
import { embedSnippet, toolHtml } from "@/export/html";
import { mcpStdioScript, mcpToolName, mcpWorker } from "@/export/mcp";
import { n8nWorkflow } from "@/export/n8n";
import { pythonNotebook, pythonScript } from "@/export/python";
import { skillMarkdown, skillName, skillZip, systemPrompt } from "@/export/skill";
import { zip } from "@/export/zip";
import { downloadText } from "@/lib/lp-saved";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "../AnimatedIcon";
import { Info, inputCls } from "../Info";
import { Overlay } from "../Overlay";

type Tab = "page" | "embed" | "html" | "python" | "skill" | "n8n" | "mcp";
const TABS: { id: Tab; label: string; blurb: string }[] = [
  {
    id: "page",
    label: "Tool page",
    blurb: "A clean page with just your recipe. Share the link; nothing to host.",
  },
  {
    id: "embed",
    label: "Embed",
    blurb: "Put the tool inside any website (WordPress, Webflow, a blog).",
  },
  {
    id: "html",
    label: "HTML file",
    blurb: "One file that runs anywhere: open it, email it, upload it.",
  },
  {
    id: "python",
    label: "Python",
    blurb: "Real LangGraph code for your own computer or a notebook.",
  },
  {
    id: "skill",
    label: "Claude skill",
    blurb: "Teach Claude your recipe as a skill, or paste it as a system prompt.",
  },
  {
    id: "n8n",
    label: "n8n",
    blurb: "A workflow you can schedule, trigger from other apps, or call as an API.",
  },
  {
    id: "mcp",
    label: "MCP tool",
    blurb: "Let Claude call your recipe as a tool — on your computer or in the cloud.",
  },
];

function downloadBytes(filename: string, bytes: Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Copy({
  text,
  label = "Copy",
  onDone,
}: {
  text: string;
  label?: string;
  onDone?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          onDone?.();
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked: the text stays visible to copy by hand */
        }
      }}
    >
      <AnimatedIcon name={copied ? "check" : "code"} /> {copied ? "Copied" : label}
    </Button>
  );
}

const Preview = ({ text, lines = 18 }: { text: string; lines?: number }) => (
  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-background/70 p-3 font-mono text-[11px] leading-relaxed text-success">
    {text.split("\n").slice(0, lines).join("\n")}
    {text.split("\n").length > lines ? "\n…" : ""}
  </pre>
);

export default function SpinOutDialog({
  open,
  onClose,
  recipe,
  settings,
  docs,
  onEvent,
  setSpinout,
}: {
  open: boolean;
  onClose: () => void;
  recipe: Recipe;
  settings: LlmSettings;
  docs: DocChunk[];
  onEvent: (event: "spinout" | "python") => void;
  setSpinout: (provider: SpinoutProvider) => void;
}) {
  const [tab, setTab] = useState<Tab>("page");
  const [code, setCode] = useState("");
  const [withDocs, setWithDocs] = useState(false);
  const provider = recipe.spinout?.provider ?? "pollinations";
  const slug = slugify(recipe.title);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const { id: _id, ...clean } = recipe;
    void encodeRecipe(clean as Recipe).then((c) => alive && setCode(c));
    return () => {
      alive = false;
    };
  }, [open, recipe]);
  const toolUrl = code ? `${location.origin}/tool#r=${code}` : "";
  const embedUrl = code ? `${location.origin}/tool?embed=1#r=${code}` : "";
  const remixUrl = code ? `${location.origin}/#r=${code}` : "";
  const shipped = () => onEvent("spinout");

  const python = useMemo(
    () => (tab === "python" ? pythonScript(recipe, settings) : ""),
    [tab, recipe, settings],
  );
  const skill = useMemo(() => (tab === "skill" ? skillMarkdown(recipe) : ""), [tab, recipe]);
  const mcpConfig = JSON.stringify(
    { mcpServers: { [slug]: { command: "node", args: [`C:/path/to/${slug}-mcp.mjs`] } } },
    null,
    2,
  );

  return (
    <Overlay open={open} onClose={onClose} wide title="Spin out">
      <h2 className="text-xl font-bold">
        <AnimatedIcon name="spark" /> Spin out “{recipe.title}”
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Turn this recipe into its own tool. Every format runs the same steps you built here.
      </p>
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border p-1" role="tablist">
        {TABS.map((t) => (
          <Button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            variant="ghost"
            size="sm"
            onClick={() => setTab(t.id)}
            className={`font-semibold ${tab === t.id ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : ""}`}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <p className="mb-4 text-sm">{TABS.find((t) => t.id === tab)?.blurb}</p>

      {(tab === "page" || tab === "embed" || tab === "html") && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Who answers visitors
          </span>
          <select
            aria-label="Who answers visitors"
            className={`${inputCls} w-auto py-1.5 text-xs`}
            value={provider}
            onChange={(e) => setSpinout(e.target.value as SpinoutProvider)}
          >
            <option value="pollinations">Free AI (Pollinations → OVH → practice)</option>
            <option value="ovh">OVHcloud free tier</option>
            <option value="visitor">The visitor's own key</option>
            <option value="simulator">Practice mode (offline)</option>
          </select>
          <Info tip="Your own API key is never put in a spun-out tool. Visitors can always switch to their own key with the ⚙ button." />
        </div>
      )}

      {tab === "page" && (
        <div className="space-y-3">
          <input
            readOnly
            aria-label="Tool link"
            className={`${inputCls} font-mono text-xs`}
            value={toolUrl}
          />
          <div className="flex flex-wrap gap-2">
            <Copy text={toolUrl} label="Copy link" onDone={shipped} />
            <Button size="sm" asChild onClick={shipped}>
              <a href={toolUrl} target="_blank" rel="noreferrer">
                Open tool page ↗
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            The recipe lives inside the link (after #), so there is nothing to host and nothing
            stored on a server. On a phone, open it and use “Add to Home screen” to keep it like an
            app.
          </p>
        </div>
      )}

      {tab === "embed" && (
        <div className="space-y-3">
          <Preview text={embedSnippet(embedUrl, recipe.title)} lines={6} />
          <div className="flex flex-wrap gap-2">
            <Copy
              text={embedSnippet(embedUrl, recipe.title)}
              label="Copy embed code"
              onDone={shipped}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            WordPress: add a “Custom HTML” block and paste. Most site builders have an “Embed /
            HTML” block that works the same way.
          </p>
        </div>
      )}

      {tab === "html" && (
        <div className="space-y-3">
          {docs.length > 0 && recipe.nodes.some((n) => n.kind === "retriever") && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={withDocs}
                onChange={(e) => setWithDocs(e.target.checked)}
              />
              Include the text of my documents ({docs.length} passages) — anyone with the file can
              read them
            </label>
          )}
          <Button
            onClick={() => {
              downloadText(
                `${slug}.html`,
                toolHtml({ recipe, runnerJs: RUNNER_JS, ...(withDocs ? { docs } : {}), remixUrl }),
                "text/html",
              );
              shipped();
            }}
          >
            <AnimatedIcon name="code" /> Download {slug}.html
          </Button>
          <p className="text-xs text-muted-foreground">
            About {Math.round((RUNNER_JS.length + JSON.stringify(recipe).length) / 1024)} KB. Works
            offline in practice mode; real answers need internet. Reads .txt and .md documents.
          </p>
        </div>
      )}

      {tab === "python" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                downloadText(`${slug.replace(/-/g, "_")}.py`, python, "text/x-python");
                onEvent("python");
                shipped();
              }}
            >
              <AnimatedIcon name="code" /> Download .py
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadText(
                  `${slug}.ipynb`,
                  pythonNotebook(recipe, settings),
                  "application/x-ipynb+json",
                );
                onEvent("python");
                shipped();
              }}
            >
              Download notebook (.ipynb)
            </Button>
            <Copy text={python} label="Copy code" onDone={() => onEvent("python")} />
          </div>
          <p className="text-xs text-muted-foreground">
            Run: <code>pip install -U langgraph langchain-openai requests</code> then{" "}
            <code>python {slug.replace(/-/g, "_")}.py "your question"</code>. For Google Colab,
            upload the notebook at colab.research.google.com. Your API key is never included.
          </p>
          <Preview text={python} lines={40} />
        </div>
      )}

      {tab === "skill" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                downloadBytes(`${skillName(recipe)}.zip`, skillZip(recipe), "application/zip");
                shipped();
              }}
            >
              <AnimatedIcon name="code" /> Download skill (.zip)
            </Button>
            <Copy text={systemPrompt(recipe)} label="Copy as system prompt" onDone={shipped} />
          </div>
          <p className="text-xs text-muted-foreground">
            Claude: Settings → Capabilities → Skills → Upload skill. Claude Code: unzip into{" "}
            <code>~/.claude/skills/</code>. The system prompt works in Claude Projects, custom GPTs
            and most chat apps.
          </p>
          <Preview text={skill} lines={30} />
        </div>
      )}

      {tab === "n8n" && (
        <div className="space-y-3">
          <Button
            onClick={() => {
              downloadText(
                `${slug}.n8n.json`,
                JSON.stringify(n8nWorkflow(recipe, settings), null, 2),
              );
              shipped();
            }}
          >
            <AnimatedIcon name="code" /> Download n8n workflow
          </Button>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>In n8n: Workflows → ⋯ → Import from File.</li>
            <li>
              Open the <b>Settings</b> node to change the AI service or add your key.
            </li>
            <li>
              Activate it, then send a POST to <code>/webhook/langplay-{slug}</code> with{" "}
              <code>{`{"question": "…"}`}</code>.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Each step is its own node; routers become Switch nodes and critic loops become IF nodes
            that loop back. Send <code>documents</code> in the request for Document Lookup steps.
          </p>
        </div>
      )}

      {tab === "mcp" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-bold">On your computer (Claude Desktop / Claude Code)</h3>
            <Button
              onClick={() => {
                downloadText(
                  `${slug}-mcp.mjs`,
                  mcpStdioScript(recipe, ENGINE_JS, settings),
                  "text/javascript",
                );
                shipped();
              }}
            >
              <AnimatedIcon name="code" /> Download {slug}-mcp.mjs
            </Button>
            <p className="text-xs text-muted-foreground">
              One file, no installs (needs Node 20+). Claude Desktop: Settings → Developer → Edit
              Config, add this, restart:
            </p>
            <Preview text={mcpConfig} lines={10} />
            <div className="flex flex-wrap gap-2">
              <Copy text={mcpConfig} label="Copy config" />
              <Copy
                text={`claude mcp add ${slug} -- node /path/to/${slug}-mcp.mjs`}
                label="Copy Claude Code command"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Claude will see a tool called <code>{mcpToolName(recipe)}</code>.
            </p>
          </div>
          <div className="space-y-2 border-t pt-4">
            <h3 className="font-bold">In the cloud (Cloudflare Workers)</h3>
            <Button
              variant="outline"
              onClick={() => {
                const w = mcpWorker(recipe, ENGINE_JS, settings);
                downloadBytes(
                  `${slug}-mcp-worker.zip`,
                  zip([
                    { name: `${slug}-mcp/worker.mjs`, text: w.worker },
                    { name: `${slug}-mcp/wrangler.toml`, text: w.wrangler },
                    { name: `${slug}-mcp/README.md`, text: w.readme },
                  ]),
                  "application/zip",
                );
                shipped();
              }}
            >
              Download Worker project (.zip)
            </Button>
            <p className="text-xs text-muted-foreground">
              A remote MCP server protected by a password you choose (
              <code>wrangler secret put LANGPLAY_TOKEN</code>); requests without it are refused.
              Deploy with <code>npx wrangler deploy</code> — steps in the README.
            </p>
          </div>
        </div>
      )}
    </Overlay>
  );
}
