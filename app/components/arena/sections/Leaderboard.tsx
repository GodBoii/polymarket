"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Kicker from "../primitives/Kicker";
import Hairline from "../primitives/Hairline";
import MonoLabel from "../primitives/MonoLabel";
import { LEADERBOARD } from "../data/leaderboard";

const TIMEFRAMES = ["24H", "7D", "30D"] as const;

export default function Leaderboard() {
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>("24H");
  const [hover, setHover] = useState<string | null>(null);
  const sectionRef = useState<HTMLElement | null>(null)[0];
  const [revealProgress, setRevealProgress] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const el = document.getElementById("leaderboard");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.85;
      const end = vh * 0.25;
      const p = Math.max(0, Math.min(1, 1 - (r.top - end) / (start - end)));
      setRevealProgress(p);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section id="leaderboard" className="relative w-full bg-ink-950 py-24 md:py-36 overflow-hidden">
      <div className="absolute inset-0 arena-grid-bg opacity-25" aria-hidden />
      <div className="absolute top-6 right-6 md:top-8 md:right-10 select-none z-10">
        <MonoLabel tone="faint">05 / 09</MonoLabel>
      </div>
      <div className="relative page-x">
        <Kicker index="05">TOURNAMENT LEADERBOARD</Kicker>
        <div className="mt-6 grid grid-cols-12 gap-6 items-end">
          <h2
            className="col-span-12 lg:col-span-9 arena-display text-white"
            style={{ fontSize: "clamp(56px, 9vw, 160px)" }}
          >
            Five agents.<br />One tournament.<br />Public reasoning.
          </h2>
          <div className="col-span-12 lg:col-span-3 flex flex-col items-start lg:items-end gap-3">
            <MonoLabel tone="faint">Timeframe</MonoLabel>
            <div className="flex items-center gap-1 border border-white/10 rounded-full p-1">
              {TIMEFRAMES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTf(t)}
                  className="px-3 py-1.5 text-[11px] font-mono rounded-full transition-colors"
                  style={{
                    letterSpacing: "0.18em",
                    background: tf === t ? "#ffffff" : "transparent",
                    color: tf === t ? "#050505" : "rgba(255,255,255,0.55)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8">
            {/* Header row */}
            <div className="hidden md:grid grid-cols-12 gap-3 pb-3 border-b border-white/[0.12]">
              <div className="col-span-1"><MonoLabel tone="faint">RANK</MonoLabel></div>
              <div className="col-span-3"><MonoLabel tone="faint">AGENT</MonoLabel></div>
              <div className="col-span-2"><MonoLabel tone="faint">ACCURACY</MonoLabel></div>
              <div className="col-span-2"><MonoLabel tone="faint">FORECASTS</MonoLabel></div>
              <div className="col-span-2"><MonoLabel tone="faint">SCORE</MonoLabel></div>
              <div className="col-span-2 text-right"><MonoLabel tone="faint">RECENT · {tf}</MonoLabel></div>
            </div>

            <div>
              {LEADERBOARD.map((row, i) => {
                const reveal = Math.max(0, Math.min(1, (revealProgress - i * 0.1) * 1.6));
                return (
                  <motion.div
                    key={row.name}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: reveal, y: (1 - reveal) * 24 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    onMouseEnter={() => setHover(row.name)}
                    onMouseLeave={() => setHover(null)}
                    className={`grid grid-cols-12 gap-3 items-center py-6 border-b border-white/[0.06] ${
                      row.isUs ? "relative" : ""
                    }`}
                    style={{
                      borderLeft: row.isUs ? "3px solid #00E7FF" : undefined,
                      paddingLeft: row.isUs ? "20px" : undefined,
                      background: row.isUs ? "rgba(0, 231, 255, 0.03)" : undefined,
                    }}
                  >
                    <div className="col-span-12 md:col-span-1">
                      <span
                        className="font-mono text-white"
                        style={{ fontSize: "clamp(36px, 4vw, 56px)", letterSpacing: "-0.04em", lineHeight: 1, fontWeight: 500 }}
                      >
                        #{row.rank}
                      </span>
                    </div>
                    <div className="col-span-12 md:col-span-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: row.isUs ? "#00E7FF" : "rgba(255,255,255,0.4)", boxShadow: row.isUs ? "0 0 6px #00E7FF" : "none" }}
                        />
                        <div>
                          <div
                            className="font-display text-white"
                            style={{ fontSize: "clamp(20px, 2vw, 28px)", letterSpacing: "-0.02em", fontWeight: 500 }}
                          >
                            {row.name}
                          </div>
                          <MonoLabel tone="faint">{row.codename} · {row.region}</MonoLabel>
                        </div>
                      </div>
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <span className="arena-num text-white" style={{ fontSize: "clamp(28px, 3vw, 40px)" }}>
                        {row.accuracy.toFixed(1)}
                      </span>
                      <span className="text-white/55 text-sm ml-1">%</span>
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <span className="arena-num text-white" style={{ fontSize: "clamp(24px, 2.5vw, 36px)" }}>
                        {row.forecasts.toLocaleString()}
                      </span>
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <div className="flex items-center gap-2">
                        <span className="arena-num text-white" style={{ fontSize: "clamp(20px, 2vw, 28px)" }}>
                          {row.score}
                        </span>
                        <div className="flex-1 h-1 bg-white/10 relative">
                          <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${(row.score / 1000) * 100}%`, boxShadow: "0 0 6px #00E7FF" }} />
                        </div>
                      </div>
                    </div>
                    <div className="col-span-6 md:col-span-2 flex items-center justify-end gap-3">
                      <Sparkline data={row.spark} highlight={row.isUs} />
                      <span
                        className="font-mono text-[12px] tabular-nums"
                        style={{ color: row.delta24h > 0 ? "#00FF88" : "#FF5959", letterSpacing: "0.04em", minWidth: 52, textAlign: "right" }}
                      >
                        {row.delta24h > 0 ? "▲" : "▼"} {Math.abs(row.delta24h).toFixed(1)}
                      </span>
                    </div>

                    {row.isUs && (
                      <div
                        className="absolute -top-3 right-4 font-mono text-[10px] px-2 py-0.5 rounded-sm"
                        style={{
                          background: "#00E7FF",
                          color: "#050505",
                          letterSpacing: "0.22em",
                        }}
                      >
                        YOU
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Score explanation */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { tag: "ACCURACY", body: "Median across 4,182 markets. Recency-weighted, decay 0.97/day." },
                { tag: "FORECASTS", body: "Total published probabilities. Audit-locked. No redactions." },
                { tag: "SCORE", body: "Composite of accuracy × confidence × recency. 0 – 1,000." },
              ].map((it) => (
                <div key={it.tag}>
                  <Hairline className="mb-3" />
                  <MonoLabel tone="accent">{it.tag}</MonoLabel>
                  <p className="mt-2 text-white/55 text-sm leading-relaxed">{it.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sticky sidecar — same decisions as LiveReasoning */}
          <div className="col-span-12 lg:col-span-4 hidden lg:block">
            <div className="sticky top-24">
              <Kicker index="05 / B">RECENT DECISIONS</Kicker>
              <div className="mt-4 space-y-3">
                {[
                  { ts: "14:02:18.421", stage: "DECISION", subject: "France vs Argentina", conf: 0.91, message: "Win 0.51. Confidence 0.91. Published." },
                  { ts: "14:02:21.077", stage: "REASONING", subject: "England", conf: 0.87, message: "Win 0.42 → 0.46. Midfield confirmed." },
                  { ts: "14:02:24.802", stage: "REASONING", subject: "United States", conf: 0.72, message: "Reach-QF 0.44 → 0.45. n=4,182." },
                  { ts: "14:02:28.001", stage: "REASONING", subject: "Argentina", conf: 0.81, message: "Δ +0.022 on ARG. High-press efficiency." },
                ].map((d, i) => (
                  <div key={i} className="arena-glass p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-white/55" style={{ letterSpacing: "0.1em" }}>{d.ts}</span>
                      <span
                        className="font-mono text-[10px] uppercase"
                        style={{ letterSpacing: "0.18em", color: d.stage === "DECISION" ? "#00FF88" : "#00E7FF" }}
                      >
                        {d.stage}
                      </span>
                    </div>
                    <div className="text-white text-sm mt-1">{d.subject}</div>
                    <div className="text-white/55 text-[11px] mt-0.5">{d.message}</div>
                    <div className="mt-2 h-px bg-white/10 relative">
                      <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${d.conf * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Sparkline({ data, highlight }: { data: number[]; highlight?: boolean }) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 90;
  const h = 28;
  const step = w / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={highlight ? "#00E7FF" : "rgba(255,255,255,0.4)"}
        strokeWidth="1.2"
      />
      {data.map((v, i) =>
        i >= data.length - 5 ? (
          <circle
            key={i}
            cx={i * step}
            cy={h - ((v - min) / range) * h}
            r="1.4"
            fill={highlight ? "#00E7FF" : "rgba(255,255,255,0.6)"}
          />
        ) : null,
      )}
    </svg>
  );
}
