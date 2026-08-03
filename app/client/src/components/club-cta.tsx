import { Sparkles, ExternalLink, Check } from "lucide-react";
import { useExtras } from "@/lib/atlas";

/**
 * Rest Is History Club CTA — a marketing card sending users to the paid
 * subscription. The Club's actual bonus-episode feed is authenticated and
 * not fetchable, so we surface the value prop only.
 */
export function ClubCTA() {
  const { data: extras } = useExtras();
  const club = extras?.club;
  const benefits = club?.benefits ?? [
    "Weekly bonus episodes",
    "Ad-free listening",
    "Early access to full series",
    "Live show presale tickets",
    "Members-only Discord",
  ];

  return (
    <section className="mt-16" data-testid="section-club-cta">
      <div
        className="paper-card relative overflow-hidden p-6 sm:p-8"
        style={{
          backgroundImage:
            "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card)) 55%, hsl(var(--brass) / 0.08) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--brass) / 0.25) 0%, transparent 65%)",
          }}
        />
        <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-center">
          <div>
            <p
              className="smallcaps inline-flex items-center gap-1.5 text-sm"
              style={{ color: "hsl(var(--brass))" }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Support the show
            </p>
            <h2 className="display mt-2 text-2xl font-semibold leading-tight sm:text-[1.75rem]">
              Join the Rest Is History Club
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Tom and Dominic put out an obscene amount of content for free. If
              this atlas helped you find something to listen to, the least you
              can do is throw them a few quid a month.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: "hsl(var(--brass))" }}
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end md:text-right">
            {club?.monthly_price_display && (
              <div>
                <p className="display text-2xl font-semibold">
                  {club.monthly_price_display}
                </p>
                {club.yearly_price_display && (
                  <p className="text-sm text-muted-foreground">
                    or {club.yearly_price_display}
                  </p>
                )}
              </div>
            )}
            <a
              href={club?.signup_url ?? "https://therestishistory.com/club"}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-club-signup"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover-elevate"
            >
              Join the Club <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://therestishistory.com"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-official-site"
              className="text-xs text-muted-foreground hover:text-primary"
            >
              Official site →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
