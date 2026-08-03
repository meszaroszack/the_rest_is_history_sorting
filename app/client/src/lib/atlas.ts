import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

export interface Episode {
  guid: string;
  episode_number: number | null;
  title: string;
  display_title: string;
  description: string;
  pubdate: string;
  pubdate_short: string;
  duration: string;
  audio_url: string;
  link: string;
  slug: string;
  primary_start_year: number;
  primary_end_year: number;
  year_label: string;
  primary_region: string;
  era_bucket: string;
  themes: string[];
  key_figures: string[];
  is_series: boolean;
  series_key: string;
  series_name?: string;
  part_number: number | null;
  is_strongly_1800_1934: boolean;
  confidence: string;
  reasoning: string;
  spotify_search_url: string;
  apple_url: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  count: number;
  episode_guids: string[];
  spotify_search_url: string;
}

export interface Stats {
  total_episodes: number;
  date_range: [string, string];
  eras: Record<string, number>;
  regions: Record<string, number>;
  themes: Record<string, number>;
  confidence: Record<string, number>;
  num_series: number;
  num_playlists: number;
  num_1800_1934: number;
  generated_at: string;
}

export const ERA_ORDER = [
  "Prehistory",
  "Ancient",
  "Medieval",
  "Early Modern",
  "Long 19th Century",
  "World Wars & Interwar",
  "Postwar",
  "Contemporary",
  "Undated",
];

export const ERA_VAR: Record<string, string> = {
  Prehistory: "--era-prehistory",
  Ancient: "--era-ancient",
  Medieval: "--era-medieval",
  "Early Modern": "--era-early-modern",
  "Long 19th Century": "--era-long19",
  "World Wars & Interwar": "--era-wars",
  Postwar: "--era-postwar",
  Contemporary: "--era-contemporary",
  Undated: "--era-undated",
};

export function eraColor(era: string): string {
  return `hsl(var(${ERA_VAR[era] ?? "--era-undated"}))`;
}

export const ERA_SPANS: { era: string; from: number; to: number }[] = [
  { era: "Prehistory", from: -3000, to: -1200 },
  { era: "Ancient", from: -1200, to: 500 },
  { era: "Medieval", from: 500, to: 1500 },
  { era: "Early Modern", from: 1500, to: 1789 },
  { era: "Long 19th Century", from: 1789, to: 1914 },
  { era: "World Wars & Interwar", from: 1914, to: 1945 },
  { era: "Postwar", from: 1945, to: 1991 },
  { era: "Contemporary", from: 1991, to: 2026 },
];

/* ------------------------------------------------------------------ *
 * Piecewise scale: the deep past is compressed, the modern age breathes.
 * ------------------------------------------------------------------ */
const BREAKS: { year: number; weight: number }[] = [
  { year: -3000, weight: 0 },
  { year: -500, weight: 10 },
  { year: 500, weight: 12 },
  { year: 1000, weight: 8 },
  { year: 1500, weight: 12 },
  { year: 1700, weight: 8 },
  { year: 1800, weight: 12 },
  { year: 1900, weight: 20 },
  { year: 1960, weight: 10 },
  { year: 2026, weight: 8 },
];

const TOTAL_WEIGHT = BREAKS.reduce((a, b) => a + b.weight, 0);

export const YEAR_MIN = -3000;
export const YEAR_MAX = 2026;

/** Maps a year to a fraction 0..1 along the timeline. Deep past clamps left. */
export function yearToFraction(year: number): number {
  const y = Math.max(YEAR_MIN, Math.min(YEAR_MAX, year));
  let acc = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const prev = BREAKS[i - 1];
    const cur = BREAKS[i];
    if (y <= cur.year) {
      const t = (y - prev.year) / (cur.year - prev.year);
      acc += cur.weight * t;
      return acc / TOTAL_WEIGHT;
    }
    acc += cur.weight;
  }
  return 1;
}

/** yearToX for an SVG of a given inner width. */
export function makeYearToX(width: number, padLeft = 0) {
  return (year: number) => padLeft + yearToFraction(year) * width;
}

