import { normalizeRecipe } from "./recipe";
import type { Recipe } from "./types";

// Recipes travel inside links as compressed, URL-safe text after "#r=". The part after "#"
// is never sent to a server, so shared recipes stay between the people who have the link.

const MAX_DECODED = 200_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const body = new Response(bytes as BodyInit).body;
  if (!body) throw new Error("Streams are not supported here.");
  return new Uint8Array(await new Response(body.pipeThrough(stream)).arrayBuffer());
}

export async function encodeRecipe(recipe: Recipe): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(recipe));
  return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeRecipe(code: string): Promise<Recipe> {
  if (!/^[\w-]{1,100000}$/.test(code)) throw new Error("This recipe link is damaged.");
  let bytes: Uint8Array;
  try {
    bytes = await pipe(fromBase64Url(code), new DecompressionStream("deflate-raw"));
  } catch {
    throw new Error("This recipe link is damaged or incomplete.");
  }
  if (bytes.length > MAX_DECODED) throw new Error("This recipe link is too large.");
  return normalizeRecipe(JSON.parse(new TextDecoder().decode(bytes)));
}

/** Reads "#r=…" (also accepted inside other hash parameters). */
export function recipeCodeFromHash(hash: string): string | null {
  const match = /(?:^#|&)r=([\w-]+)/.exec(hash);
  return match?.[1] ?? null;
}
