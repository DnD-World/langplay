import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/runner/markdown";

// AI answers with light formatting (bold, lists, headings, code), rendered as React elements.

function Parts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.code ? (
          <code key={i} className="rounded bg-background/60 px-1 font-mono text-[0.9em]">
            {p.text}
          </code>
        ) : p.bold ? (
          <strong key={i}>{p.text}</strong>
        ) : p.italic ? (
          <em key={i}>{p.text}</em>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

export function Answer({ text }: { text: string }) {
  return (
    <div className="answer space-y-2">
      {parseMarkdown(text).map((b, i) => {
        if (b.type === "code")
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded border bg-background/60 p-2 font-mono text-xs"
            >
              {b.text}
            </pre>
          );
        if (b.type === "ul" || b.type === "ol") {
          const List = b.type;
          return (
            <List
              key={i}
              {...(b.type === "ol" && b.start > 1 ? { start: b.start } : {})}
              className={`${b.type === "ul" ? "list-disc" : "list-decimal"} space-y-1 pl-5`}
            >
              {b.items.map((item, j) => (
                <li key={j}>
                  <Parts parts={item} />
                </li>
              ))}
            </List>
          );
        }
        if (b.type === "h")
          return (
            <p key={i} className="font-bold">
              <Parts parts={b.inline} />
            </p>
          );
        return (
          <p key={i}>
            <Parts parts={b.inline} />
          </p>
        );
      })}
    </div>
  );
}
