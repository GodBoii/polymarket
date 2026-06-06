"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight, Radio } from "lucide-react";
import Kicker from "../primitives/Kicker";
import Hairline from "../primitives/Hairline";
import MonoLabel from "../primitives/MonoLabel";
import SignalDot from "../primitives/SignalDot";
import { AGENT } from "../data/agent";

const HeroCore = dynamic(() => import("../scenes/HeroCore"), { ssr: false });
const PredictionNodeField = dynamic(() => import("../scenes/PredictionNodeField"), { ssr: false });

export default function Hero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Live numbers — driven by requestAnimationFrame so they tick continuously
  const [predictions, setPredictions] = useState(AGENT.predictions);
  const [accuracy, setAccuracy] = useState(AGENT.accuracy);
  const [confidence, setConfidence] = useState(AGENT.confidence);
  const [now, setNow] = useState("");

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      // Predictions tick up
      setPredictions((p) => (p >= 13000 ? AGENT.predictions : p + Math.floor(Math.random() * 2)));
      // Accuracy wiggle ±0.05
      setAccuracy(AGENT.accuracy + Math.sin(t * 0.4) * 0.05);
      // Confidence wiggle ±0.2
      setConfidence(AGENT.confidence + Math.sin(t * 0.7) * 0.2);
      // Time display
      const d = new Date();
      const hh = d.getUTCHours().toString().padStart(2, "0");
      const mm = d.getUTCMinutes().toString().padStart(2, "0");
      const ss = d.getUTCSeconds().toString().padStart(2, "0");
      setNow(`${hh}:${mm}:${ss} UTC`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Mouse parallax
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 20 });
  const sy = useSpring(my, { stiffness: 50, damping: 20 });
  const tx = useTransform(sx, (v) => v * 8);
  const ty = useTransform(sy, (v) => v * 6);

  return (
    <section
      id="hero"
      className="relative w-full overflow-hidden bg-ink-950"
      style={{ minHeight: "100svh" }}
      onMouseMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
        my.set(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
    >
      {/* Subtle grid background */}
      <div className="absolute inset-0 arena-grid-bg opacity-50" aria-hidden />
      {/* Node field canvas — fills hero */}
      <div className="absolute inset-0 z-0">
        {mounted && <PredictionNodeField />}
      </div>

      {/* Vignette top for nav */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32"
        style={{ background: "linear-gradient(180deg, #050505 0%, transparent 100%)" }}
      />

      {/* Top-right tournament status chips */}
      <div className="absolute top-24 right-6 md:top-28 md:right-10 z-20 hidden md:flex flex-col items-end gap-2 select-none">
        <div className="flex items-center gap-3 arena-glass rounded-full px-4 py-2">
          <SignalDot color="#00FF88" size={8} />
          <MonoLabel>Tournament</MonoLabel>
          <span className="font-mono text-[11px] text-white" style={{ letterSpacing: "0.12em" }}>ACTIVE</span>
        </div>
        <div className="flex items-center gap-3 arena-glass rounded-full px-4 py-2">
          <MonoLabel>Current Rank</MonoLabel>
          <span className="font-mono text-[11px] text-white" style={{ letterSpacing: "0.12em" }}>#{AGENT.rank}</span>
        </div>
      </div>

      {/* Center: intelligence core */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="relative w-[min(80vw,720px)] h-[min(80vw,720px)]">
          {mounted && <HeroCore />}
        </div>
      </div>

      {/* Foreground content */}
      <div className="relative z-20 page-x pt-32 md:pt-40 lg:pt-48 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl pointer-events-auto"
          style={{ x: tx, y: ty }}
        >
          <Kicker index="00 / MISSION">WE DON'T GUESS</Kicker>

          <h1
            className="arena-display text-white mt-6"
            style={{
              fontSize: "clamp(7rem, 12vw, 16rem)",
            }}
          >
            WE&nbsp;DON&apos;T<br />
            <span className="text-white">GUESS.</span><br />
            <span className="text-accent">WE&nbsp;FORECAST.</span>
          </h1>

          <p
            className="mt-8 max-w-xl text-white/55 text-base md:text-lg leading-relaxed"
          >
            Competing in the Stair AI Arena to prove that autonomous intelligence can outperform the crowd. Every probability is auditable. Every decision stands on its reasoning.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3 pointer-events-auto">
            <a href="#intelligence" className="btn btn-primary">
              View Live Predictions
              <ArrowUpRight size={16} />
            </a>
            <a href="#leaderboard" className="btn btn-ghost">
              <Radio size={14} />
              Explore Tournament Rank
            </a>
          </div>
        </motion.div>
      </div>

      {/* Bottom: floating tournament status glass panel */}
      <div className="absolute z-30 bottom-8 right-6 md:bottom-10 md:right-10 hidden md:block">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="arena-glass rounded-md w-[320px] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SignalDot color="#00FF88" size={8} />
              <MonoLabel>Tournament Status</MonoLabel>
            </div>
            <MonoLabel tone="faint">{now}</MonoLabel>
          </div>
          <Hairline className="mb-2" />
          <StatusRow label="Tournament" value="ACTIVE" dot="#00FF88" />
          <Hairline />
          <StatusRow label="Current Rank" value={`#${AGENT.rank}`} />
          <Hairline />
          <StatusRow label="Predictions" value={predictions.toLocaleString()} />
          <Hairline />
          <StatusRow label="Accuracy" value={`${accuracy.toFixed(2)}%`} />
          <Hairline />
          <StatusRow label="Confidence" value={`${confidence.toFixed(0)}%`} />
          <Hairline />
          <div className="flex items-center justify-between py-2">
            <MonoLabel>Updated</MonoLabel>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="font-mono text-[11px] text-accent" style={{ letterSpacing: "0.12em" }}>LIVE</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom: thin live progress bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 h-px bg-white/[0.06]">
        <div
          className="h-full bg-accent"
          style={{
            width: `${((predictions - AGENT.predictions) / (13000 - AGENT.predictions)) * 100}%`,
            boxShadow: "0 0 12px #00E7FF",
            transition: "width 600ms linear",
          }}
        />
      </div>
    </section>
  );
}

function StatusRow({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <MonoLabel>{label}</MonoLabel>
      <div className="flex items-center gap-2">
        {dot && <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />}
        <span className="font-mono text-sm text-white tabular-nums">{value}</span>
      </div>
    </div>
  );
}
