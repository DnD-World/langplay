import type { Source } from "./types";

// Document search for the Document Lookup step: split files into passages and rank them
// with BM25 (a classic keyword-relevance score), entirely in the user's browser.

export interface DocChunk {
  doc: string;
  page: number;
  text: string;
}

const STOP = new Set(
  "a an and are as at be but by for from has have how i if in into is it its me my of on or our so than that the their them then there these they this to was we were what when where which who why will with you your about can do does".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (w) => w.length > 1 && !STOP.has(w),
  );
}

/** Splits each page into passages of roughly `size` characters, keeping paragraphs together. */
export function chunkPages(doc: string, pages: string[], size = 700): DocChunk[] {
  const chunks: DocChunk[] = [];
  pages.forEach((pageText, i) => {
    let buffer = "";
    for (const para of pageText.split(/\n\s*\n/)) {
      const clean = para.replace(/\s+/g, " ").trim();
      if (!clean) continue;
      if (buffer && buffer.length + clean.length > size) {
        chunks.push({ doc, page: i + 1, text: buffer });
        buffer = "";
      }
      if (clean.length > size * 1.5) {
        for (let at = 0; at < clean.length; at += size)
          chunks.push({ doc, page: i + 1, text: clean.slice(at, at + size) });
      } else buffer = buffer ? `${buffer} ${clean}` : clean;
    }
    if (buffer) chunks.push({ doc, page: i + 1, text: buffer });
  });
  return chunks;
}

/** Plain text has no pages; treat every ~3000 characters as a "page" so citations stay useful. */
export function textToPages(text: string, pageSize = 3000): string[] {
  const pages: string[] = [];
  let current = "";
  for (const para of text.split(/\n\s*\n/)) {
    if (current && current.length + para.length > pageSize) {
      pages.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  if (current) pages.push(current);
  return pages;
}

export function searchChunks(chunks: DocChunk[], query: string, k = 3): Source[] {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length || !chunks.length) return [];
  const docs = chunks.map((c) => tokenize(c.text));
  const avg = docs.reduce((sum, d) => sum + d.length, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const k1 = 1.2;
  const b = 0.75;
  const scored = docs.map((d, i) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const t of terms) {
      const f = tf.get(t);
      if (!f) continue;
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avg));
    }
    return { i, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b2) => b2.score - a.score)
    .slice(0, k)
    .map(({ i }) => {
      const c = chunks[i] as DocChunk;
      return { title: `${c.doc} · p.${c.page}`, snippet: c.text };
    });
}
