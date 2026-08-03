import { CalendarDays, ExternalLink, Ticket } from "lucide-react";
import { useExtras, type LiveEvent } from "@/lib/atlas";
import { SectionHeading } from "@/components/atlas-ui";

interface EventGroup {
  name: string;
  venue: string;
  link: string;
  cta: string;
  dates: string[]; // ISO dates
  date_range_display: string;
  key: string;
}

function groupEvents(events: LiveEvent[]): EventGroup[] {
  const byKey = new Map<string, LiveEvent[]>();
  for (const ev of events) {
    // Same event across consecutive days => same key
    const key = `${ev.name}::${ev.venue}`;
    const arr = byKey.get(key) ?? [];
    arr.push(ev);
    byKey.set(key, arr);
  }
  const groups: EventGroup[] = [];
  for (const [key, evs] of byKey) {
    evs.sort((a, b) => a.date_iso.localeCompare(b.date_iso));
    const first = evs[0];
    const last = evs[evs.length - 1];
    let display: string;
    if (evs.length === 1) {
      display = first.date_display;
    } else {
      // Consecutive? Show a range with a nights-count kicker.
      const [_fy, fm, fd] = first.date_iso.split("-");
      const [_ly, lm, ld] = last.date_iso.split("-");
      const fyear = first.date_iso.slice(0, 4);
      const lyear = last.date_iso.slice(0, 4);
      const monthName = new Date(first.date_iso + "T00:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      });
      const lastMonthName = new Date(last.date_iso + "T00:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      });
      if (fm === lm && fyear === lyear) {
        display = `${monthName} ${parseInt(fd, 10)}–${parseInt(ld, 10)}, ${fyear}`;
      } else {
        display = `${monthName} ${parseInt(fd, 10)}, ${fyear} – ${lastMonthName} ${parseInt(
          ld,
          10,
        )}, ${lyear}`;
      }
    }
    groups.push({
      name: first.name,
      venue: first.venue,
      link: first.link,
      cta: first.cta,
      dates: evs.map((e) => e.date_iso),
      date_range_display: display,
      key,
    });
  }
  groups.sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
  return groups;
}

/**
 * Live Shows strip — surfaces upcoming shows scraped daily from
 * therestishistory.com/events. Renders nothing when no shows are upcoming.
 * Multi-night runs of the same event are grouped into a single card.
 */
export function LiveShowsStrip() {
  const { data: extras } = useExtras();
  const events = extras?.live_events ?? [];
  if (events.length === 0) return null;
  const groups = groupEvents(events);

  return (
    <section className="mt-14" data-testid="section-live-shows">
      <SectionHeading
        kicker="Tom & Dominic, live on stage"
        title="Upcoming live shows"
        action={
          <a
            href="https://therestishistory.com/events"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-all-live-shows"
            className="hidden items-center gap-1.5 text-sm hover:text-primary sm:inline-flex"
          >
            All events <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.slice(0, 6).map((g) => (
          <a
            key={g.key}
            href={g.link}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`card-live-${g.dates[0]}`}
            className="paper-card group flex flex-col gap-3 p-5 transition-transform duration-200 hover:-translate-y-0.5 hover-elevate"
          >
            <div className="flex items-start justify-between gap-3">
              <span
                className="smallcaps inline-flex items-center gap-1.5 text-sm"
                style={{ color: "hsl(var(--brass))" }}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {g.date_range_display}
              </span>
              <Ticket className="h-4 w-4 shrink-0 opacity-40 group-hover:opacity-100" />
            </div>
            <h3 className="display text-lg font-semibold leading-tight group-hover:text-primary">
              {g.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              {g.venue}
              {g.venue && g.dates.length > 1 ? " · " : ""}
              {g.dates.length > 1 && (
                <span>
                  {g.dates.length} nights
                </span>
              )}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
              {g.cta} <ExternalLink className="h-3 w-3" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
