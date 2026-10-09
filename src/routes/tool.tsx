import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { decodeRecipe, encodeRecipe, recipeCodeFromHash } from "@/engine";
import { pdfPages } from "@/lib/lp-docs";
import { mountRunner } from "@/runner/ui";

// A spun-out recipe as its own page: /tool#r=<recipe>. Add ?embed=1 for iframes.

export const Route = createFileRoute("/tool")({
  head: () => ({
    meta: [
      { title: "Langplay tool" },
      { name: "description", content: "An AI tool built with Langplay." },
      { property: "og:title", content: "An AI tool built with Langplay" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ToolPage,
});

function ToolPage() {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const code = recipeCodeFromHash(location.hash);
    if (!code) {
      setError("This link has no recipe in it.");
      return;
    }
    let runner: { destroy: () => void } | undefined;
    let cancelled = false;
    const embed = new URLSearchParams(location.search).get("embed") === "1";
    decodeRecipe(code)
      .then(async (recipe) => {
        if (cancelled || !host.current) return;
        document.title = recipe.title;
        if (embed) document.body.style.background = "transparent";
        runner = mountRunner(host.current, {
          recipe,
          embed,
          readPdf: pdfPages,
          remixUrl: `${location.origin}/#r=${await encodeRecipe(recipe)}`,
        });
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "This tool link is damaged."),
      );
    return () => {
      cancelled = true;
      runner?.destroy();
    };
  }, []);
  if (error)
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground">
        <div>
          <h1 className="text-xl font-bold">{error}</h1>
          <Link to="/" className="mt-4 inline-block text-primary underline">
            Open Langplay
          </Link>
        </div>
      </div>
    );
  return <div ref={host} />;
}
