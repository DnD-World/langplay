import { describe, expect, it } from "vitest";
import { docSearch, readDocument } from "@/lib/lp-docs";

describe("your documents", () => {
  it("reads a text file into searchable, page-cited passages", async () => {
    const file = new File(
      ["Cats sleep a lot.\n\nGoldfish need a filtered tank of at least forty litres."],
      "pets.txt",
      { type: "text/plain" },
    );
    const doc = await readDocument(file);
    expect(doc.pages).toBe(1);
    const search = docSearch([doc]);
    expect(search?.("goldfish tank", 1)[0]?.title).toBe("pets.txt · p.1");
  });
  it("refuses files it cannot read safely", async () => {
    await expect(readDocument(new File(["x"], "app.exe"))).rejects.toThrow("PDF or a text file");
    await expect(
      readDocument(new File(["   "], "empty.txt", { type: "text/plain" })),
    ).rejects.toThrow("no readable text");
  });
  it("has no search when there are no documents", () => {
    expect(docSearch([])).toBeUndefined();
  });
});
