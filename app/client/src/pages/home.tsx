import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import {
  ERA_ORDER,
  FEATURED_PLAYLIST_IDS,
  useAtlas,
  usePageMeta,
  formatDuration,
  snippet,
} from "@/lib/atlas";
import { EpisodeCard, EraPill, Loading, SectionHeading } from "@/components/atlas-ui";
import { EraTimeline } from "@/components/era-timeline";
import { LiveShowsStrip } from "@/components/live-shows-strip";
import { YouTubeStrip } from "@/components/youtube-strip";
import { ClubCTA } from "@/components/club-cta";

export default function Home() {
  usePageMeta(
    "The Rest Is History Atlas — all 713 episodes, mapped",
    "Browse every episode of The Rest Is History by era, region and theme, with a chronological timeline from prehistory to now and 52 curated playlists.",
  );
  const { data: atlas, isLoading } = useAtlas();
  if (isLoading || !atlas) return <Loading />;

  const featured = FEATURED_PLAYLIST_IDS.map((id) => atlas.byPlaylistId.get(id)!).filter(Boolean);
  const [firstDate, lastDate] = atlas.stats.date_range;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-4 pt-10 sm:px-6 sm:pt-14">
      {/* Hero */}
      <section className="max-w-3xl">
        <p className="smallcaps text-base" style={{ color: "hsl(var(--brass))" }}>
          A reading room for a very long podcast
        </p>
        <h1 className="display mt-3 text-3xl font-semibold leading-[1.08] tracking-tight sm:text-[2.75rem]">
          An atlas of all {atlas.stats.total_episodes} episodes of The Rest Is History
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Every episode placed in time, sorted by era, region and theme, and bundled into
          {" "}{atlas.stats.num_playlists} playlists. Tom and Dominic wander freely across four thousand
          years; this is the map they never drew.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/browse"
            data-testid="link-hero-browse"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover-elevate"
          >
            Browse the episodes <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/playlists/the-long-1800-1934"
            data-testid="link-hero-long1800"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover-elevate"
            style={{ borderColor: "hsl(var(--brass) / 0.6)", color: "hsl(var(--brass))" }}
          >
            The Long 1800–1934
          </Link>
        </div>
      </section>

      {/* Live shows — refreshed daily from therestishistory.com/events */}
      <LiveShowsStrip />

      {/* Timeline hero */}
      <section className="mt-12">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="smallcaps text-sm text-muted-foreground">
              Every dated episode, 3000 BCE to now — deep past compressed, modernity expanded
            </p>
            <h2 className="display text-xl font-semibold tracking-tight">The whole show at a glance</h2>
          </div>
          <Link
            href="/timeline"
            data-testid="link-full-timeline"
            className="hidden shrink-0 items-center gap-1.5 text-sm hover:text-primary sm:inline-flex"
          >
            Full timeline <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="paper-card px-3 py-4 sm:px-5">
          <EraTimeline episodes={atlas.episodes} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 rule pt-3">
            {ERA_ORDER.filter((e) => e !== "Undated" && atlas.stats.eras[e]).map((era) => (
              <EraPill key={era} era={era} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Hover a mark for the episode; click to open it. Anything before 3000 BCE — dinosaurs,
            hominids, the odd asteroid — sits at the far left.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-10 grid grid-cols-2 gap-y-6 rule pt-6 sm:grid-cols-4">
        {[
          { label: "Episodes", value: atlas.stats.total_episodes },
          { label: "Feed spans", value: `${firstDate.slice(0, 4)}–${lastDate.slice(0, 4)}` },
          { label: "Multi-part series", value: atlas.stats.num_series },
          { label: "Playlists", value: atlas.stats.num_playlists },
        ].map((s) => (
          <div key={s.label} data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, "-")}`}>
            <p className="display text-xl font-semibold">{s.value}</p>
            <p className="smallcaps text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Featured playlists */}
      <section className="mt-16">
        <SectionHeading
          kicker="Six ways in"
          title="Featured playlists"
          action={
            <Link
              href="/playlists"
              data-testid="link-all-playlists"
              className="hidden items-center gap-1.5 text-sm hover:text-primary sm:inline-flex"
            >
              All {atlas.stats.num_playlists} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <Link
              key={p.id}
              href={`/playlists/${p.id}`}
              data-testid={`card-playlist-${p.id}`}
              className="paper-card group flex flex-col gap-2 p-5 transition-transform duration-200 hover:-translate-y-0.5 hover-elevate"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="display text-lg font-semibold group-hover:text-primary">{p.name}</h3>
                <span className="smallcaps shrink-0 text-sm" style={{ color: "hsl(var(--brass))" }}>
                  {p.count} eps
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{p.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest */}
      <section className="mt-16">
        <SectionHeading kicker="Freshly published" title="Latest episodes" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {atlas.latest.map((ep) => (
            <EpisodeCard key={ep.guid} ep={ep} />
          ))}
        </div>
      </section>

      {/* YouTube — refreshed daily from @restishistorypod RSS */}
      <YouTubeStrip />

      {/* Rest Is History Club CTA */}
      <ClubCTA />

      {/* Eras index */}
      <section className="mt-16">
        <SectionHeading kicker="By period" title="Where the episodes cluster" />
        <div className="paper-card divide-y" style={{ borderColor: "hsl(var(--card-border))" }}>
          {Object.entries(atlas.stats.eras)
            .sort((a, b) => b[1] - a[1])
            .map(([era, count]) => (
              <Link
                key={era}
                href={`/browse?era=${encodeURIComponent(era)}`}
                data-testid={`link-era-${era}`}
                className="flex items-center gap-4 px-5 py-3 hover-elevate"
              >
                <EraPill era={era} className="w-52 shrink-0" />
                <div className="h-1.5 flex-1 rounded-full bg-foreground/5">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${(count / atlas.stats.total_episodes) * 260}%`,
                      maxWidth: "100%",
                      backgroundColor: `hsl(var(--brass))`,
                      opacity: 0.75,
                    }}
                  />
                </div>
                <span className="display w-10 shrink-0 text-right text-sm">{count}</span>
              </Link>
            ))}
        </div>
      </section>

      {/* A quiet note */}
      <section className="mt-16 max-w-3xl">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Longest episode in the feed:{" "}
          <span className="text-foreground">
            {formatDuration(
              atlas.episodes.reduce((a, b) => (Number(b.duration) > Number(a.duration) ? b : a)).duration,
            )}
          </span>
          . Shortest sensible description in the feed reads:{" "}
          <em className="text-foreground">
            {snippet(
              atlas.episodes
                .filter((e) => e.description.length > 60)
                .reduce((a, b) => (b.description.length < a.description.length ? b : a)).description,
              120,
            )}
          </em>
        </p>
      </section>
    </div>
  );
}
