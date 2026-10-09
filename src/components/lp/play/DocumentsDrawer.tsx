import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_TOTAL_CHARS, readDocument, saveDocs, totalChars, type StoredDoc } from "@/lib/lp-docs";
import { AnimatedIcon } from "../AnimatedIcon";
import { Info } from "../Info";
import { Overlay } from "../Overlay";

export function DocumentsDrawer({
  open,
  onClose,
  docs,
  setDocs,
}: {
  open: boolean;
  onClose: () => void;
  docs: StoredDoc[];
  setDocs: (docs: StoredDoc[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | File[]) => {
    setBusy(true);
    setMsg("");
    const next = [...docs];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const doc = await readDocument(file);
        if (totalChars(next) + totalChars([doc]) > MAX_TOTAL_CHARS) {
          problems.push(`${file.name}: not enough room (about 3 million characters in total).`);
          continue;
        }
        const existing = next.findIndex((d) => d.name === doc.name);
        if (existing >= 0) next.splice(existing, 1, doc);
        else next.push(doc);
      } catch (e) {
        problems.push(e instanceof Error ? e.message : `${file.name} could not be read.`);
      }
    }
    setDocs(next);
    await saveDocs(next);
    setMsg(problems.join(" "));
    setBusy(false);
  };

  const remove = async (name: string) => {
    const next = docs.filter((d) => d.name !== name);
    setDocs(next);
    await saveDocs(next);
  };

  return (
    <Overlay open={open} onClose={onClose} title="Your documents">
      <h2 className="text-xl font-bold">
        <AnimatedIcon name="retriever" /> Your documents
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Add PDFs or text files. The <b>Document Lookup</b> step searches them and cites the page.
        Files are read inside this browser and stored only on this device — nothing is uploaded.
      </p>
      <div
        role="button"
        tabIndex={0}
        aria-label="Add documents"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") input.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void add(e.dataTransfer.files);
        }}
        className={`grid cursor-pointer place-items-center rounded-lg border-2 border-dashed p-8 text-center transition ${dragging ? "border-primary bg-primary/10" : "hover:border-primary/60"}`}
      >
        <AnimatedIcon name="retriever" className="text-3xl" />
        <p className="mt-2 font-semibold">
          {busy ? "Reading…" : "Drop files here or click to choose"}
        </p>
        <p className="text-xs text-muted-foreground">PDF, TXT, MD, CSV · up to 15 MB each</p>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.markdown,.csv,.json,.html,application/pdf,text/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {msg && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {msg}
        </p>
      )}
      <ul className="mt-4 space-y-2">
        {docs.map((d) => (
          <li key={d.name} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
            <AnimatedIcon name="retriever" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{d.name}</div>
              <div className="text-xs text-muted-foreground">
                {d.pages} page{d.pages === 1 ? "" : "s"} · {d.chunks.length} passages ·{" "}
                {Math.max(1, Math.round(d.size / 1024))} KB
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void remove(d.name)}
              aria-label={`Remove ${d.name}`}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {!docs.length && (
        <p className="mt-4 text-xs text-muted-foreground">
          No documents yet. Without one, Document Lookup uses clearly labelled practice notes.
          <Info tip="Scanned PDFs (photos of pages) have no text to search; run them through OCR first." />
        </p>
      )}
    </Overlay>
  );
}
