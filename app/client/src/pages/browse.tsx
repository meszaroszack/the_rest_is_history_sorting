import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  ERA_ORDER,
  useAtlas,
  useDebounced,
  usePageMeta,
  formatYear,
  type Episode,
} from "@/lib/atlas";
import { Chip, EmptyState, EpisodeCard, Loading } from "@/components/atlas-ui";
import { cn } from "@/lib/utils";

type SortKey = "chrono-asc" | "chrono-desc" | "pub-desc" | "pub-asc" | "alpha";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "chrono-asc", label: "Earliest history first" },
  { key: "chrono-desc", label: "Latest history first" },
  { key: "pub-desc", label: "Newest episodes" },
  { key: "pub-asc", label: "Oldest episodes" },
  { key: "alpha", label: "A–Z" },
];

const PER_PAGE = 50;
const YEAR_FLOOR = -3000;
const YEAR_CEIL = 2026;

/** Wouter's hash navigate puts params on location.search; direct links may keep them in the hash. */
function initialFromHash(key: string): string | null {
  const fromSearch = new URLSearchParams(window.location.search).get(key);
  if (fromSearch) return fromSearch;
  const hash = window.location.hash;
  const qi = hash.indexOf("?");
  if (qi < 0) return null;
  return new URLSearchParams(hash.slice(qi + 1)).get(key);
}

function FacetGroup({
  title,
  options,
  selected,
  onToggle,
  max,
}: {
  title: string;
  options: { value: string; count: number }[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  max?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = max && !expanded ? options.slice(0, max) : options;
  return (
    <div className="border-t pt-4" style={{ borderColor: "hsl(var(--parchment-edge))" }}>
      <p className="smallcaps mb-2 text-sm text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-1">
        {shown.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2 py-0.5 text-sm hover:text-primary"
          >
            <input
              type="checkbox"
              checked={selected.has(o.value)}
              onChange={() => onToggle(o.value)}
              data-testid={`checkbox-${title.toLowerCase()}-${o.value}`}
              className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
            />
            <span className="flex-1">{o.value}</span>
            <span className="text-xs text-muted-foreground">{o.count}</span>
          </label>
        ))}
      </div>
      {max && options.length > max && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          data-testid={`button-expand-${title.toLowerCase()}`}
          className="mt-2 text-xs link-underline text-muted-foreground"
        >
          {expanded ? "Show fewer" : `Show all ${options.length}`}
        </button>
      )}
    </div>
  );
}

