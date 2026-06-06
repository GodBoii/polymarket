"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

type River = {
  country: string;
  flag: string;
  color: string;
  // Series of probabilities over time, 0..1
  series: number[];
};

const RIVERS: River[] = [
  {
    country: "Brazil",
    flag: "🇧🇷",
    color: "#00E5FF",
    // 90 days of probability
    series: seedSeries(0.18, 0.27, 0.23, 0.04),
  },
  {
    country: "Argentina",
    flag: "🇦🇷",
    color: "#9bdcff",
    series: seedSeries(0.12, 0.24, 0.18, 0.05),
  },
  {
    country: "France",
    flag: "🇫🇷",
    color: "#00FF88",
    series: seedSeries(0.08, 0.22, 0.16, 0.05),
  },
  {
    country: "England",
    flag: "🏴",
    color: "#FFD166",
    series: seedSeries(0.06, 0.18, 0.14, 0.04),
  },
  {
    country: "Spain",
    flag: "🇪🇸",
    color: "#7B61FF",
    series: seedSeries(0.05, 0.14, 0.10, 0.03),
  },
  {
    country: "Germany",
    flag: "🇩🇪",
    color: "#FF5577",
    series: seedSeries(0.07, 0.13, 0.08, 0.025),
  },
];

function seedSeries(min: number, max: number, current: number, jitter: number) {
  const arr: number[] = [];
  const n = 90;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // Smooth random walk that drifts toward the current value at t=1
    const target = min + (current - min) * t * t;
    const wiggle = (Math.sin(i * 0.7) + Math.cos(i * 1.3)) * jitter;
    arr.push(Math.max(0.005, target + wiggle));
  }
  arr[n - 1] = current;
  return arr;
}

const PADDING = { top: 40, right: 60, bottom: 60, left: 200 };
const HEIGHT = 520;

