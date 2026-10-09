// A tiny, safe Markdown reader for AI answers. It only produces a data structure; callers turn
// it into DOM nodes or React elements, so model output is never inserted as HTML.

export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
export type Block =
  | { type: "p"; inline: Inline[] }
  | { type: "h"; level: 1 | 2 | 3; inline: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][]; start: number }
  | { type: "code"; text: string };

/** Turns LaTeX bits models like to add (\( 84 \times 0.25 \)) into readable text. */
export function cleanMath(text: string): string {
  return text
    .replace(/\\\(|\\\)|\\\[|\\\]/g, "")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\cdot/g, "·")
    .replace(/\\approx/g, "≈")
    .replace(/\\le(q)?\b/g, "≤")
    .replace(/\\ge(q)?\b/g, "≥")
    .replace(/\\%/g, "%")
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\(?:text|mathrm|mathbf)\{([^{}]*)\}/g, "$1")
    .replace(/\\,/g, " ");
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const t = m[0];
    if (t.startsWith("**") || t.startsWith("__")) out.push({ text: t.slice(2, -2), bold: true });
    else if (t.startsWith("`")) out.push({ text: t.slice(1, -1), code: true });
    else out.push({ text: t.slice(1, -1), italic: true });
    last = m.index + t.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  const lines = cleanMath(source).replace(/\r\n/g, "\n").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", inline: parseInline(para.join(" ").trim()) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^```/.test(line.trim())) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !/^```/.test((lines[i] ?? "").trim())) code.push(lines[i] ?? "");
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: "h",
        level: heading[1]!.length as 1 | 2 | 3,
        inline: parseInline(heading[2] ?? ""),
      });
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const number = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (bullet || number) {
      flush();
      const type = bullet ? "ul" : "ol";
      const prev = blocks[blocks.length - 1];
      const item = parseInline((bullet ? bullet[1] : number?.[2]) ?? "");
      if (prev && (prev.type === "ul" || prev.type === "ol") && prev.type === type)
        prev.items.push(item);
      else
        blocks.push(
          type === "ul"
            ? { type: "ul", items: [item] }
            : { type: "ol", items: [item], start: Number(number?.[1]) || 1 },
        );
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

/** DOM version for the dependency-free runner. */
export function markdownToDom(source: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const inline = (parent: HTMLElement, parts: Inline[]) => {
    for (const p of parts) {
      const node = p.code
        ? document.createElement("code")
        : p.bold
          ? document.createElement("strong")
          : p.italic
            ? document.createElement("em")
            : null;
      if (node) {
        node.textContent = p.text;
        parent.append(node);
      } else parent.append(p.text);
    }
  };
  for (const b of parseMarkdown(source)) {
    if (b.type === "code") {
      const pre = document.createElement("pre");
      pre.textContent = b.text;
      frag.append(pre);
    } else if (b.type === "ul" || b.type === "ol") {
      const list = document.createElement(b.type);
      if (b.type === "ol" && b.start > 1) list.setAttribute("start", String(b.start));
      for (const item of b.items) {
        const li = document.createElement("li");
        inline(li, item);
        list.append(li);
      }
      frag.append(list);
    } else {
      const el = document.createElement(b.type === "h" ? `h${b.level + 2}` : "p");
      inline(el, b.inline);
      frag.append(el);
    }
  }
  return frag;
}
