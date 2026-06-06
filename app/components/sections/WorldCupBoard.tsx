"use client";

import { motion, useInView, useMotionValue, useSpring, useTransform, animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Team = {
  country: string;
  flag: string; // unicode flag
  probability: number;
  delta: number;
  volume: string;
  region: string;
  tone: "accent" | "success" | "warning" | "neutral";
};

const TEAMS: Team[] = [
  { country: "Brazil", flag: "🇧🇷", probability: 23, delta: +0.4, volume: "$48.2M", region: "South America", tone: "accent" },
  { country: "Argentina", flag: "🇦🇷", probability: 18, delta: -0.2, volume: "$41.7M", region: "South America", tone: "accent" },
  { country: "France", flag: "🇫🇷", probability: 16, delta: +0.7, volume: "$36.9M", region: "Europe", tone: "success" },
  { country: "England", flag: "🏴", probability: 14, delta: +0.6, volume: "$28.1M", region: "Europe", tone: "warning" },
  { country: "Spain", flag: "🇪🇸", probability: 10, delta: -0.1, volume: "$22.4M", region: "Europe", tone: "warning" },
  { country: "Germany", flag: "🇩🇪", probability: 8, delta: +0.1, volume: "$18.6M", region: "Europe", tone: "warning" },
  { country: "Netherlands", flag: "🇳🇱", probability: 6, delta: -0.2, volume: "$11.3M", region: "Europe", tone: "neutral" },
  { country: "Portugal", flag: "🇵🇹", probability: 5, delta: +0.3, volume: "$9.8M", region: "Europe", tone: "neutral" },
];

function ProbBar({ team, index, total }: { team: Team; index: number; total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [pct, setPct] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, team.probability, {
      duration: 1.6,
      delay: index * 0.06,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setPct(v),
    });
    return () => controls.stop();
  }, [inView, team.probability, index]);

  // Live wiggle after initial draw
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => {
      setPct((cur) => {
        const next = cur + (Math.random() - 0.5) * 0.18;
        return Math.max(0.1, Math.min(99, next));
      });
    }, 1800);
    return () => clearInterval(id);
  }, [inView]);

  const toneColor =
    team.tone === "success" ? "#00FF88" :
    team.tone === "warning" ? "#FFD166" :
    team.tone === "accent" ? "#00E5FF" :
    "rgba(255,255,255,0.4)";

  return (
    <div ref={ref} className="grid grid-cols-12 items-center gap-4 py-5 group" style={{ borderTop: index === 0 ? "none" : "1px solid rgba(255,255,255,0.06)" }}>
      <div className="col-span-1 font-mono text-xs text-white/40 tabular">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="col-span-3 flex items-center gap-3">
        <span className="text-2xl leading-none">{team.flag}</span>
        <div>
          <div className="text-white text-lg md:text-xl font-display tracking-tight">{team.country}</div>
          <div className="text-[11px] font-mono text-white/40 uppercase tracking-widest">{team.region}</div>
        </div>
      </div>
      <div className="col-span-6 relative h-9 flex items-center">
        {/* Track */}
        <div className="absolute inset-x-0 h-px bg-white/10" />
        {/* Bar */}
        <motion.div
          className="relative h-9 rounded-sm overflow-hidden"
          style={{
            width: `${pct * 3.2}%`,
            maxWidth: "100%",
            background: `linear-gradient(90deg, ${toneColor}55 0%, ${toneColor}cc 100%)`,
            boxShadow: `0 0 28px ${toneColor}33`,
          }}
        >
          {/* Animated overlay stripe */}
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background: `repeating-linear-gradient(135deg, ${toneColor}22 0 12px, transparent 12px 24px)`,
              animation: "shimmer 6s linear infinite",
            }}
          />
          {/* Live pulse marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 right-0 h-12 w-px"
            style={{ background: toneColor, boxShadow: `0 0 12px ${toneColor}` }}
          />
        </motion.div>
        {/* Probability value far right */}
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full pl-3 hidden md:block">
          <span className="num-display text-white text-2xl" style={{ letterSpacing: "-0.02em" }}>
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="col-span-2 flex flex-col items-end">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">Volume</span>
        <span className="font-mono text-xs text-white/70 tabular">{team.volume}</span>
      </div>
    </div>
  );
}

export default function WorldCupBoard() {
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPulse((p) => p + 1), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="markets" className="relative w-full bg-ink-950 py-24 md:py-40">
      <div className="page-x">
        <div className="grid grid-cols-12 gap-8 mb-16">
          <div className="col-span-12 md:col-span-5">
            <div className="kicker mb-6">
              <span className="dot" />
              <span>02 / LIVE MARKETS</span>
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
              The World Cup <br />
              <span className="text-accent">belief index.</span>
            </h2>
          </div>
          <div className="col-span-12 md:col-span-6 md:col-start-7 self-end">
            <p className="text-white/55 text-lg max-w-md leading-relaxed">
              Every four years, billions of predictions converge on a single tournament. We render that convergence as it happens — bar by bar, percentage by percentage.
            </p>
            <div className="mt-6 flex items-center gap-6 font-mono text-[11px] uppercase tracking-widest text-white/40">
              <span className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse-soft" />
                <span>Updating · 1.8s interval</span>
              </span>
              <span>$184.2M open interest</span>
            </div>
          </div>
        </div>

        {/* The board itself — full bleed, no card */}
        <div className="relative">
          {/* Header row */}
          <div className="grid grid-cols-12 items-center gap-4 pb-3 border-b border-white/10">
            <div className="col-span-1 font-mono text-[10px] uppercase tracking-widest text-white/40">#</div>
            <div className="col-span-3 font-mono text-[10px] uppercase tracking-widest text-white/40">Team</div>
            <div className="col-span-6 font-mono text-[10px] uppercase tracking-widest text-white/40">Live probability</div>
            <div className="col-span-2 font-mono text-[10px] uppercase tracking-widest text-white/40 text-right">Volume</div>
          </div>
          {TEAMS.map((t, i) => (
            <ProbBar key={t.country} team={t} index={i} total={TEAMS.length} />
          ))}
          {/* Footer total */}
          <div className="grid grid-cols-12 items-center gap-4 py-4 border-t border-white/10 mt-2">
            <div className="col-span-7" />
            <div className="col-span-3 font-mono text-[10px] uppercase tracking-widest text-white/40 text-right">Implied total</div>
            <div className="col-span-2 text-right num-display text-white text-xl">100.0%</div>
          </div>
        </div>
      </div>
    </section>
  );
}
