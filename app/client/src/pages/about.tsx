import { Link } from "wouter";
import { useAtlas, usePageMeta } from "@/lib/atlas";
import { AtlasMark, Loading } from "@/components/atlas-ui";

export default function About() {
  usePageMeta(
    "About — The Rest Is History Atlas",
    "How this atlas of The Rest Is History was assembled: RSS feed, AI tagging, eras, regions, themes and 52 playlists.",
  );
  const { data: atlas, isLoading } = useAtlas();
  if (isLoading || !atlas) return <Loading label="Clearing the throat" />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <AtlasMark size={44} className="text-primary" />
      <h1 className="display mt-5 text-2xl font-semibold tracking-tight">About the Atlas</h1>
      <div className="mt-6 flex flex-col gap-5 text-base leading-relaxed">
        <p>
          The Rest Is History has produced {atlas.stats.total_episodes} episodes since{" "}
          {atlas.stats.date_range[0]}, arranged in the order Tom Holland and Dominic Sandbrook felt like
          talking about things. That is excellent radio and terrible filing. This atlas reorders the
          archive by the history itself.
        </p>
        <p>
          Every episode was read once, then placed: a start year (negative for BCE), an era bucket, a
          primary region, up to a handful of themes, and any key figures worth naming. Multi-part series
          were stitched back together — {atlas.stats.num_series} of them — and{" "}
          {atlas.stats.num_playlists} playlists were assembled on top, ordered chronologically by
          subject rather than by release.
        </p>
        <p>
          The tagging was done by a language model, which means it is confident, fast and occasionally
          wrong. Each episode page shows the model's own one-line justification and a confidence rating
          so you can judge for yourself: {atlas.stats.confidence.high} high, {atlas.stats.confidence.medium}{" "}
          medium, {atlas.stats.confidence.low} low.
        </p>
        <p>
          Dates are messy by design. An episode about the Norman Conquest gets 1066; an episode about
          "the history of the novel" gets a span; an episode about the 2010s Labour Party gets a year
          nobody will argue about. Fifty-seven episodes — trailers, live shows, listener questions and
          the general chit-chat — are marked Undated, because pretending otherwise would be worse.
        </p>
        <h2 className="display mt-4 text-xl font-semibold">How to use it</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <Link href="/browse" className="link-underline" data-testid="link-about-browse">
              Browse
            </Link>{" "}
            is the workhorse: facets for era, region, theme and confidence, a BCE-aware year slider, and
            a full-text search across titles, blurbs and named figures.
          </li>
          <li>
            <Link href="/timeline" className="link-underline" data-testid="link-about-timeline">
              Timeline
            </Link>{" "}
            walks the whole archive in chronological order, grouped by era.
          </li>
          <li>
            <Link href="/playlists" className="link-underline" data-testid="link-about-playlists">
              Playlists
            </Link>{" "}
            includes The Long 1800–1934 — {atlas.stats.num_1800_1934} episodes covering the stretch from
            Napoleon to the eve of the Third Reich, which is a defensible way to spend a year.
          </li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Data collected from the public RSS feed on 2026-08-03. Nothing here is affiliated with
          Goalhanger. Audio links point at Spotify, Apple Podcasts, and the feed's own MP3s; the
          episodes remain entirely theirs.
        </p>
      </div>
    </div>
  );
}
