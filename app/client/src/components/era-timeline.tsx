import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ERA_SPANS,
  TICK_YEARS,
  eraColor,
  formatYear,
  useMeasure,
  yearToFraction,
  type Episode,
} from "@/lib/atlas";

interface Mark {
  ep: Episode;
  x: number;
  y: number;
}

/**
 * The signature visual: every dated episode as a mark on a piecewise scale
 * that lets 3000 BCE and 2026 CE share a single ruler.
 */
export function EraTimeline({ episodes, height = 268 }: { episodes: Episode[]; height?: number }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<Mark | null>(null);
  const [, navigate] = useLocation();

  const padL = 34;
  const padR = 30;
  const innerW = Math.max(0, width - padL - padR);
  const axisY = height - 30;

  const { marks, dotR } = useMemo<{ marks: Mark[]; dotR: number }>(() => {
    if (!innerW) return { marks: [], dotR: 3 };
    const dated = episodes
      .filter((e) => e.primary_start_year !== 0)
      .sort((a, b) => a.primary_start_year - b.primary_start_year);
    const bucketW = Math.max(4, Math.min(6, innerW / 200));
    const occupancy = new Map<number, number>();
    const placed = dated.map((ep) => {
      const x = padL + yearToFraction(ep.primary_start_year) * innerW;
      const b = Math.round(x / bucketW);
      let row = 0;
      // Pack marks upward, checking neighbouring buckets so dots never touch.
      while (row < 60) {
        const clash = [b - 1, b, b + 1].some((k) => occupancy.get(k * 1000 + row) === 1);
        if (!clash) break;
        row += 1;
      }
      occupancy.set(b * 1000 + row, 1);
      return { ep, x, row };
    });
    const maxRow = placed.reduce((a, p) => Math.max(a, p.row), 0);
    const available = axisY - 34;
    const rowH = Math.min(6.2, available / (maxRow + 1));
    return {
      marks: placed.map((p) => ({ ep: p.ep, x: p.x, y: axisY - 8 - p.row * rowH })),
      dotR: Math.max(1.5, Math.min(3, rowH / 2.05)),
    };
  }, [episodes, innerW, axisY]);

  const ticks = innerW < 560 ? [-3000, 1000, 1500, 1800, 1900, 2026] : TICK_YEARS;

  return (
    <div className="relative w-full" ref={ref} data-testid="chart-era-timeline">
      <svg width="100%" height={height} role="img" aria-label="Timeline of every dated episode">
        {/* era bands */}
        {ERA_SPANS.map((s) => {
          const x1 = padL + yearToFraction(s.from) * innerW;
          const x2 = padL + yearToFraction(s.to) * innerW;
          return (
            <g key={s.era}>
              <rect
                x={x1}
                y={24}
                width={Math.max(0, x2 - x1)}
                height={axisY - 24}
                fill={eraColor(s.era)}
                opacity={0.06}
              />
              <line x1={x1} y1={24} x2={x1} y2={axisY} stroke={eraColor(s.era)} opacity={0.28} strokeWidth={1} />
              {x2 - x1 > 96 && (
                <text
                  x={x1 + 6}
                  y={17}
                  fontSize={10}
                  className="smallcaps"
                  fill={eraColor(s.era)}
                  opacity={0.95}
                  style={{ letterSpacing: "0.08em" }}
                >
                  {s.era}
                </text>
              )}
            </g>
          );
        })}

        {/* axis */}
        <line
          x1={padL}
          y1={axisY}
          x2={width - padR}
          y2={axisY}
          stroke="hsl(var(--foreground))"
          opacity={0.35}
        />
        {ticks.map((y) => {
          const x = padL + yearToFraction(y) * innerW;
          return (
            <g key={y}>
              <line x1={x} y1={axisY} x2={x} y2={axisY + 5} stroke="hsl(var(--foreground))" opacity={0.4} />
              <text
                x={x}
                y={axisY + 19}
                fontSize={10.5}
                textAnchor={y === ticks[0] ? "start" : y === ticks[ticks.length - 1] ? "end" : "middle"}
                fill="hsl(var(--muted-foreground))"
                fontFamily="Fraunces, Georgia, serif"
              >
                {formatYear(y)}
              </text>
            </g>
          );
        })}

        {/* episode marks */}
        {marks.map((m) => (
          <circle
            key={m.ep.guid}
            cx={m.x}
            cy={m.y}
            r={hover?.ep.guid === m.ep.guid ? dotR + 2 : dotR}
            fill={eraColor(m.ep.era_bucket)}
            opacity={hover && hover.ep.guid !== m.ep.guid ? 0.4 : 0.85}
            stroke={hover?.ep.guid === m.ep.guid ? "hsl(var(--foreground))" : "none"}
            strokeWidth={1}
            style={{ cursor: "pointer", transition: "r 120ms ease, opacity 120ms ease" }}
            onMouseEnter={() => setHover(m)}
            onMouseLeave={() => setHover((h) => (h?.ep.guid === m.ep.guid ? null : h))}
            onClick={() => navigate(`/episode/${encodeURIComponent(m.ep.guid)}`)}
            data-testid={`mark-episode-${m.ep.guid}`}
          />
        ))}
      </svg>

      {hover && (
        <div
          className="paper-card pointer-events-none absolute z-20 w-64 p-3 shadow-lg"
          style={{
            left: Math.min(Math.max(hover.x - 128, 0), Math.max(0, width - 256)),
            top: Math.max(hover.y - 96, -8),
          }}
          data-testid="tooltip-timeline"
        >
          <p className="display text-sm font-semibold">{hover.ep.year_label}</p>
          <p className="mt-1 text-xs leading-snug text-foreground/85">{hover.ep.display_title}</p>
          <p className="smallcaps mt-1.5 text-xs text-muted-foreground">
            {hover.ep.era_bucket} · {hover.ep.primary_region}
          </p>
        </div>
      )}
    </div>
  );
}
