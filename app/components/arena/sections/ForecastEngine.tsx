"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Kicker from "../primitives/Kicker";
import Hairline from "../primitives/Hairline";
import MonoLabel from "../primitives/MonoLabel";
import { REASONING_LAYERS } from "../data/reasoningLayers";

export default function ForecastEngine() {
  const [sources, setSources] = useState(14287);
  const [decisions, setDecisions] = useState(12481);
  const [prob, setProb] = useState(0.18);

  // Live counters
  useEffect(() => {
    const id = setInterval(() => {
      setSources((s) => s + Math.floor(Math.random() * 4));
      setDecisions((d) => d + 1);
    }, 700);
    return () => clearInterval(id);
  }, []);

  // Slowly animate prob
  useEffect(() => {
    const id = setInterval(() => {
      setProb((p) => {
        const next = p + 0.001;
        return next >= 0.26 ? 0.18 : next;
      });
    }, 150);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      id="engine"
      className="relative w-full bg-ink-950 py-24 md:py-36"
    >
      <div className="absolute inset-0 arena-grid-bg opacity-30" aria-hidden />
      <div className="absolute top-6 right-6 md:top-8 md:right-10 select-none z-10">
        <MonoLabel tone="faint">02 / 09</MonoLabel>
      </div>

      <div className="relative page-x">
        <Kicker index="02">THE FORECAST ENGINE</Kicker>
        <div className="mt-6 grid grid-cols-12 gap-6 items-end mb-20">
          <h2
            className="col-span-12 lg:col-span-8 arena-display text-white"
            style={{ fontSize: "clamp(48px, 7vw, 120px)" }}
          >
            Three stages.<br />One probability.
          </h2>
          <div className="col-span-12 lg:col-span-4">
            <p className="text-white/55 text-base leading-relaxed">
              Every forecast runs through a three-layer pipeline. Research feeds reasoning. Reasoning produces a decision. Every step is logged.
            </p>
          </div>
        </div>

        {/* Step 01 — Research */}
        <StepPanel index={0} step="01" label="RESEARCH">
          <ResearchViz sources={sources} />
        </StepPanel>

        {/* Step 02 — Reasoning */}
        <StepPanel index={1} step="02" label="REASONING">
          <ReasoningViz decisions={decisions} />
        </StepPanel>

        {/* Step 03 — Decision */}
        <StepPanel index={2} step="03" label="DECISION">
          <DecisionViz prob={prob} />
        </StepPanel>
      </div>
    </section>
  );
}

/* ====================== STEP PANEL ====================== */

function StepPanel({
  index,
  step,
  label,
  children,
}: {
  index: number;
  step: string;
  label: string;
  children: React.ReactNode;
}) {
  const layer = REASONING_LAYERS[index];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: index * 0.15 }}
      className="mb-6 arena-card overflow-hidden"
    >
      {/* Top bar */}
      <div className="flex items-center gap-4 px-8 py-4 border-b border-white/[0.06]">
        <span
          className="font-mono text-accent"
          style={{ fontSize: "11px", letterSpacing: "0.22em" }}
        >
          {step}
        </span>
        <div className="w-10 h-px" style={{ background: "#00E7FF", boxShadow: "0 0 6px #00E7FF" }} />
        <span
          className="font-mono text-white uppercase"
          style={{ fontSize: "11px", letterSpacing: "0.18em" }}
        >
          {label}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" style={{ boxShadow: "0 0 6px #00E7FF" }} />
          <MonoLabel tone="accent">LIVE</MonoLabel>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-12 gap-0">
        {/* Left: text */}
        <div className="col-span-12 md:col-span-5 p-8 flex flex-col border-b md:border-b-0 md:border-r border-white/[0.06]">
          <Kicker index={layer.index}>{layer.title}</Kicker>
          <h3
            className="arena-display text-white mt-5"
            style={{ fontSize: "clamp(28px, 3.5vw, 48px)", letterSpacing: "-0.04em", lineHeight: 1.05 }}
          >
            {layer.sub}
          </h3>
          <div className="mt-8 flex-1">
            {layer.items.map((it) => (
              <div
                key={it.code}
                className="flex items-center justify-between py-3 border-b border-white/[0.06] last:border-0"
              >
                <div className="flex items-center gap-3">
                  <MonoLabel tone="faint">{it.code}</MonoLabel>
                  <span className="text-white/85 text-sm">{it.label}</span>
                </div>
                <span
                  className="font-mono text-[10px] uppercase"
                  style={{
                    letterSpacing: "0.18em",
                    color:
                      it.status === "LIVE"
                        ? "#00FF88"
                        : it.status === "READY"
                        ? "rgba(255,255,255,0.55)"
                        : "rgba(255,255,255,0.32)",
                  }}
                >
                  {it.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: visualization */}
        <div className="col-span-12 md:col-span-7 p-8 flex flex-col">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

/* ====================== VISUALIZATIONS ====================== */

function ResearchViz({ sources }: { sources: number }) {
  return (
    <div className="flex flex-col h-full min-h-[320px]">
      <div className="flex items-center justify-between mb-4">
        <MonoLabel tone="accent">R-00 · INGESTION FEED</MonoLabel>
        <MonoLabel tone="faint">live</MonoLabel>
      </div>
      <div className="flex-1 font-mono text-[12px] leading-7 overflow-hidden">
        {[
          "→ 184 wires, 14,287 historical, 1,204 squad files, 412 tactical reports in last 60s.",
          "→ 14,287 historical matches since 2014 indexed (xG, possession, press).",
          "→ 184 active wire pulls, source reliability 0.78 median.",
          "→ 1,204 squad files cross-referenced. Availability window 24h.",
          "→ 412 tactical reports ingested. Asymmetry score 0.31.",
          "→ 182 market sentiment snapshots. Order book depth 0.84.",
          "→ 11 confirmed lineup releases. 4 with partial data.",
          "→ 3 weather signals for upcoming fixtures. Wind 11 km/h baseline.",
          "→ 47 medical bulletins. 6 return-to-play verdicts.",
        ].map((line, i) => (
          <div key={i} className="text-white/70">
            {line}
          </div>
        ))}
      </div>
      <Hairline className="my-4" />
      <div className="flex items-center justify-between">
        <MonoLabel>Sources ingested</MonoLabel>
        <span className="arena-num text-2xl text-white tabular-nums">{sources.toLocaleString()}</span>
      </div>
    </div>
  );
}

function ReasoningViz({ decisions }: { decisions: number }) {
  return (
    <div className="flex flex-col h-full min-h-[320px]">
      <div className="flex items-center justify-between mb-4">
        <MonoLabel tone="accent">X-00 · REASONING TRACE</MonoLabel>
        <MonoLabel tone="faint">live</MonoLabel>
      </div>
      <div className="flex-1 font-mono text-[12px] leading-7 text-white/80 overflow-hidden">
        <div className="text-white/40">14:02:18.421 · BEGIN</div>
        <div className="mt-1">▸ Cross-referencing Mbappé&apos;s recovery timeline against</div>
        <div>  France&apos;s historical 4-3-3 xG output (n=482 matches).</div>
        <div>▸ Model A (LLM-G5): 0.232 win</div>
        <div>▸ Model B (LLM-Q2): 0.218 win</div>
        <div>▸ Model C (LLM-R1): 0.241 win</div>
        <div>▸ Disagreement: 0.023 — within tolerance.</div>
        <div>▸ Monte Carlo (n=10,000). Convergence @ 4,182.</div>
        <div>▸ Win probability: 0.18 → 0.24.</div>
        <div>▸ Confidence interval: 0.21 – 0.27 (95%).</div>
        <div>▸ Counterfactual: with Mbappé 60&apos; only, win 0.21.</div>
        <div className="text-accent mt-1">▸ DECISION READY · Confidence 0.91.</div>
      </div>
      <Hairline className="my-4" />
      <div className="flex items-center justify-between">
        <MonoLabel>Decisions made</MonoLabel>
        <span className="arena-num text-2xl text-white tabular-nums">{decisions.toLocaleString()}</span>
      </div>
    </div>
  );
}

function DecisionViz({ prob }: { prob: number }) {
  return (
    <div className="flex flex-col h-full min-h-[320px] justify-between">
      <div className="flex items-center justify-between">
        <MonoLabel tone="accent">D-00 · PUBLISHED PROBABILITY</MonoLabel>
        <MonoLabel tone="faint">live</MonoLabel>
      </div>
      <div className="flex-1 flex flex-col justify-center py-8">
        <div className="flex items-baseline gap-4">
          <span
            className="arena-display text-white"
            style={{ fontSize: "clamp(72px, 10vw, 160px)", letterSpacing: "-0.06em", lineHeight: 0.9 }}
          >
            {prob.toFixed(2)}
          </span>
          <span
            className="font-mono text-[14px] text-accent"
            style={{ letterSpacing: "0.18em" }}
          >
            P(WIN)
          </span>
        </div>
        <div className="mt-8 h-px bg-white/10 relative overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-accent transition-all duration-300"
            style={{ width: `${(prob / 0.5) * 100}%`, boxShadow: "0 0 12px #00E7FF" }}
          />
        </div>
        <div className="mt-6 flex items-center gap-6 text-white/55 font-mono text-[12px]">
          <span>France 0.50</span>
          <span>Draw 0.25</span>
          <span>Argentina 0.25</span>
        </div>
      </div>
      <div className="arena-glass p-4 flex items-center justify-between">
        <div>
          <MonoLabel>Forecast</MonoLabel>
          <div className="text-white mt-1 text-sm">France vs Argentina · QF · Win probability {prob.toFixed(2)}</div>
        </div>
        <div className="text-right">
          <MonoLabel>Confidence</MonoLabel>
          <div className="text-accent mt-1 text-sm font-mono">91%</div>
        </div>
      </div>
    </div>
  );
}
