import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import {
  formatDate,
  formatDuration,
  relatedEpisodes,
  useAtlas,
  usePageMeta,
  snippet,
} from "@/lib/atlas";
import { EmptyState, EpisodeCard, EraPill, Loading, SectionHeading } from "@/components/atlas-ui";

export default function EpisodeDetail() {
  const params = useParams<{ guid: string }>();
  const guid = decodeURIComponent(params.guid ?? "");
  const { data: atlas, isLoading } = useAtlas();
  const ep = atlas?.byGuid.get(guid);
  usePageMeta(
    ep ? `${ep.display_title} — The Rest Is History Atlas` : "Episode — The Rest Is History Atlas",
    ep ? snippet(ep.description, 155) : undefined,
  );

  if (isLoading || !atlas) return <Loading label="Fetching the episode" />;
  if (!ep)
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="This episode has fallen through the cracks of history."
          body="Try the browser — 713 others are still where we left them."
        />
      </div>
    );

  const series = ep.series_key ? atlas.bySeries.get(ep.series_key) ?? [] : [];
  const seriesIdx = series.findIndex((e) => e.guid === ep.guid);
  const prevPart = seriesIdx > 0 ? series[seriesIdx - 1] : null;
  const nextPart = seriesIdx >= 0 && seriesIdx < series.length - 1 ? series[seriesIdx + 1] : null;
  const related = relatedEpisodes(atlas, ep, 6);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
      <Link
        href="/browse"
        data-testid="link-back-browse"
        className="smallcaps inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to browse
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="min-w-0">
          <p className="display text-3xl font-semibold tracking-tight" data-testid="text-episode-year">
            {ep.year_label}
          </p>
          <h1 className="display mt-2 text-2xl font-semibold leading-tight" data-testid="text-episode-title">
            {ep.display_title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <EraPill era={ep.era_bucket} />
            <span className="smallcaps text-sm text-muted-foreground">{ep.primary_region}</span>
            <span className="smallcaps text-sm text-muted-foreground">
              {formatDate(ep.pubdate)} · {formatDuration(ep.duration)}
            </span>
            {ep.episode_number != null && (
              <span className="smallcaps text-sm text-muted-foreground">Episode {ep.episode_number}</span>
            )}
          </div>

          {ep.series_key && (
            <p className="mt-4 text-sm">
              <span className="smallcaps text-muted-foreground">Series</span>{" "}
              <Link
                href={`/series/${encodeURIComponent(ep.series_key)}`}
                data-testid="link-series"
                className="link-underline"
              >
                {ep.series_name || ep.series_key}
              </Link>
              {ep.part_number != null && (
                <span className="text-muted-foreground">
                  {" "}
                  — part {ep.part_number} of {series.length}
                </span>
              )}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {ep.themes.map((t) => (
              <Link
                key={t}
                href={`/browse?theme=${encodeURIComponent(t)}`}
                data-testid={`link-theme-${t}`}
                className="rounded-full border px-2.5 py-0.5 text-xs text-foreground/75 hover-elevate"
                style={{ borderColor: "hsl(var(--parchment-edge))" }}
              >
                {t}
              </Link>
            ))}
          </div>

          <p className="mt-7 whitespace-pre-line text-base leading-relaxed" data-testid="text-episode-description">
            {ep.description.replace(/Learn more about your ad choices.*$/i, "").trim()}
          </p>

          <blockquote
            className="mt-8 border-l-2 pl-4 text-sm italic leading-relaxed text-muted-foreground"
            style={{ borderColor: "hsl(var(--brass))" }}
            data-testid="text-episode-reasoning"
          >
            <span className="smallcaps not-italic">Why it is filed here</span>
            <br />
            {ep.reasoning}{" "}
            <span className="not-italic">({ep.confidence} confidence)</span>
          </blockquote>

          {(prevPart || nextPart) && (
            <div className="mt-8 flex items-center justify-between rule pt-5">
              {prevPart ? (
                <Link
                  href={`/episode/${encodeURIComponent(prevPart.guid)}`}
                  data-testid="link-prev-part"
                  className="group max-w-[45%]"
                >
                  <p className="smallcaps text-xs text-muted-foreground">Previous part</p>
                  <p className="display text-sm group-hover:text-primary">{prevPart.display_title}</p>
                </Link>
              ) : (
                <span />
              )}
              {nextPart ? (
                <Link
                  href={`/episode/${encodeURIComponent(nextPart.guid)}`}
                  data-testid="link-next-part"
                  className="group max-w-[45%] text-right"
                >
                  <p className="smallcaps text-xs text-muted-foreground">Next part</p>
                  <p className="display text-sm group-hover:text-primary">{nextPart.display_title}</p>
                </Link>
              ) : (
                <span />
              )}
            </div>
          )}
        </article>

        {/* Aside */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <div className="paper-card p-5">
            <p className="smallcaps text-sm text-muted-foreground">Listen</p>
            <div className="mt-3 flex flex-col gap-2">
              <a
                href={ep.spotify_search_url}
                target="_blank"
                rel="noreferrer"
                data-testid="link-spotify"
                className="inline-flex items-center justify-between rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover-elevate"
              >
                Listen on Spotify <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={ep.apple_url}
                target="_blank"
                rel="noreferrer"
                data-testid="link-apple"
                className="inline-flex items-center justify-between rounded-md border px-3 py-2 text-sm hover-elevate"
                style={{ borderColor: "hsl(var(--parchment-edge))" }}
              >
                Listen on Apple <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="smallcaps mt-4 text-xs text-muted-foreground">Or straight from the feed</p>
            <audio
              controls
              preload="none"
              src={ep.audio_url}
              data-testid="audio-episode"
              className="mt-2 w-full"
            />
          </div>

          {ep.key_figures.length > 0 && (
            <div className="paper-card p-5">
              <p className="smallcaps text-sm text-muted-foreground">Key figures</p>
              <ul className="mt-2 flex flex-col gap-1">
                {ep.key_figures.map((f) => (
                  <li key={f} className="display text-base" data-testid={`text-figure-${f}`}>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="paper-card p-5">
            <p className="smallcaps text-sm text-muted-foreground">Filed under</p>
            <dl className="mt-2 flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Era</dt>
                <dd>
                  <Link href={`/browse?era=${encodeURIComponent(ep.era_bucket)}`} className="link-underline"
                    data-testid="link-filed-era">
                    {ep.era_bucket}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Region</dt>
                <dd>
                  <Link href={`/browse?region=${encodeURIComponent(ep.primary_region)}`} className="link-underline"
                    data-testid="link-filed-region">
                    {ep.primary_region}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Years</dt>
                <dd className="display">{ep.year_label}</dd>
              </div>
              {ep.is_strongly_1800_1934 && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Also in</dt>
                  <dd>
                    <Link href="/playlists/the-long-1800-1934" className="link-underline" data-testid="link-filed-long1800">
                      The Long 1800–1934
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <SectionHeading
            kicker="Same era, similar neighbourhood"
            title="See related"
            action={
              <Link
                href={`/browse?era=${encodeURIComponent(ep.era_bucket)}`}
                data-testid="link-related-more"
                className="hidden items-center gap-1.5 text-sm hover:text-primary sm:inline-flex"
              >
                More from {ep.era_bucket} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <EpisodeCard key={r.guid} ep={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
