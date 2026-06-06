"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowUpRight, Play } from "lucide-react";
import LiveTicker from "./LiveTicker";

const HeroGlobe = dynamic(() => import("./HeroGlobe"), { ssr: false });

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Mouse parallax for the headline
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18 });
  const sy = useSpring(my, { stiffness: 60, damping: 18 });
  const tx = useTransform(sx, (v) => v * 12);
  const ty = useTransform(sy, (v) => v * 8);

  return (
    <section
      ref={sectionRef}
      className="relative w-full overflow-hidden bg-ink-950"
      style={{ minHeight: "100svh" }}
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
        my.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
    >
      {/* Globe — fills entire hero, sits behind the text on mobile, beside it on desktop */}
      <div className="absolute inset-0 z-0">
        <HeroGlobe />
      </div>

      {/* Soft top gradient for nav legibility */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32"
        style={{ background: "linear-gradient(180deg, #050505 0%, transparent 100%)" }}
      />
      {/* Bottom gradient for ticker legibility */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-48"
        style={{ background: "linear-gradient(0deg, #050505 0%, transparent 100%)" }}
      />

      {/* Headline block — left side, full bleed feel */}
      <div className="relative z-20 page-x pt-32 md:pt-40 lg:pt-48">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
          style={{ x: tx, y: ty }}
        >
          <div className="kicker mb-8">
            <span className="dot" />
            <span>LIVE · GLOBAL PREDICTION MARKETS</span>
          </div>

          <h1
            className="font-display text-white"
            style={{
              fontSize: "clamp(72px, 13vw, 220px)",
              lineHeight: 0.9,
              letterSpacing: "-0.04em",
              fontWeight: 500,
            }}
          >
            ORACLE
          </h1>

          <p
            className="mt-6 max-w-xl font-display text-white/85"
            style={{ fontSize: "clamp(28px, 4vw, 56px)", lineHeight: 1.05, letterSpacing: "-0.02em", fontWeight: 500 }}
          >
            The world's <br className="hidden md:block" />
            <span className="text-accent">forecasting</span> engine.
          </p>

          <p className="mt-6 max-w-md text-base md:text-lg text-white/55 leading-relaxed">
            Trade probabilities on football, global tournaments, and world events using collective intelligence. Real time. Real signal. Real people.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <a className="btn btn-primary" href="#markets">
              Explore Markets
              <ArrowUpRight size={16} />
            </a>
            <a className="btn btn-ghost" href="#rivers">
              <Play size={14} />
              Watch predictions move
            </a>
          </div>
        </motion.div>

        {/* Right side stats block — desktop only, positioned over the globe */}
        <div className="hidden lg:block absolute right-[max(40px,calc((100vw-1480px)/2+40px))] top-1/2 -translate-y-1/2 z-20 w-[320px]">
          <div className="space-y-3">
            <StatCard label="Active markets" value="3,481" trend="+24h" delta="+182" tone="accent" />
            <StatCard label="Open interest" value="$184.2M" trend="24h" delta="+3.1%" tone="success" />
            <StatCard label="Participants" value="2.14M" trend="online" delta="↑ 12k/min" tone="warning" />
          </div>
        </div>
      </div>

      {/* Live ticker pinned to bottom */}
      <div className="absolute inset-x-0 bottom-0 z-30">
        <LiveTicker />
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  trend,
  delta,
  tone,
}: {
  label: string;
  value: string;
  trend: string;
  delta: string;
  tone: "accent" | "success" | "warning";
}) {
  const toneColor =
    tone === "success" ? "#00FF88" : tone === "warning" ? "#FFD166" : "#00E5FF";
  return (
    <div className="bg-black/30 backdrop-blur-md border border-white/10 rounded-md p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="kicker" style={{ color: "rgba(255,255,255,0.55)" }}>
          {label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
          {trend}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className="num-display text-3xl text-white"
          style={{ letterSpacing: "-0.02em" }}
        >
          {value}
        </span>
        <span className="text-xs font-mono" style={{ color: toneColor }}>
          {delta}
        </span>
      </div>
    </div>
  );
}
