import { get, set } from "idb-keyval";
import { chunkPages, searchChunks, textToPages, type DocChunk, type DocSearch } from "@/engine";

// The user's own documents for the Document Lookup step. Files are read and indexed in the
// browser and kept in IndexedDB on this device; nothing is uploaded anywhere.

export interface StoredDoc {
  name: string;
  size: number;
  pages: number;
  addedAt: string;
  chunks: DocChunk[];
}

const KEY = "lp-docs";
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_TOTAL_CHARS = 3_000_000;

export async function loadDocs(): Promise<StoredDoc[]> {
  try {
    const docs = await get<StoredDoc[]>(KEY);
    return Array.isArray(docs) ? docs : [];
  } catch {
    return [];
  }
}

export async function saveDocs(docs: StoredDoc[]) {
  try {
    await set(KEY, docs);
  } catch {
    /* IndexedDB may be blocked (private mode); documents stay for this visit only */
  }
}

async function pdfPages(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let text = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      text += item.str + (item.hasEOL ? "\n" : " ");
    }
    pages.push(text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n"));
  }
  return pages;
}

export async function readDocument(file: File): Promise<StoredDoc> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 15 MB.`);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isText =
    /^text\//.test(file.type) || /\.(txt|md|markdown|csv|json|html?)$/i.test(file.name);
  if (!isPdf && !isText)
    throw new Error(`${file.name}: use a PDF or a text file (.txt, .md, .csv).`);
  const pages = isPdf ? await pdfPages(file) : textToPages(await file.text());
  const chunks = chunkPages(file.name, pages);
  if (!chunks.length)
    throw new Error(
      `${file.name} has no readable text${isPdf ? " (scanned PDFs need OCR first)" : ""}.`,
    );
  return {
    name: file.name,
    size: file.size,
    pages: pages.length,
    addedAt: new Date().toISOString(),
    chunks,
  };
}

export const totalChars = (docs: StoredDoc[]) =>
  docs.reduce((sum, d) => sum + d.chunks.reduce((s, c) => s + c.text.length, 0), 0);

export function docSearch(docs: StoredDoc[]): DocSearch | undefined {
  if (!docs.length) return undefined;
  const chunks = docs.flatMap((d) => d.chunks);
  return (query, k) => searchChunks(chunks, query, k);
}
