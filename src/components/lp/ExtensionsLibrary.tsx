import { useMemo, useState } from "react";
import { LIBRARY, type LibraryKind } from "@/lib/lp-library";
import { Button } from "@/components/ui/button";
import { inputCls, Info, Label } from "./Info";
import { AnimatedIcon } from "./AnimatedIcon";
import BorderGlow from "./react-bits/BorderGlow";

export function ExtensionsLibrary() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("All");
  const [category, setCategory] = useState("All");
  const [access, setAccess] = useState("All");
  const [sort, setSort] = useState("name");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const categories = [...new Set(LIBRARY.map((e) => e.category))];
  const entries = useMemo(
    () =>
      LIBRARY.filter(
        (e) =>
          (kind === "All" || e.kind === kind) &&
          (category === "All" || e.category === category) &&
          (access === "All" || e.access === access) &&
          `${e.name} ${e.summary} ${e.category}`.toLowerCase().includes(q.toLowerCase()),
      ).sort((a, b) =>
        sort === "kind"
          ? a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
          : a.name.localeCompare(b.name),
      ),
    [q, kind, category, access, sort],
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AnimatedIcon name="tool" />
        <input
          className={inputCls}
          aria-label="Search extensions"
          placeholder="Search tasks, services or libraries…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Info tip="Find tools, app connections and instruction collections by what you want to do." />
      </div>
      <div className="flex flex-wrap gap-2">
        {(["All", "Tools", "MCPs", "Plugins", "Skills"] as (LibraryKind | "All")[]).map((t) => (
          <Button
            type="button"
            key={t}
            variant={kind === t ? "default" : "outline"}
            size="sm"
            onClick={() => setKind(t)}
            aria-pressed={kind === t}
          >
            {t}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label tip="Choose the kind of task the extension helps with.">Task</Label>
          <select
            aria-label="Extension task"
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option>All</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <Label tip="Show public reading, services needing accounts, or tools requiring local setup.">
            Access
          </Label>
          <select
            aria-label="Extension access"
            className={inputCls}
            value={access}
            onChange={(e) => setAccess(e.target.value)}
          >
            <option>All</option>
            {["Account/key", "Local setup", "Public reading"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <Label tip="Order results by name or extension type.">Sort</Label>
          <select
            aria-label="Sort extensions"
            className={inputCls}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="name">Name A–Z</option>
            <option value="kind">Type, then name</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {entries.length} curated results · {saved.length} shortlisted · Discovery only; no service
        connected
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map((e) => (
          <BorderGlow key={e.name}>
            <article className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold">{e.name}</h3>
                <span className="text-xs text-primary">{e.kind}</span>
              </div>
              <p className="text-sm text-muted-foreground">{e.summary}</p>
              <p className="text-xs text-primary">
                {e.category} · {e.access}
              </p>
              {expanded === e.name && (
                <div className="space-y-2 border-y py-3 text-xs">
                  <p>
                    <b>Needs: </b>
                    {e.needs}
                  </p>
                  <p>
                    <b>Next step: </b>
                    {e.next}
                  </p>
                  <p className="text-muted-foreground">
                    {e.status}. Installing external code requires a compatible host and your
                    approval.
                  </p>
                  <Button asChild variant="link" size="sm" className="px-0">
                    <a href={e.docs} target="_blank" rel="noreferrer">
                      Setup and permissions ↗
                    </a>
                  </Button>
                </div>
              )}
              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpanded(expanded === e.name ? null : e.name)}
                  aria-expanded={expanded === e.name}
                >
                  <AnimatedIcon name="inspect" />
                  Details
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={e.url} target="_blank" rel="noreferrer">
                    Open library ↗
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant={saved.includes(e.name) ? "secondary" : "outline"}
                  aria-pressed={saved.includes(e.name)}
                  onClick={() =>
                    setSaved((s) =>
                      s.includes(e.name) ? s.filter((n) => n !== e.name) : [...s, e.name],
                    )
                  }
                >
                  {saved.includes(e.name) ? (
                    <AnimatedIcon name="check" />
                  ) : (
                    <AnimatedIcon name="target" />
                  )}
                  Shortlist
                </Button>
              </div>
            </article>
          </BorderGlow>
        ))}
      </div>
      {entries.length === 0 && (
        <p className="py-6 text-sm text-muted-foreground">No results match these filters.</p>
      )}
    </div>
  );
}
