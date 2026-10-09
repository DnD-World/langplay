import { describe, expect, it } from "vitest";
import vm from "node:vm";
import { ENGINE_JS, RUNNER_JS } from "virtual:langplay-runtime";
import type { Recipe } from "@/engine";
import { embedSnippet, scriptJson, toolHtml } from "@/export/html";
import { mcpStdioScript, mcpToolName, mcpWorker } from "@/export/mcp";
import { n8nWorkflow } from "@/export/n8n";
import { pythonNotebook, pythonScript } from "@/export/python";
import { skillMarkdown, skillZip, systemPrompt } from "@/export/skill";
import { crc32 } from "@/export/zip";
import { RECIPES } from "@/lib/lp-recipes";

const byId = (id: string) => RECIPES.find((r) => r.id === id)!;

describe("spin-outs", () => {
  it("HTML file cannot be broken out of by recipe text", () => {
    const evil: Recipe = {
      ...byId("fact"),
      title: '</script><script>alert(1)</script>"<b>',
      summary: "<img src=x onerror=alert(1)>",
    };
    const html = toolHtml({ recipe: evil, runnerJs: RUNNER_JS });
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;/script&gt;");
    expect(scriptJson("</script>")).toBe('"\\u003c/script\\u003e"');
    expect(embedSnippet('https://x/tool#r="><svg>', "t")).not.toContain('"><svg>');
  });

  it("skill describes branches and loops in plain words", () => {
    expect(skillMarkdown(byId("router"))).toMatch(
      /"billing" → continue at step 3; "tech" → continue at step 4/,
    );
    expect(skillMarkdown(byId("duo"))).toMatch(/go back to step 2 .*at most 2 times/);
    expect(skillMarkdown(byId("router"))).toMatch(
      /^---\nname: smart-support-router\ndescription: /,
    );
    expect(systemPrompt(byId("math"))).toContain("calculator");
    const z = skillZip(byId("router"));
    expect([...z.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("Python uses conditional edges for routers and critic loops, and never contains keys", () => {
    const keyed = {
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-secret-123",
      model: "gpt-4o-mini",
    };
    const router = pythonScript(byId("router"), keyed);
    expect(router).toContain(
      'graph.add_conditional_edges("step_2_smart_router", lambda state: state["route"], {"billing": "step_3_billing_specialist", "tech": "step_4_tech_specialist"})',
    );
    expect(router).not.toContain("sk-secret-123");
    expect(router).toContain('"https://api.openai.com/v1"');
    expect(pythonScript(byId("duo"))).toContain(
      '{"good": "step_4_final_answer", "needs_work": "step_2_writer"})  # a loop!',
    );
    const nb = JSON.parse(pythonNotebook(byId("math")));
    expect(nb.nbformat).toBe(4);
    expect(nb.cells[1].source[0]).toContain("%pip install");
  });

  it("n8n workflow mirrors the graph: Switch for routes, IF loop for the critic", () => {
    const wf = n8nWorkflow(byId("router"));
    const sw = wf.nodes.find((n) => n.type === "n8n-nodes-base.switch")!;
    expect(wf.connections[sw.name]!.main.map((o) => o[0]!.node)).toEqual([
      "3. Billing specialist",
      "4. Tech specialist",
    ]);
    const loop = n8nWorkflow(byId("duo"));
    const gate = loop.nodes.find((n) => n.type === "n8n-nodes-base.if")!;
    expect(loop.connections[gate.name]!.main.map((o) => o[0]!.node)).toEqual([
      "4. Final Answer",
      "2. Writer",
    ]);
    expect(wf.nodes.find((n) => n.name === "Webhook")!.parameters["path"]).toBe(
      "langplay-smart-support-router",
    );
    expect(
      JSON.stringify(
        n8nWorkflow(byId("router"), {
          provider: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "sk-x",
          model: "m",
        }),
      ),
    ).not.toContain("sk-x");
  });

  it("MCP server answers the protocol and runs the recipe", async () => {
    const src = mcpStdioScript(byId("router"), ENGINE_JS);
    // Run the handler part only (no stdio) inside a sandbox, using the Simulator.
    const body = src.slice(src.indexOf("function settings()"), src.indexOf("// stdio transport"));
    const context = vm.createContext({
      process: { env: {} },
      setTimeout,
      clearTimeout,
      AbortSignal,
      fetch,
      console,
    });
    vm.runInContext(
      `${ENGINE_JS}\n${src.match(/const RECIPE = .*;/)![0]}\n${body}\nLangplay.createChat = () => Langplay.simulatorChat;\nthis.handle = handle;`,
      context,
    );
    const handle = (
      context as unknown as {
        handle: (m: unknown) => Promise<{
          result?: { tools?: { name: string }[]; content?: { text: string }[] };
          error?: { code: number };
        } | null>;
      }
    ).handle;
    expect(
      (await handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }))?.result?.tools?.[0]?.name,
    ).toBe(mcpToolName(byId("router")));
    expect(await handle({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    expect((await handle({ jsonrpc: "2.0", id: 2, method: "nope" }))?.error?.code).toBe(-32601);
    const call = await handle({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "smart_support_router",
        arguments: { question: "refund please", show_steps: true },
      },
    });
    expect(call?.result?.content?.[0]?.text).toContain("routed to: billing");
  });

  it("Cloudflare Worker requires the token", () => {
    const { worker, wrangler } = mcpWorker(byId("math"), ENGINE_JS);
    expect(worker).toContain('safeEqual(auth, "Bearer " + env.LANGPLAY_TOKEN)');
    expect(worker).toContain("Unauthorized");
    expect(wrangler).not.toMatch(/LANGPLAY_TOKEN\s*=/);
  });
});
