import { useEffect, useState } from "react";
import type { Recipe } from "@/engine";
import { LESSONS, type LessonContext } from "@/lib/lp-lessons";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "../AnimatedIcon";
import { Info } from "../Info";

export function LessonsCard({
  context,
  done,
  onComplete,
  onLoadStarter,
}: {
  context: LessonContext;
  done: string[];
  onComplete: (id: string) => void;
  onLoadStarter: (recipe: Recipe) => void;
}) {
  const firstOpen = Math.max(
    0,
    LESSONS.findIndex((l) => !done.includes(l.id)),
  );
  const [index, setIndex] = useState(firstOpen);
  const [hint, setHint] = useState(false);
  const lesson = LESSONS[index] ?? LESSONS[0]!;
  const finished = done.includes(lesson.id);

  // Any lesson whose check now passes is completed, not just the one on screen.
  useEffect(() => {
    for (const l of LESSONS) if (!done.includes(l.id) && l.check(context)) onComplete(l.id);
  }, [context, done, onComplete]);

  // Move on to the next open lesson once the current one is done.
  useEffect(() => {
    if (finished) {
      const next = LESSONS.findIndex((l) => !done.includes(l.id));
      const timer = window.setTimeout(() => {
        if (next >= 0) setIndex(next);
        setHint(false);
      }, 1400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [finished, done]);

  return (
    <div className="lesson-card rounded-lg border bg-card/90 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center font-bold">
          <AnimatedIcon name="idea" /> Lessons
          <Info tip="Twelve small challenges. Each teaches one real LangChain / LangGraph idea and ticks itself off when you do it." />
        </h2>
        <span className="text-xs text-muted-foreground">
          {done.length} / {LESSONS.length}
        </span>
      </div>
      <div className="mb-3 flex gap-1" aria-hidden="true">
        {LESSONS.map((l, i) => (
          <button
            key={l.id}
            type="button"
            tabIndex={-1}
            onClick={() => setIndex(i)}
            className={`h-1.5 flex-1 rounded-full transition ${done.includes(l.id) ? "bg-primary" : i === index ? "bg-accent" : "bg-muted"}`}
          />
        ))}
      </div>
      <div key={lesson.id} className="animate-pop space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Lesson {index + 1} · +{lesson.xp} XP
        </div>
        <h3 className={`text-base font-extrabold ${finished ? "text-success" : ""}`}>
          {finished && <AnimatedIcon name="check" />} {lesson.title}
        </h3>
        <p className="text-sm">{lesson.goal}</p>
        <p className="rounded-lg bg-secondary/60 p-2 text-xs text-muted-foreground">
          <AnimatedIcon name="idea" /> {lesson.concept}
        </p>
        {hint && <p className="text-xs text-primary">{lesson.hint}</p>}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {lesson.starter && !finished && (
            <Button size="sm" onClick={() => onLoadStarter(lesson.starter!())}>
              Load starter
            </Button>
          )}
          {!hint && !finished && (
            <Button size="sm" variant="outline" onClick={() => setHint(true)}>
              Hint
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
            aria-label="Previous lesson"
          >
            ←
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={index === LESSONS.length - 1}
            onClick={() => setIndex(index + 1)}
            aria-label="Next lesson"
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
