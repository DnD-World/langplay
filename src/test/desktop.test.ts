import { describe, expect, it } from "vitest";
import { isDesktop, routeThroughApp } from "@/desktop/bridge";

describe("Windows app bridge", () => {
  it("never routes Tauri's own internal addresses through the app (that loops forever)", () => {
    expect(routeThroughApp("http://ipc.localhost/plugin%3Ahttp%7Cfetch")).toBe(false);
    expect(routeThroughApp("http://tauri.localhost/assets/app.js")).toBe(false);
    expect(routeThroughApp("http://localhost:20136/")).toBe(false);
  });
  it("routes AI services, tools and the local offline AI through the app", () => {
    expect(routeThroughApp("https://text.pollinations.ai/openai")).toBe(true);
    expect(routeThroughApp("https://en.wikipedia.org/w/api.php?x=1")).toBe(true);
    expect(routeThroughApp("http://127.0.0.1:12081/health")).toBe(true);
    expect(routeThroughApp("/relative/path")).toBe(false);
  });
  it("is off in a normal browser", () => {
    expect(isDesktop()).toBe(false);
  });
});