export default function ProbabilityRivers() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const W = Math.max(800, width);
  const innerW = W - PADDING.left - PADDING.right;
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;

  // Build river path per team
  const rivers = useMemo(() => {
    return RIVERS.map((r) => {
      const stepX = innerW / (r.series.length - 1);
      // Center line for the river
      const centerY = (i: number) => PADDING.top + innerH * (1 - r.series[i]);
      // Top and bottom of the river, with width = 0.3 + series * 1.2
      const topPath: string[] = [];
      const bottomPath: string[] = [];
      for (let i = 0; i < r.series.length; i++) {
        const x = PADDING.left + i * stepX;
        const c = centerY(i);
        const halfW = (0.4 + r.series[i] * 2.2);
        topPath.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${(c - halfW).toFixed(1)}`);
        bottomPath.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${(c + halfW).toFixed(1)}`);
      }
      const areaPath = `${topPath.join(" ")} ${bottomPath.reverse().join(" L ").replace(/^M/, "L")} Z`;
      const centerPath = topPath.map((seg, i) => {
        const x = PADDING.left + i * stepX;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${centerY(i).toFixed(1)}`;
      }).join(" ");
      return { ...r, areaPath, centerPath, stepX };
    });
  }, [innerW, innerH]);

  // X-axis labels (every 15 days)
  const xLabels = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    for (let i = 0; i < 90; i += 15) {
      out.push({
        x: PADDING.left + (i / 89) * innerW,
        label: i === 0 ? "90d ago" : i === 89 ? "Now" : `${89 - i}d ago`,
      });
    }
    return out;
  }, [innerW]);

  // Y-axis labels (probability)
  const yLabels = [0, 5, 10, 15, 20, 25, 30].map((v) => ({
    y: PADDING.top + innerH * (1 - v / 30),
    label: `${v}%`,
  }));

  return (
    <section id="rivers" ref={ref} className="relative w-full bg-ink-950 py-24 md:py-40">
      <div className="page-x">
        <div className="grid grid-cols-12 gap-8 mb-12">
          <div className="col-span-12 md:col-span-6">
            <div className="kicker mb-6">
              <span className="dot" />
              <span>03 / PROBABILITY RIVERS</span>
            </div>
            <h2
              className="font-display text-white"
              style={{
                fontSize: "clamp(48px, 7vw, 112px)",
                lineHeight: 0.95,
                letterSpacing: "-0.04em",
                fontWeight: 500,
              }}
            >
              Watching <br />
              <span className="text-signal-success">belief</span> evolve.
            </h2>
          </div>
          <div className="col-span-12 md:col-span-5 md:col-start-8 self-end">
            <p className="text-white/55 text-lg leading-relaxed">
              Not candles. Not charts. Rivers — where the width of every stream is the crowd&apos;s confidence in that outcome, right now.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4 text-[11px] font-mono uppercase tracking-widest">
              <div>
                <div className="text-white/40">Streams widen</div>
                <div className="text-signal-success">Confidence ↑</div>
              </div>
              <div>
                <div className="text-white/40">Streams contract</div>
                <div className="text-signal-warning">Doubt sets in</div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart container */}
        <div className="relative w-full overflow-x-auto" style={{ minHeight: HEIGHT }}>
          <svg
            viewBox={`0 0 ${W} ${HEIGHT}`}
            width={W}
            height={HEIGHT}
            preserveAspectRatio="none"
            className="block"
            onMouseLeave={() => setHoverIndex(null)}
            onMouseMove={(e) => {
              const svg = e.currentTarget;
              const pt = svg.createSVGPoint();
              pt.x = e.clientX;
              pt.y = e.clientY;
              const ctm = svg.getScreenCTM();
              if (!ctm) return;
              const local = pt.matrixTransform(ctm.inverse());
              const xRel = local.x - PADDING.left;
              const idx = Math.round((xRel / innerW) * 89);
              if (idx >= 0 && idx <= 89) setHoverIndex(idx);
            }}
          >
            <defs>
              {RIVERS.map((r) => (
                <linearGradient
                  key={r.country}
                  id={`grad-${r.country}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor={r.color} stopOpacity="0.0" />
                  <stop offset="20%" stopColor={r.color} stopOpacity="0.6" />
                  <stop offset="100%" stopColor={r.color} stopOpacity="0.95" />
                </linearGradient>
              ))}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" />
              </filter>
            </defs>

            {/* Y axis gridlines + labels */}
            {yLabels.map((g) => (
              <g key={g.label}>
                <line
                  x1={PADDING.left}
                  x2={W - PADDING.right}
                  y1={g.y}
                  y2={g.y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="1"
                />
                <text
                  x={PADDING.left - 12}
                  y={g.y + 4}
                  fill="rgba(255,255,255,0.4)"
                  fontSize="10"
                  fontFamily="ui-monospace, monospace"
                  textAnchor="end"
                >
                  {g.label}
                </text>
              </g>
            ))}

            {/* X axis labels */}
            {xLabels.map((l, i) => (
              <g key={i}>
                <line
                  x1={l.x}
                  x2={l.x}
                  y1={PADDING.top}
                  y2={HEIGHT - PADDING.bottom}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth="1"
                />
                <text
                  x={l.x}
                  y={HEIGHT - PADDING.bottom + 20}
                  fill="rgba(255,255,255,0.4)"
                  fontSize="10"
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                >
                  {l.label}
                </text>
              </g>
            ))}

            {/* Rivers */}
            {rivers.map((r) => (
              <g key={r.country}>
                <motion.path
                  d={r.areaPath}
                  fill={`url(#grad-${r.country})`}
                  initial={{ opacity: 0 }}
                  animate={inView ? { opacity: 0.85 } : {}}
                  transition={{ duration: 1.4, delay: 0.1 }}
                />
                <motion.path
                  d={r.centerPath}
                  stroke={r.color}
                  strokeWidth="1"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={inView ? { pathLength: 1 } : {}}
                  transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
                />
              </g>
            ))}

            {/* Country labels at the right edge of each river */}
            {rivers.map((r) => {
              const lastY = PADDING.top + innerH * (1 - r.series[r.series.length - 1]);
              return (
                <g key={`label-${r.country}`}>
                  <text
                    x={W - PADDING.right + 12}
                    y={lastY + 4}
                    fill={r.color}
                    fontSize="11"
                    fontFamily="ui-monospace, monospace"
                  >
                    {r.flag} {r.country}
                  </text>
                  <text
                    x={W - PADDING.right + 12}
                    y={lastY + 18}
                    fill="rgba(255,255,255,0.6)"
                    fontSize="11"
                    fontFamily="ui-monospace, monospace"
                  >
                    {(r.series[r.series.length - 1] * 100).toFixed(1)}%
                  </text>
                </g>
              );
            })}

            {/* "Now" line */}
            <line
              x1={W - PADDING.right}
              x2={W - PADDING.right}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1"
              strokeDasharray="3 4"
            />

            {/* Hover indicator */}
            {hoverIndex !== null && (
              <g>
                <line
                  x1={PADDING.left + (hoverIndex / 89) * innerW}
                  x2={PADDING.left + (hoverIndex / 89) * innerW}
                  y1={PADDING.top}
                  y2={HEIGHT - PADDING.bottom}
                  stroke="rgba(255,255,255,0.6)"
                  strokeWidth="1"
                />
                {rivers.map((r) => {
                  const x = PADDING.left + (hoverIndex / 89) * innerW;
                  const y = PADDING.top + innerH * (1 - r.series[hoverIndex]);
                  return (
                    <circle
                      key={`h-${r.country}`}
                      cx={x}
                      cy={y}
                      r="3"
                      fill={r.color}
                      stroke="#fff"
                      strokeWidth="0.5"
                    />
                  );
                })}
              </g>
            )}
          </svg>

          {/* Floating tooltip */}
          {hoverIndex !== null && (
            <div
              className="absolute pointer-events-none z-10"
              style={{
                left: `${((PADDING.left + (hoverIndex / 89) * innerW) / W) * 100}%`,
                top: 20,
                transform: "translateX(-50%)",
              }}
            >
              <div className="bg-black/80 backdrop-blur border border-white/15 rounded-md px-3 py-2 font-mono text-[11px]">
                <div className="text-white/40 uppercase tracking-widest text-[9px] mb-1">
                  T-{89 - hoverIndex} days
                </div>
                <div className="space-y-0.5">
                  {RIVERS.map((r) => (
                    <div key={r.country} className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: r.color }} />
                      <span className="text-white/60">{r.country}</span>
                      <span className="text-white tabular">{(r.series[hoverIndex] * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legend / instructions */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono uppercase tracking-widest text-white/40">
          <span>Hover anywhere along the rivers to inspect.</span>
          <span>Updated continuously · Source: ORACLE collective</span>
        </div>
      </div>
    </section>
  );
}