export default function Browse() {
  usePageMeta(
    "Browse all 713 episodes — The Rest Is History Atlas",
    "Filter every episode of The Rest Is History by era, region, theme, confidence and year range.",
  );
  const { data: atlas, isLoading } = useAtlas();

  const [eras, setEras] = useState<Set<string>>(() => {
    const e = initialFromHash("era");
    return new Set(e ? [e] : []);
  });
  const [regions, setRegions] = useState<Set<string>>(() => {
    const r = initialFromHash("region");
    return new Set(r ? [r] : []);
  });
  const [themes, setThemes] = useState<Set<string>>(() => {
    const t = initialFromHash("theme");
    return new Set(t ? [t] : []);
  });
  const [confidence, setConfidence] = useState<Set<string>>(new Set());
  const [range, setRange] = useState<[number, number]>([YEAR_FLOOR, YEAR_CEIL]);
  const [only1800, setOnly1800] = useState(() => initialFromHash("long1800") === "1");
  const [onlySeries, setOnlySeries] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("chrono-asc");
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const debouncedQuery = useDebounced(query, 200);

  const toggler =
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (value: string) =>
      setter((prev) => {
        const next = new Set(prev);
        next.has(value) ? next.delete(value) : next.add(value);
        return next;
      });

  const rangeActive = range[0] !== YEAR_FLOOR || range[1] !== YEAR_CEIL;

  const filtered = useMemo<Episode[]>(() => {
    if (!atlas) return [];
    const q = debouncedQuery.trim().toLowerCase();
    let out = atlas.episodes.filter((e) => {
      if (eras.size && !eras.has(e.era_bucket)) return false;
      if (regions.size && !regions.has(e.primary_region)) return false;
      if (themes.size && !e.themes.some((t) => themes.has(t))) return false;
      if (confidence.size && !confidence.has(e.confidence)) return false;
      if (only1800 && !e.is_strongly_1800_1934) return false;
      if (onlySeries && !e.series_key) return false;
      if (rangeActive) {
        if (e.primary_start_year === 0) return false;
        const start = Math.max(e.primary_start_year, YEAR_FLOOR);
        const end = Math.max(e.primary_end_year || e.primary_start_year, start);
        if (end < range[0] || start > range[1]) return false;
      }
      if (q && !(atlas.searchText.get(e.guid) ?? "").includes(q)) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "chrono-asc":
          return a.primary_start_year - b.primary_start_year || a.pubdate.localeCompare(b.pubdate);
        case "chrono-desc":
          return b.primary_start_year - a.primary_start_year || b.pubdate.localeCompare(a.pubdate);
        case "pub-desc":
          return b.pubdate.localeCompare(a.pubdate);
        case "pub-asc":
          return a.pubdate.localeCompare(b.pubdate);
        case "alpha":
          return a.display_title.localeCompare(b.display_title);
      }
    });
    return out;
  }, [atlas, eras, regions, themes, confidence, only1800, onlySeries, range, rangeActive, debouncedQuery, sort]);

  useEffect(() => {
    setPage(1);
  }, [eras, regions, themes, confidence, only1800, onlySeries, range, debouncedQuery, sort]);

  if (isLoading || !atlas) return <Loading label="Consulting the index" />;

  const eraOptions = ERA_ORDER.filter((e) => atlas.stats.eras[e]).map((e) => ({
    value: e,
    count: atlas.stats.eras[e],
  }));
  const regionOptions = Object.entries(atlas.stats.regions)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
  const themeOptions = Object.entries(atlas.stats.themes)
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }));
  const confOptions = ["high", "medium", "low"].map((c) => ({
    value: c,
    count: atlas.stats.confidence[c] ?? 0,
  }));

  const clearAll = () => {
    setEras(new Set());
    setRegions(new Set());
    setThemes(new Set());
    setConfidence(new Set());
    setOnly1800(false);
    setOnlySeries(false);
    setRange([YEAR_FLOOR, YEAR_CEIL]);
    setQuery("");
  };

  const activeChips: { label: string; onRemove: () => void; tone?: "brass" | "primary" }[] = [
    ...Array.from(eras).map((v) => ({ label: v, onRemove: () => toggler(setEras)(v) })),
    ...Array.from(regions).map((v) => ({ label: v, onRemove: () => toggler(setRegions)(v) })),
    ...Array.from(themes).map((v) => ({ label: v, onRemove: () => toggler(setThemes)(v) })),
    ...Array.from(confidence).map((v) => ({ label: `${v} confidence`, onRemove: () => toggler(setConfidence)(v) })),
    ...(only1800
      ? [{ label: "Only 1800–1934", onRemove: () => setOnly1800(false), tone: "brass" as const }]
      : []),
    ...(onlySeries ? [{ label: "Multi-part series", onRemove: () => setOnlySeries(false) }] : []),
    ...(rangeActive
      ? [
          {
            label: `${formatYear(range[0])} – ${formatYear(range[1])}`,
            onRemove: () => setRange([YEAR_FLOOR, YEAR_CEIL]),
          },
        ]
      : []),
    ...(debouncedQuery.trim() ? [{ label: `“${debouncedQuery.trim()}”`, onRemove: () => setQuery("") }] : []),
  ];

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageItems = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const facets = (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, blurbs, people"
          data-testid="input-search"
          className="w-full rounded-md border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          style={{ borderColor: "hsl(var(--parchment-edge))" }}
        />
      </div>

      <button
        type="button"
        onClick={() => setOnly1800((v) => !v)}
        data-testid="button-only-1800"
        className={cn(
          "flex items-center justify-between rounded-full border px-4 py-2 text-sm transition-colors",
          only1800
            ? "bg-primary text-primary-foreground"
            : "hover-elevate text-foreground",
        )}
        style={only1800 ? undefined : { borderColor: "hsl(var(--brass) / 0.6)", color: "hsl(var(--brass))" }}
      >
        <span className="smallcaps text-base">Only 1800–1934</span>
        <span className="text-xs opacity-80">{atlas.stats.num_1800_1934}</span>
      </button>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlySeries}
          onChange={() => setOnlySeries((v) => !v)}
          data-testid="checkbox-only-series"
          className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
        />
        Only multi-part series
      </label>

      <div className="border-t pt-4" style={{ borderColor: "hsl(var(--parchment-edge))" }}>
        <p className="smallcaps mb-2 text-sm text-muted-foreground">Year range</p>
        <p className="display mb-2 text-sm">
          {formatYear(range[0])} — {formatYear(range[1])}
        </p>
        <input
          type="range"
          min={YEAR_FLOOR}
          max={YEAR_CEIL}
          step={10}
          value={range[0]}
          onChange={(e) => setRange(([, hi]) => [Math.min(Number(e.target.value), hi - 10), hi])}
          data-testid="input-year-from"
          className="w-full accent-[hsl(var(--primary))]"
        />
        <input
          type="range"
          min={YEAR_FLOOR}
          max={YEAR_CEIL}
          step={10}
          value={range[1]}
          onChange={(e) => setRange(([lo]) => [lo, Math.max(Number(e.target.value), lo + 10)])}
          data-testid="input-year-to"
          className="w-full accent-[hsl(var(--primary))]"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Negative years are BCE. Undated episodes drop out when a range is set.
        </p>
      </div>

      <FacetGroup title="Eras" options={eraOptions} selected={eras} onToggle={toggler(setEras)} />
      <FacetGroup
        title="Regions"
        options={regionOptions}
        selected={regions}
        onToggle={toggler(setRegions)}
        max={8}
      />
      <FacetGroup
        title="Themes"
        options={themeOptions}
        selected={themes}
        onToggle={toggler(setThemes)}
        max={8}
      />
      <FacetGroup
        title="Confidence"
        options={confOptions}
        selected={confidence}
        onToggle={toggler(setConfidence)}
      />
    </div>
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="display text-lg font-semibold">Filters</h2>
              <button
                type="button"
                onClick={clearAll}
                data-testid="button-clear-filters"
                className="text-xs link-underline text-muted-foreground"
              >
                Clear
              </button>
            </div>
            {facets}
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="smallcaps text-sm text-muted-foreground">
                {filtered.length} of {atlas.stats.total_episodes} episodes
              </p>
              <h1 className="display text-2xl font-semibold tracking-tight">Browse the archive</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                data-testid="button-open-filters"
                className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover-elevate lg:hidden"
                style={{ borderColor: "hsl(var(--parchment-edge))" }}
              >
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </button>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                data-testid="select-sort"
                className="rounded-md border bg-card px-3 py-2 text-sm outline-none"
                style={{ borderColor: "hsl(var(--parchment-edge))" }}
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeChips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" data-testid="list-active-filters">
              {activeChips.map((c) => (
                <Chip
                  key={c.label}
                  onRemove={c.onRemove}
                  tone={c.tone ?? "default"}
                  testId={`chip-filter-${c.label}`}
                >
                  {c.label}
                </Chip>
              ))}
              <button
                type="button"
                onClick={clearAll}
                data-testid="button-clear-all-chips"
                className="text-xs link-underline text-muted-foreground"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="mt-6">
            {pageItems.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pageItems.map((ep) => (
                  <EpisodeCard key={ep.guid} ep={ep} />
                ))}
              </div>
            )}
          </div>

          {pageCount > 1 && (
            <div className="mt-8 flex items-center justify-between rule pt-4">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  window.scrollTo({ top: 0 });
                }}
                data-testid="button-prev-page"
                className="rounded-md border px-3 py-1.5 text-sm hover-elevate disabled:opacity-40"
                style={{ borderColor: "hsl(var(--parchment-edge))" }}
              >
                Previous
              </button>
              <p className="smallcaps text-sm text-muted-foreground" data-testid="text-page-indicator">
                Page {page} of {pageCount}
              </p>
              <button
                type="button"
                disabled={page === pageCount}
                onClick={() => {
                  setPage((p) => Math.min(pageCount, p + 1));
                  window.scrollTo({ top: 0 });
                }}
                data-testid="button-next-page"
                className="rounded-md border px-3 py-1.5 text-sm hover-elevate disabled:opacity-40"
                style={{ borderColor: "hsl(var(--parchment-edge))" }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" data-testid="sheet-filters">
          <div
            className="absolute inset-0 bg-black/45"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-xl border-t bg-background p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="display text-lg font-semibold">Filters</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={clearAll}
                  data-testid="button-clear-filters-mobile"
                  className="text-xs link-underline text-muted-foreground"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  data-testid="button-close-filters"
                  aria-label="Close filters"
                  className="rounded-md border p-1.5"
                  style={{ borderColor: "hsl(var(--parchment-edge))" }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {facets}
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              data-testid="button-apply-filters"
              className="mt-5 w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
            >
              Show {filtered.length} episodes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
