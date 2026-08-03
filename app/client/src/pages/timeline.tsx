import { useMemo, useState } from "react";
import { Link } from "wouter";
import { X, ExternalLink } from "lucide-react";
import {
  ERA_ORDER,
  eraColor,
  formatDate,
  formatDuration,
  snippet,
  useAtlas,
  usePageMeta,
  type Episode,
} from "@/lib/atlas";
import { EraPill, Loading } from "@/components/atlas-ui";
import { cn } from "@/lib/utils";

export default function TimelinePage() {
  usePageMeta(
    "Timeline — The Rest Is History Atlas",
    "A chronological walk through every episode of The Rest Is History, from the deep past to the day before yesterday.",
  );
  const { data: atlas, isLoading } = useAtlas();
  const [selected, setSelected] = useState<Episode | null>(null);
  const [hiddenEras, setHiddenEras] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    if (!atlas) return [];
    return ERA_ORDER.filter((era) => atlas.stats.eras[era])
      .map((era) => ({
        era,
        episodes: atlas.chronological.filter((e) => e.era_bucket === era),
      }))
      .filter((g) => g.episodes.length > 0);
  }, [atlas]);

  if (isLoading || !atlas) return <Loading label="Winding the clock back" />;

  const toggleEra = (era: string) =>
    setHiddenEras((prev) => {
      const next = new Set(prev);
      next.has(era) ? next.delete(era) : next.add(era);
      return next;
    });

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
      <div className="max-w-3xl">
        <p className="smallcaps text-sm text-muted-foreground">Chronological, not chronological order of release</p>
        <h1 className="display text-2xl font-semibold tracking-tight">The timeline</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Every episode set in the order the events actually happened. Click a dot to read the details;
          use the era switches to thin the crowd.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {ERA_ORDER.filter((e) => atlas.stats.eras[e]).map((era) => {
          const off = hiddenEras.has(era);
          return (
            <button
              key={era}
              type="button"
              onClick={() => toggleEra(era)}
              data-testid={`button-toggle-era-${era}`}
              className={cn(
                "smallcaps rounded-full border px-3 py-1 text-sm transition-opacity",
                off ? "opacity-40" : "opacity-100",
              )}
              style={{ borderColor: eraColor(era), color: eraColor(era) }}
            >
              {era} · {atlas.stats.eras[era]}
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex gap-8">
        <div className="min-w-0 flex-1">
          {grouped
            .filter((g) => !hiddenEras.has(g.era))
            .map((group) => (
              <section key={group.era} className="relative pb-14">
                <div className="sticky top-16 z-10 -mx-1 mb-4 bg-background/90 px-1 py-2 backdrop-blur">
                  <div className="flex items-baseline gap-3">
                    <EraPill era={group.era} />
                    <span className="text-xs text-muted-foreground">{group.episodes.length} episodes</span>
                  </div>
                </div>
                <ol className="relative ml-3 border-l pl-6" style={{ borderColor: eraColor(group.era) }}>
                  {group.episodes.map((ep) => (
                    <li key={ep.guid} className="relative pb-5">
                      <span
                        className="absolute -left-[1.9rem] top-2 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: eraColor(group.era) }}
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() => setSelected(ep)}
                        data-testid={`button-timeline-episode-${ep.guid}`}
                        className="group text-left"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <span className="display text-base font-semibold" style={{ minWidth: "8rem" }}>
                            {ep.year_label}
                          </span>
                          <span className="display text-base group-hover:text-primary">
                            {ep.display_title}
                          </span>
                        </div>
                        <p className="smallcaps mt-0.5 text-xs text-muted-foreground">
                          {ep.primary_region} · published {ep.pubdate_short}
                        </p>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
        </div>
      </div>

      {/* Side drawer */}
      {selected && (
        <div className="fixed inset-0 z-50" data-testid="drawer-episode">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelected(null)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto border-l bg-background p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <EraPill era={selected.era_bucket} />
                <p className="display mt-1 text-2xl font-semibold">{selected.year_label}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                data-testid="button-close-drawer"
                className="rounded-md border p-1.5 hover-elevate"
                style={{ borderColor: "hsl(var(--parchment-edge))" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h2 className="display mt-4 text-lg font-semibold leading-snug">{selected.display_title}</h2>
            <p className="smallcaps mt-1 text-sm text-muted-foreground">
              {selected.primary_region} · {formatDate(selected.pubdate)} · {formatDuration(selected.duration)}
            </p>
            <p className="mt-4 text-sm leading-relaxed text-foreground/85">
              {snippet(selected.description, 420)}
            </p>
            {selected.key_figures.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                <span className="smallcaps">Figures</span>: {selected.key_figures.join(", ")}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/episode/${encodeURIComponent(selected.guid)}`}
                data-testid="link-drawer-episode-detail"
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover-elevate"
              >
                Full entry
              </Link>
              <a
                href={selected.spotify_search_url}
                target="_blank"
                rel="noreferrer"
                data-testid="link-drawer-spotify"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover-elevate"
                style={{ borderColor: "hsl(var(--parchment-edge))" }}
              >
                Spotify <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