export const TICK_YEARS = [-3000, -500, 1, 500, 1000, 1500, 1700, 1800, 1900, 1960, 2026];

export function formatYear(year: number): string {
  if (year === 0) return "n/a";
  if (year < 0) {
    const abs = Math.abs(year);
    return abs >= 10000 ? `${Math.round(abs / 1000)}k BCE` : `${abs} BCE`;
  }
  if (year === 1) return "1 CE";
  return String(year);
}

export function formatDuration(seconds: string | number): string {
  const s = typeof seconds === "string" ? parseInt(seconds, 10) : seconds;
  if (!s || Number.isNaN(s)) return "";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function snippet(text: string, n = 140): string {
  const clean = text.replace(/Learn more about your ad choices.*$/i, "").trim();
  if (clean.length <= n) return clean;
  return clean.slice(0, clean.lastIndexOf(" ", n)) + "…";
}

/* ------------------------------------------------------------------ *
 * Data loading
 * ------------------------------------------------------------------ */

async function loadJson<T>(file: string): Promise<T> {
  // Relative fetch: these are static assets shipped beside index.html.
  const res = await fetch(file);
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return (await res.json()) as T;
}

export interface Atlas {
  episodes: Episode[];
  playlists: Playlist[];
  stats: Stats;
  byGuid: Map<string, Episode>;
  bySeries: Map<string, Episode[]>;
  byPlaylistId: Map<string, Playlist>;
  chronological: Episode[];
  latest: Episode[];
  seriesList: { key: string; name: string; episodes: Episode[] }[];
  regions: string[];
  themes: string[];
  searchText: Map<string, string>;
}

// ============================================================
// Extras: live shows, YouTube, club — refreshed daily by the pipeline
// ============================================================

export interface LiveEvent {
  name: string;
  date_iso: string;
  date_display: string;
  venue: string;
  cta: string;
  link: string;
}

export interface YouTubeVideo {
  video_id: string;
  url: string;
  title: string;
  published: string;
  thumbnail: string;
  slug: string;
}

export interface ClubMeta {
  benefits: string[];
  monthly_price_display: string;
  yearly_price_display: string;
  signup_url: string;
  site_url: string;
  last_updated: string;
}

export interface Extras {
  live_events: LiveEvent[];
  youtube_latest: YouTubeVideo[];
  club: ClubMeta;
  fetched_at: string;
}

export function useExtras() {
  return useQuery<Extras>({
    queryKey: ["extras"],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      try {
        return await loadJson<Extras>("extras.json");
      } catch {
        // Older builds without extras.json still render — return an empty shell
        return {
          live_events: [],
          youtube_latest: [],
          club: {
            benefits: [],
            monthly_price_display: "",
            yearly_price_display: "",
            signup_url: "https://therestishistory.com/club",
            site_url: "https://therestishistory.com",
            last_updated: "",
          },
          fetched_at: "",
        };
      }
    },
  });
}

