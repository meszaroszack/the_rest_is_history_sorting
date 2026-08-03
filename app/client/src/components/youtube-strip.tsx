import { Play, ExternalLink } from "lucide-react";
import { useExtras } from "@/lib/atlas";
import { SectionHeading } from "@/components/atlas-ui";

/**
 * Latest-on-YouTube strip — pulls the 6 most recent videos from the show's
 * YouTube RSS feed (@restishistorypod). Refreshed daily by the pipeline.
 */
export function YouTubeStrip() {
  const { data: extras } = useExtras();
  const videos = extras?.youtube_latest ?? [];
  if (videos.length === 0) return null;

  return (
    <section className="mt-16" data-testid="section-youtube">
      <SectionHeading
        kicker="Clips, shorts, and full videos"
        title="Latest on YouTube"
        action={
          <a
            href="https://www.youtube.com/@restishistorypod"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-youtube-channel"
            className="hidden items-center gap-1.5 text-sm hover:text-primary sm:inline-flex"
          >
            Full channel <ExternalLink className="h-3.5 w-3.5" />
          </a>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {videos.slice(0, 6).map((v) => (
          <a
            key={v.video_id}
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`card-youtube-${v.video_id}`}
            className="paper-card group flex flex-col overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover-elevate"
          >
            <div
              className="relative aspect-video w-full overflow-hidden bg-black"
              style={{ borderBottom: "1px solid hsl(var(--card-border))" }}
            >
              <img
                src={v.thumbnail}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-80 transition-opacity group-hover:opacity-100">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-md ring-1 ring-black/10"
                  aria-label="Play"
                >
                  <Play className="h-4 w-4 translate-x-[1px] fill-current text-black" />
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1 p-4">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
                {v.title}
              </h3>
              <p className="smallcaps text-xs text-muted-foreground">{v.published}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
