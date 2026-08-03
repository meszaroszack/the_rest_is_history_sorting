import { Link, useParams } from "wouter";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import {
  groupPlaylists,
  useAtlas,
  usePageMeta,
  formatDuration,
  type Episode,
} from "@/lib/atlas";
import { EmptyState, EraPill, Loading } from "@/components/atlas-ui";

export function PlaylistsIndex() {
  usePageMeta(
    "Playlists — The Rest Is History Atlas",
    "52 curated playlists across eras, regions and themes for The Rest Is History.",
  );
  const { data: atlas, isLoading } = useAtlas();
  if (isLoading || !atlas) return <Loading label="Shuffling the shelves" />;

  const groups = groupPlaylists(atlas.playlists);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">
      <div className="max-w-3xl">
        <p className="smallcaps text-sm text-muted-foreground">{atlas.stats.num_playlists} ways to spend a winter</p>
        <h1 className="display text-2xl font-semibold tracking-tight">Playlists</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Each playlist is ordered chronologically by the history, not by publication date — so you can
          follow events forward rather than jumping about as Tom and Dominic did.
        </p>
      </div>

      {groups.map((g) => (
        <section key={g.key} className="mt-12">
          <div className="mb-5 rule pt-5">
            <h2 className="display text-xl font-semibold tracking-tight">{g.title}</h2>
            <p className="text-sm text-muted-foreground">{g.blurb}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((p) => {
              const sample = p.episode_guids
                .slice(0, 3)
                .map((id) => atlas.byGuid.get(id))
                .filter(Boolean) as Episode[];
              return (
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
                  <ul className="mt-2 flex flex-col gap-1 border-t pt-2 text-xs text-muted-foreground"
                      style={{ borderColor: "hsl(var(--parchment-edge))" }}>
                    {sample.map((ep) => (
                      <li key={ep.guid} className="truncate">
                        <span className="display">{ep.year_label}</span> · {ep.display_title}
                      </li>
                    ))}
                  </ul>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function PlaylistDetail() {
  const params = useParams<{ id: string }>();
  const { data: atlas, isLoading } = useAtlas();
  const playlist = atlas?.byPlaylistId.get(params.id ?? "");
  usePageMeta(
    playlist
      ? `${playlist.name} — The Rest Is History Atlas`
      : "Playlist — The Rest Is History Atlas",
    playlist?.description,
  );

  if (isLoading || !atlas) return <Loading label="Pulling the playlist" />;
  if (!playlist)
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="No such playlist."
          body="It may have been quietly deleted, like a Soviet cosmonaut."
        />
      </div>
    );

  const episodes = playlist.episode_guids
    .map((g) => atlas.byGuid.get(g))
    .filter(Boolean) as Episode[];
  const idx = atlas.playlists.findIndex((p) => p.id === playlist.id);
  const prev = atlas.playlists[(idx - 1 + atlas.playlists.length) % atlas.playlists.length];
  const next = atlas.playlists[(idx + 1) % atlas.playlists.length];
  const totalSeconds = episodes.reduce((a, e) => a + Number(e.duration || 0), 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/playlists"
        data-testid="link-back-playlists"
        className="smallcaps inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All playlists
      </Link>
      <h1 className="display mt-4 text-2xl font-semibold tracking-tight" data-testid="text-playlist-name">
        {playlist.name}
      </h1>
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
        {playlist.description}
      </p>
      <p className="smallcaps mt-3 text-sm text-muted-foreground">
        {playlist.count} episodes · roughly {Math.round(totalSeconds / 3600)} hours of listening
      </p>
      <a
        href={playlist.spotify_search_url}
        target="_blank"
        rel="noreferrer"
        data-testid="link-playlist-spotify"
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover-elevate"
      >
        Open in Spotify <ExternalLink className="h-3.5 w-3.5" />
      </a>

      <ol className="mt-8 paper-card divide-y" style={{ borderColor: "hsl(var(--card-border))" }}>
        {episodes.map((ep, i) => (
          <li key={ep.guid}>
            <Link
              href={`/episode/${encodeURIComponent(ep.guid)}`}
              data-testid={`link-playlist-episode-${ep.guid}`}
              className="flex items-baseline gap-4 px-5 py-3.5 hover-elevate"
            >
              <span className="display w-8 shrink-0 text-sm text-muted-foreground">{i + 1}</span>
              <span className="display w-32 shrink-0 text-sm">{ep.year_label}</span>
              <span className="min-w-0 flex-1">
                <span className="display block text-base leading-snug">{ep.display_title}</span>
                <span className="smallcaps text-xs text-muted-foreground">
                  {ep.primary_region} · {ep.era_bucket} · {formatDuration(ep.duration)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex items-center justify-between rule pt-5">
        <Link
          href={`/playlists/${prev.id}`}
          data-testid="link-prev-playlist"
          className="group max-w-[45%] text-left"
        >
          <p className="smallcaps text-xs text-muted-foreground">Previous</p>
          <p className="display text-sm group-hover:text-primary">{prev.name}</p>
        </Link>
        <Link
          href={`/playlists/${next.id}`}
          data-testid="link-next-playlist"
          className="group max-w-[45%] text-right"
        >
          <p className="smallcaps text-xs text-muted-foreground">Next</p>
          <p className="display text-sm group-hover:text-primary">{next.name}</p>
        </Link>
      </div>
    </div>
  );
}

export function SeriesDetail() {
  const params = useParams<{ key: string }>();
  const { data: atlas, isLoading } = useAtlas();
  const key = decodeURIComponent(params.key ?? "");
  const episodes = atlas?.bySeries.get(key) ?? [];
  usePageMeta(
    episodes.length ? `${episodes[0].series_name || key} — series` : "Series — The Rest Is History Atlas",
    episodes.length ? `All ${episodes.length} parts of ${episodes[0].series_name || key}.` : undefined,
  );

  if (isLoading || !atlas) return <Loading label="Reassembling the series" />;
  if (!episodes.length)
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <EmptyState
          title="No such series."
          body="Perhaps it was only ever a two-parter in someone's imagination."
        />
      </div>
    );

  const years = episodes.map((e) => e.primary_start_year).filter((y) => y !== 0);
  const span = years.length
    ? `${episodes.find((e) => e.primary_start_year === Math.min(...years))!.year_label}`
    : "Undated";
  const regions = Array.from(new Set(episodes.map((e) => e.primary_region)));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="smallcaps text-sm text-muted-foreground">A multi-part series</p>
      <h1 className="display mt-1 text-2xl font-semibold tracking-tight" data-testid="text-series-name">
        {episodes[0].series_name || key}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <EraPill era={episodes[0].era_bucket} />
        <span className="smallcaps text-sm text-muted-foreground">{regions.join(" · ")}</span>
        <span className="display text-sm">{span}</span>
        <span className="smallcaps text-sm text-muted-foreground">
          {episodes.length} parts ·{" "}
          {formatDuration(episodes.reduce((a, e) => a + Number(e.duration || 0), 0))}
        </span>
      </div>

      <ol className="mt-8 flex flex-col gap-4">
        {episodes.map((ep) => (
          <li key={ep.guid}>
            <Link
              href={`/episode/${encodeURIComponent(ep.guid)}`}
              data-testid={`link-series-episode-${ep.guid}`}
              className="paper-card group flex flex-col gap-1.5 p-5 hover-elevate"
            >
              <p className="smallcaps text-xs" style={{ color: "hsl(var(--brass))" }}>
                Part {ep.part_number}
              </p>
              <h2 className="display text-base font-medium group-hover:text-primary">{ep.display_title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {ep.description.slice(0, 200)}…
              </p>
            </Link>
          </li>
        ))}
      </ol>

      <Link
        href="/browse"
        data-testid="link-series-browse"
        className="mt-8 inline-flex items-center gap-1.5 text-sm hover:text-primary"
      >
        Back to browsing <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