export function useAtlas() {
  const q = useQuery<Atlas>({
    queryKey: ["atlas"],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const [episodes, playlists, stats] = await Promise.all([
        loadJson<Episode[]>("episodes.json"),
        loadJson<Playlist[]>("playlists.json"),
        loadJson<Stats>("stats.json"),
      ]);

      const byGuid = new Map(episodes.map((e) => [e.guid, e]));
      const bySeries = new Map<string, Episode[]>();
      for (const e of episodes) {
        if (!e.series_key) continue;
        const arr = bySeries.get(e.series_key) ?? [];
        arr.push(e);
        bySeries.set(e.series_key, arr);
      }
      bySeries.forEach((arr) => {
        arr.sort((a: Episode, b: Episode) => (a.part_number ?? 0) - (b.part_number ?? 0));
      });

      const chronological = [...episodes].sort(
        (a, b) =>
          a.primary_start_year - b.primary_start_year ||
          a.pubdate.localeCompare(b.pubdate),
      );
      const latest = [...episodes]
        .sort((a, b) => b.pubdate.localeCompare(a.pubdate))
        .slice(0, 8);

      const seriesList = Array.from(bySeries.entries())
        .map(([key, eps]) => ({ key, name: eps[0].series_name || key, episodes: eps }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const searchText = new Map<string, string>();
      for (const e of episodes) {
        searchText.set(
          e.guid,
          `${e.title} ${e.description} ${e.key_figures.join(" ")} ${e.primary_region} ${e.era_bucket}`.toLowerCase(),
        );
      }

      const regions = Object.keys(stats.regions);
      const themes = Object.keys(stats.themes);

      return {
        episodes,
        playlists,
        stats,
        byGuid,
        bySeries,
        byPlaylistId: new Map(playlists.map((p) => [p.id, p])),
        chronological,
        latest,
        seriesList,
        regions,
        themes,
        searchText,
      };
    },
  });
  return q;
}

/* Playlist grouping ------------------------------------------------- */
const ERA_PLAYLISTS = [
  "prehistory-deep-past",
  "ancient-world",
  "the-medieval-world",
  "early-modern",
  "the-long-19th-century",
  "world-wars-interwar",
  "the-postwar-world",
  "contemporary-history",
];
const REGION_PLAYLISTS = [
  "britain",
  "ireland",
  "france",
  "germany",
  "italy",
  "russia",
  "eastern-europe",
  "europe",
  "mediterranean",
  "middle-east",
  "africa",
  "china",
  "japan",
  "united-states",
  "latin-america",
  "global",
];
const CURATED_PLAYLISTS = [
  "the-long-1800-1934",
  "roman-history",
  "tudors-stuarts",
  "the-napoleonic-age",
  "the-world-wars",
  "american-civil-war-era",
  "cold-war-flashpoints",
  "the-1960s",
];

export function groupPlaylists(playlists: Playlist[]) {
  const pick = (ids: string[]) =>
    ids.map((id) => playlists.find((p) => p.id === id)).filter(Boolean) as Playlist[];
  const used = new Set([...ERA_PLAYLISTS, ...REGION_PLAYLISTS, ...CURATED_PLAYLISTS]);
  return [
    { key: "curated", title: "Curated", blurb: "Hand-assembled runs, including one very specific obsession.", items: pick(CURATED_PLAYLISTS) },
    { key: "era", title: "By Era", blurb: "The whole show, sliced into the periods historians argue about.", items: pick(ERA_PLAYLISTS) },
    { key: "region", title: "By Region", blurb: "Where in the world the trouble was happening.", items: pick(REGION_PLAYLISTS) },
    { key: "theme", title: "By Theme", blurb: "Kings, wars, scandals and the occasional plague.", items: playlists.filter((p) => !used.has(p.id)) },
  ];
}

export const FEATURED_PLAYLIST_IDS = [
  "the-long-1800-1934",
  "ancient-world",
  "the-napoleonic-age",
  "cold-war-flashpoints",
  "roman-history",
  "the-world-wars",
];

/* Hooks ------------------------------------------------------------- */
export function useDebounced<T>(value: T, ms = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);
    }
  }, [title, description]);
}

/** Measures an element's width for responsive SVG work. */
export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

export function relatedEpisodes(atlas: Atlas, ep: Episode, n = 6): Episode[] {
  const sameBoth = atlas.episodes.filter(
    (e) =>
      e.guid !== ep.guid &&
      e.era_bucket === ep.era_bucket &&
      e.primary_region === ep.primary_region,
  );
  const sameEra = atlas.episodes.filter(
    (e) => e.guid !== ep.guid && e.era_bucket === ep.era_bucket && e.primary_region !== ep.primary_region,
  );
  const out = [...sameBoth, ...sameEra];
  const seen = new Set<string>();
  return out
    .filter((e) => (seen.has(e.guid) ? false : (seen.add(e.guid), true)))
    .slice(0, n);
}

export function useMemoized<T>(fn: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(fn, deps);
}
