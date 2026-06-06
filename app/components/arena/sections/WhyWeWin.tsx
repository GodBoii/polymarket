"use client";

import { useEffect, useState } from "react";
import { Search, MessagesSquare, LineChart, Trophy, Sigma } from "lucide-react";
import Kicker from "../primitives/Kicker";
import Hairline from "../primitives/Hairline";
import MonoLabel from "../primitives/MonoLabel";

const EDGES = [
  {
    code: "EDGE-01",
    Icon: Search,
    title: "Research Intelligence",
    body: "Fourteen sources, weighted by reliability, ingested per second. The model knows what the model is reading — and what it isn't.",
    proof: "+1.4%",
    proofLabel: "vs consensus",
  },
  {
    code: "EDGE-02",
    Icon: MessagesSquare,
    title: "Multi-Agent Debate",
    body: "Three independent models. Disagreement is logged, not smoothed. The final probability is the reasoned aggregate of the disagreement.",
    proof: "0.018",
    proofLabel: "calibration error",
  },
  {
    code: "EDGE-03",
    Icon: LineChart,
    title: "Market Analysis",
    body: "412 order-book snapshots per minute. We don't follow the market — we measure it. Edge is surfaced, not inferred.",
    proof: "n=10,000",
    proofLabel: "Monte Carlo / decision",
  },
  {
    code: "EDGE-04",
    Icon: Trophy,
    title: "Sports Knowledge",
    body: "14,287 historical matches indexed. xG, possession, press intensity, tactical asymmetry. The model has watched the game.",
    proof: ">87%",
    proofLabel: "median confidence",
  },
  {
    code: "EDGE-05",
    Icon: Sigma,
    title: "Probability Optimization",
    body: "Every published probability carries a confidence interval. We publish the band, not the point. No false precision.",
    proof: "97.4%",
    proofLabel: "reasoning coverage",
  },
];

export default function WhyWeWin() {
  const [pinned, setPinned] = useState(true);

  // Release the pinned headline after the user scrolls past the first viewport
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onScroll = () => {
      const el = document.getElementById("edge");
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      setPinned(r.top > -vh * 0.3);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section id="edge" className="relative w-full bg-ink-950 overflow-hidden">
      <div className="absolute top-6 right-6 md:top-8 md:right-10 select-none z-10">
        <MonoLabel tone="faint">06 / 09</MonoLabel>
      </div>

      {/* Pinned headline — released by scroll */}
      <div className="relative" style={{ height: "200vh" }}>
        <div
          className="sticky top-0 h-screen flex items-center"
          style={{
            transform: pinned ? "scale(1)" : "scale(0.86)",
            transition: "transform 800ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div className="page-x w-full">
            <Kicker index="06">EDGE</Kicker>
            <h2
              className="arena-display text-white mt-6 max-w-6xl"
              style={{
                fontSize: "clamp(56px, 9vw, 160px)",
                letterSpacing: "-0.04em",
                lineHeight: 0.95,
              }}
            >
              <Word delay={0}>Our</Word> <Word delay={80}>edge</Word> <Word delay={160}>is</Word> <Word delay={240}>not</Word> <Word delay={320}>data.</Word>
              <br />
              <Word delay={500} muted>Everyone</Word> <Word delay={580} muted>has</Word> <Word delay={660} muted>data.</Word>
              <br />
              <Word delay={820} muted>Our</Word> <Word delay={900} muted>edge</Word> <Word delay={980} muted>is</Word>{" "}
              <Word delay={1060} accent>reasoning.</Word>
            </h2>
          </div>
        </div>
      </div>

      {/* Edge cards */}
      <div className="relative page-x py-24 md:py-36">
        <Kicker index="06 / B">THE FIVE EDGES</Kicker>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-4">
          {EDGES.slice(0, 3).map((e) => (
            <EdgeCard key={e.code} e={e} span="md:col-span-2" />
          ))}
          {EDGES.slice(3).map((e) => (
            <EdgeCard key={e.code} e={e} span="md:col-span-3" />
          ))}
        </div>

        <p className="mt-16 text-white/55 text-base md:text-lg max-w-3xl leading-relaxed">
          Five edges. One model. One published probability per second. We invite you to compare.
        </p>
      </div>
    </section>
  );
}

function Word({ children, delay = 0, muted, accent }: { children: React.ReactNode; delay?: number; muted?: boolean; accent?: boolean }) {
  return (
    <span
      className="arena-word"
      style={{
        animationDelay: `${delay}ms`,
        color: accent ? "#00E7FF" : muted ? "rgba(255,255,255,0.55)" : "#ffffff",
        marginRight: "0.18em",
      }}
    >
      {children}
    </span>
  );
}

type Edge = (typeof EDGES)[number];

function EdgeCard({ e, span }: { e: Edge; span: string }) {
  return (
    <div className={`col-span-12 ${span} arena-card p-8 flex flex-col`}>
      <MonoLabel tone="accent">{e.code}</MonoLabel>
      <e.Icon className="mt-6 text-white/70" size={36} strokeWidth={1.2} />
      <h3
        className="font-display text-white mt-6"
        style={{ fontSize: "clamp(24px, 2.2vw, 32px)", letterSpacing: "-0.02em", fontWeight: 500, lineHeight: 1.1 }}
      >
        {e.title}
      </h3>
      <p className="mt-4 text-white/55 text-sm leading-relaxed flex-1">{e.body}</p>
      <Hairline className="my-6" />
      <div className="flex items-baseline justify-between">
        <span
          className="font-display text-accent"
          style={{ fontSize: "clamp(28px, 2.6vw, 40px)", letterSpacing: "-0.04em", fontWeight: 500, lineHeight: 1 }}
        >
          {e.proof}
        </span>
        <MonoLabel tone="faint">{e.proofLabel}</MonoLabel>
      </div>
    </div>
  );
}
