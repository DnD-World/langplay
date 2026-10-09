import type { ReactNode } from "react";
import type { RecipeNode } from "@/engine";
import { KINDS, QUESTS } from "@/lib/lp-data";
import { rankFor } from "./helpers";
import { AnimatedIcon } from "../AnimatedIcon";
import { SquishToggle } from "../EffectControls";
import { Info, Label } from "../Info";

export function LearnPanel({
  active,
  showCode,
  setShowCode,
  points,
  done,
  lessons,
}: {
  active: RecipeNode | null;
  showCode: boolean;
  setShowCode: (on: boolean) => void;
  points: number;
  done: string[];
  lessons?: ReactNode;
}) {
  const { rank, next } = rankFor(points);
  return (
    <section className="space-y-4" aria-label="Learn">
      <div className="rounded-lg border bg-card/90 p-4">
        <h2 className="mb-3 flex items-center font-bold">
          <AnimatedIcon name="retriever" /> Concept Card
          <Info tip="Click any step to learn what it is and what experts call it." />
        </h2>
        {active ? (
          <div key={active.id} className="animate-pop space-y-3">
            <div className="text-4xl">
              <AnimatedIcon name={active.kind} />
            </div>
            <h3 className="text-lg font-extrabold">{KINDS[active.kind].title}</h3>
            <p className="text-sm">{KINDS[active.kind].plain}</p>
            <p className="rounded-lg bg-secondary/60 p-2 text-xs italic text-muted-foreground">
              <AnimatedIcon name="idea" /> {KINDS[active.kind].analogy}
            </p>
            <div>
              <Label tip="The official name programmers use for this piece.">Under the hood</Label>
              <code className="rounded bg-primary/15 px-2 py-1 font-mono text-xs text-primary">
                {KINDS[active.kind].techName}
              </code>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <SquishToggle label="Show Python code" checked={showCode} onChange={setShowCode} />
              Show Python code
              <Info tip="Peek at the real LangGraph code for this kind of step. Export your whole recipe as Python from Spin out." />
            </div>
            {showCode && (
              <pre className="animate-pop overflow-x-auto rounded-lg border bg-background p-3 font-mono text-[11px] leading-relaxed text-success">
                {KINDS[active.kind].code}
              </pre>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a step in your recipe to learn about it.
          </p>
        )}
      </div>

      {lessons}

      <div className="rounded-lg border bg-card/90 p-4">
        <h2 className="mb-2 flex items-center font-bold">
          <AnimatedIcon name="target" /> Milestones
          <Info tip="Little challenges that teach you the ropes and earn rewards." />
        </h2>
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{rank.name}</span>
            <span>{next ? `${next.min - points} XP to ${next.name}` : "Max rank!"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{
                width: `${next ? Math.min(100, ((points - rank.min) / (next.min - rank.min)) * 100) : 100}%`,
              }}
            />
          </div>
        </div>
        <ul className="space-y-1.5 text-sm">
          {QUESTS.map((q) => {
            const ok = done.includes(q.id);
            return (
              <li
                key={q.id}
                className={`flex items-center gap-2 rounded-lg px-2 py-1 ${ok ? "bg-success/10" : ""}`}
              >
                <AnimatedIcon name={ok ? "check" : "circle"} />
                <span className={`flex-1 ${ok ? "text-success" : ""}`}>
                  {ok && q.id === "konami" ? "Konami Master" : q.title}
                </span>
                <span className="text-[11px] text-muted-foreground">+{q.pts}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
