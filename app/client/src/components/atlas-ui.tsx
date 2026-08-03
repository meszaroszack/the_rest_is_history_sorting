import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Moon, Sun, Menu, X } from "lucide-react";
import { eraColor, snippet, type Episode } from "@/lib/atlas";
import { cn } from "@/lib/utils";

/* ---------------------------------- Logo --------------------------- */
export function AtlasMark({ className = "", size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="The Rest Is History Atlas mark"
      role="img"
    >
      <circle cx="16" cy="16" r="14.2" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <path
        d="M16 2.4 L20.6 11.4 L16 16 L11.4 11.4 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M16 29.6 L11.4 20.6 L16 16 L20.6 20.6 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M11.4 11.4 H20.6 M11.4 20.6 H20.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.4 16 H8 M24 16 H29.6" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <circle cx="16" cy="16" r="1.05" fill="currentColor" />
    </svg>
  );
}

/* --------------------------------- Theme --------------------------- */
type ThemeCtx = { dark: boolean; toggle: () => void };
const ThemeContext = createContext<ThemeCtx>({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const value = useMemo(() => ({ dark, toggle: () => setDark((d) => !d) }), [dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/* ---------------------------------- Nav ---------------------------- */
const NAV = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/timeline", label: "Timeline" },
  { href: "/playlists", label: "Playlists" },
  { href: "/about", label: "About" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const [loc] = useLocation();
  return (
    <>
      {NAV.map((n) => {
        const active = n.href === "/" ? loc === "/" : loc.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            data-testid={`link-nav-${n.label.toLowerCase()}`}
            className={cn(
              "smallcaps text-base transition-colors py-1",
              active ? "text-primary" : "text-foreground/70 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "pb-0.5",
                active && "border-b-2",
              )}
              style={active ? { borderColor: "hsl(var(--brass))" } : undefined}
            >
              {n.label}
            </span>
          </Link>
        );
      })}
    </>
  );
}

export function TopNav() {
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      style={{ borderColor: "hsl(var(--parchment-edge))" }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex h-16 items-center gap-4">
          <Link href="/" data-testid="link-home-logo" className="flex items-center gap-2.5 text-primary">
            <AtlasMark size={30} />
            <span className="display text-lg font-semibold leading-none text-foreground">
              The Rest Is History <span className="brass">Atlas</span>
            </span>
          </Link>
          <nav className="ml-auto hidden items-center gap-6 md:flex">
            <NavLinks />
          </nav>
          <button
            type="button"
            onClick={toggle}
            data-testid="button-theme-toggle"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="ml-auto rounded-md border p-2 text-foreground/75 hover-elevate md:ml-2"
            style={{ borderColor: "hsl(var(--parchment-edge))" }}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            data-testid="button-mobile-menu"
            aria-label="Menu"
            className="rounded-md border p-2 text-foreground/75 hover-elevate md:hidden"
            style={{ borderColor: "hsl(var(--parchment-edge))" }}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
        {open && (
          <nav className="flex flex-col gap-3 border-t py-4 md:hidden" style={{ borderColor: "hsl(var(--parchment-edge))" }}>
            <NavLinks onNavigate={() => setOpen(false)} />
          </nav>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-24 border-t py-10" style={{ borderColor: "hsl(var(--parchment-edge))" }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <AtlasMark size={26} className="mt-0.5 text-primary" />
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Not affiliated with Goalhanger or The Rest Is History. Data collected from the{" "}
              <a
                href="https://feeds.megaphone.fm/GLT4787413333"
                target="_blank"
                rel="noreferrer"
                data-testid="link-rss-feed"
                className="link-underline text-foreground"
              >
                public RSS feed
              </a>{" "}
              on 2026-08-03. Episode metadata tagged by AI — corrections welcome.
            </p>
          </div>
          <p className="smallcaps text-sm text-muted-foreground">Tom &amp; Dominic did the hard part</p>
        </div>
      </div>
    </footer>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/* --------------------------------- Pills --------------------------- */
export function EraPill({ era, className }: { era: string; className?: string }) {
  return (
    <span
      className={cn("smallcaps inline-flex items-center gap-1.5 text-sm", className)}
      style={{ color: eraColor(era) }}
      data-testid={`pill-era-${era}`}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: eraColor(era) }} />
      {era}
    </span>
  );
}

export function Chip({
  children,
  onRemove,
  testId,
  tone = "default",
}: {
  children: ReactNode;
  onRemove?: () => void;
  testId?: string;
  tone?: "default" | "brass" | "primary";
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs",
        tone === "primary" && "border-primary/40 bg-primary/10 text-primary",
        tone === "brass" && "text-brass",
      )}
      style={
        tone === "brass"
          ? { borderColor: "hsl(var(--brass) / 0.45)", backgroundColor: "hsl(var(--brass) / 0.08)" }
          : tone === "default"
            ? { borderColor: "hsl(var(--parchment-edge))" }
            : undefined
      }
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          data-testid={testId ? `${testId}-remove` : undefined}
          className="ml-0.5 opacity-60 hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/* ------------------------------ Episode card ----------------------- */
export function EpisodeCard({ ep, seriesName }: { ep: Episode; seriesName?: string }) {
  return (
    <Link
      href={`/episode/${encodeURIComponent(ep.guid)}`}
      data-testid={`card-episode-${ep.guid}`}
      className="paper-card group flex flex-col gap-3 p-5 transition-transform duration-200 hover:-translate-y-0.5 hover-elevate"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="display text-xl font-semibold tracking-tight" data-testid={`text-year-${ep.guid}`}>
          {ep.year_label}
        </span>
        {ep.episode_number != null && (
          <span className="smallcaps text-xs text-muted-foreground">No. {ep.episode_number}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <EraPill era={ep.era_bucket} />
        <span className="smallcaps text-sm text-muted-foreground">{ep.primary_region}</span>
      </div>
      <h3 className="display text-base font-medium leading-snug group-hover:text-primary">
        {ep.display_title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{snippet(ep.description, 140)}</p>
      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {ep.themes.slice(0, 4).map((t) => (
          <span
            key={t}
            className="rounded-full border px-2 py-0.5 text-[11px] text-foreground/70"
            style={{ borderColor: "hsl(var(--parchment-edge))" }}
          >
            {t}
          </span>
        ))}
      </div>
      {ep.series_key && ep.part_number != null && (
        <p className="smallcaps text-xs" style={{ color: "hsl(var(--brass))" }}>
          Part {ep.part_number} of {seriesName ?? ep.series_name ?? ep.series_key}
        </p>
      )}
    </Link>
  );
}

/* ------------------------------ States ----------------------------- */
export function Loading({ label = "Unrolling the map" }: { label?: string }) {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6" data-testid="status-loading">
      <p className="smallcaps text-base text-muted-foreground">{label}…</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="paper-card h-44 animate-pulse opacity-60" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title = "No episodes here.",
  body = "Not even Dominic would have opinions about this era.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <div className="paper-card px-6 py-16 text-center" data-testid="status-empty">
      <p className="display text-lg font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function SectionHeading({
  kicker,
  title,
  action,
}: {
  kicker?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {kicker && <p className="smallcaps text-sm text-muted-foreground">{kicker}</p>}
        <h2 className="display text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}
