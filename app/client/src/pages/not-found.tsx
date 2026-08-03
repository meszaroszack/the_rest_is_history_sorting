import { Link } from "wouter";
import { AtlasMark } from "@/components/atlas-ui";
import { usePageMeta } from "@/lib/atlas";

export default function NotFound() {
  usePageMeta("Not found — The Rest Is History Atlas");
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start px-4 py-24 sm:px-6">
      <AtlasMark size={40} className="text-primary" />
      <h1 className="display mt-6 text-2xl font-semibold tracking-tight">
        This episode has fallen through the cracks of history.
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Whatever was here is now the subject of speculation, forged charters and a five-part series.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href="/"
          data-testid="link-404-home"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover-elevate"
        >
          Back to the atlas
        </Link>
        <Link
          href="/browse"
          data-testid="link-404-browse"
          className="rounded-md border px-4 py-2 text-sm hover-elevate"
          style={{ borderColor: "hsl(var(--parchment-edge))" }}
        >
          Browse episodes
        </Link>
      </div>
    </div>
  );
}
