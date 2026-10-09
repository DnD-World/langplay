import { beforeEach, describe, expect, it } from "vitest";
import { deleteConnection, listConnections, saveConnection } from "@/lib/lp-connections";

const groq = {
  provider: "groq",
  baseUrl: "https://api.groq.com/openai/v1",
  apiKey: "k1",
  model: "llama",
};
const custom = {
  provider: "custom",
  baseUrl: "https://my.server/v1",
  apiKey: "k2",
  model: "m",
  modelFreeVerified: true,
};

describe("my AI connections", () => {
  beforeEach(() => localStorage.clear());
  it("saves several services, newest first, and replaces one with the same name", () => {
    saveConnection("Groq", groq);
    saveConnection("Home server", custom);
    expect(listConnections().map((c) => c.name)).toEqual(["Home server", "Groq"]);
    expect(listConnections()[0]!.settings).not.toHaveProperty("modelFreeVerified");
    saveConnection("Groq", { ...groq, model: "other" });
    expect(listConnections()).toHaveLength(2);
    expect(listConnections()[0]!.settings.model).toBe("other");
  });
  it("deletes and ignores damaged storage", () => {
    const [first] = saveConnection("Groq", groq);
    expect(deleteConnection(first!.id)).toEqual([]);
    localStorage.setItem("lp-connections", '[{"bad":1}, null]');
    expect(listConnections()).toEqual([]);
  });
});
