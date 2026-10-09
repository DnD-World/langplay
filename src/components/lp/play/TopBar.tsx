import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PROVIDERS } from "@/lib/lp-data";
import { RECIPES } from "@/lib/lp-recipes";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "../AnimatedIcon";
import { Info, btn } from "../Info";
import { rankFor } from "./helpers";

export function TopBar({
  points,
  coins,
  provider,
  onLibrary,
  onSettings,
  extra,
}: {
  points: number;
  coins: number;
  provider: string;
  onLibrary: () => void;
  onSettings: () => void;
  extra?: ReactNode;
}) {
  const { rank } = rankFor(points);
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <img
          className="brand-logo"
          src="/brand/langplay-mark-dark.png"
          alt="Langplay logo"
          width={60}
          height={40}
        />
        <div>
          <h1 className="text-lg font-extrabold leading-none tracking-tight">
            Lang<span className="text-primary">play</span>
          </h1>
          <p className="text-[11px] text-muted-foreground">Your AI adventure</p>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="nav-stat">
          <span className="animate-pop" key={rank.name}>
            <AnimatedIcon name="crown" />
          </span>
          <span className="font-bold">{rank.name}</span>
          <Info tip="Your level — earn XP by completing milestones and lessons to rank up." />
        </div>
        <div className="nav-stat font-bold text-primary">
          <AnimatedIcon name="spark" /> {points} XP
        </div>
        <div className="nav-stat font-bold text-coin">
          <AnimatedIcon name="coin" /> {coins}
          <Info tip="Token Coins — a fun reward you collect for finishing milestones." />
        </div>
        <Button asChild variant="ghost" className={`${btn} border bg-card hover:border-primary`}>
          <Link to="/docs">Docs</Link>
        </Button>
        <Button
          variant="ghost"
          onClick={onLibrary}
          className={`${btn} relative border bg-card hover:border-primary`}
        >
          <AnimatedIcon name="tool" /> Explore Library
          <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] text-accent-foreground">
            {RECIPES.length}
          </span>
        </Button>
        {extra}
        <Button
          onClick={onSettings}
          aria-label="Open settings"
          className={`${btn} hover:brightness-110`}
        >
          <AnimatedIcon name="settings" /> Settings
          <span className="rounded-full bg-background/40 px-2 py-0.5 text-[10px] font-normal">
            {PROVIDERS.find((p) => p.id === provider)?.name ?? provider}
          </span>
        </Button>
      </div>
    </header>
  );
}
