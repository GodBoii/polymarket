"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Kicker from "../primitives/Kicker";
import Hairline from "../primitives/Hairline";
import MonoLabel from "../primitives/MonoLabel";
import { REASONING_LAYERS } from "../data/reasoningLayers";

const STEPS = [
  { id: "research",  label: "RESEARCH",  num: "01" },
  { id: "reasoning", label: "REASONING", num: "02" },
  { id: "decision",  label: "DECISION",  num: "03" },
];

export default function ForecastEngine() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  const [sources, setSources] = useState(14287);
  const [decisions, setDecisions] = useState(12481);
  const [prob, setProb] = useState(0.18);

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      if (v < 0.33) setActive(0);
      else if (v < 0.66) setActive(1);
      else setActive(2);
    });
  }, [scrollYProgress]);

  // Live counters
  useEffect(() => {
    const id = setInterval(() => {
      setSources((s) => s + Math.floor(Math.random() * 4));
      setDecisions((d) => d + 1);
    }, 700);
    return () => clearInterval(id);
  }, []);

  // Probability crystallization during stage 3
  const probDisplay = useTransform(scrollYProgress, [0.66, 0.95], [0.18, 0.24]);
  useEffect(() => {
    const unsub = probDisplay.on("change", (v) => setProb(v));
    return () => unsub();
  }, [probDisplay]);

  return (
    <section
      id="engine"
      ref={sectionRef}
      className="relative w-full bg-ink-950"
      style={{ height: "400vh" }}
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 arena-grid-bg opacity-30" aria-hidden />
        {/* Section number */}
        <div className="absolute top-6 right-6 md:top-8 md:right-10 select-none z-10">
          <MonoLabel tone="faint">02 / 09</MonoLabel>
        </div>
        {/* Vertical stepper on the left */}
        <div className="absolute left-6 md:left-10 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <span
                className="font-mono text-[10px] transition-colors"
                style={{
                  letterSpacing: "0.22em",
                  color: i === active ? "#00E7FF" : "rgba(255,255,255,0.32)",
                }}
              >
                {s.num}
              </span>
              <div className="relative w-12 h-px">
                <div
                  className="absolute inset-0 transition-colors"
                  style={{ background: i === active ? "#00E7FF" : "rgba(255,255,255,0.16)" }}
                />
                <motion.div
                  className="absolute inset-y-0 left-0 bg-accent"
                  initial={false}
                  animate={{ width: i === active ? "100%" : "0%" }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  style={{ boxShadow: "0 0 8px #00E7FF" }}
                />
              </div>
              <span
                className="font-mono text-[11px] uppercase transition-colors"
                style={{
                  letterSpacing: "0.18em",
                  color: i === active ? "#ffffff" : "rgba(255,255,255,0.32)",
                }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        <div className="relative grid grid-cols-12 gap-8 page-x h-full pt-24 pb-12">
          {/* Left column — text */}
          <div className="col-span-12 md:col-span-5 flex flex-col justify-center">
            {REASONING_LAYERS.map((layer, i) => (
              <motion.div
                key={layer.id}
                initial={false}
                animate={{ opacity: i === active ? 1 : 0.18, y: i === active ? 0 : 16 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="absolute max-w-md"
                style={{ pointerEvents: i === active ? "auto" : "none" }}
              >
                <Kicker index={layer.index}>{layer.title}</Kicker>
                <h3
                  className="arena-display text-white mt-5"
                  style={{ fontSize: "clamp(40px, 5.5vw, 80px)" }}
                >
                  {i === 0 && "We read fourteen sources per second."}
                  {i === 1 && "Three models. One debate. One probability."}
                  {i === 2 && "One number. Auditable. Signed. Published."}
                </h3>
                <p className="mt-6 text-white/55 text-base leading-relaxed">{layer.sub}</p>
                <div className="mt-8 space-y-2">
                  {layer.items.map((it) => (
                    <div key={it.code} className="flex items-center justify-between py-2 border-b border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        <MonoLabel tone="faint">{it.code}</MonoLabel>
                        <span className="text-white/85 text-sm">{it.label}</span>
                      </div>
                      <span
                        className="font-mono text-[10px] uppercase"
                        style={{
                          letterSpacing: "0.18em",
                          color: it.status === "LIVE" ? "#00FF88" : it.status === "READY" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.32)",
                        }}
                      >
                        {it.status}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right column — visualization */}
          <div className="col-span-12 md:col-span-7 flex flex-col justify-center">
            {/* Stage 0: research stream */}
            {active === 0 && (
              <motion.div
                key="r"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="arena-card p-6 h-[60vh] flex flex-col"
              >
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
                    <div
                      key={i}
                      className="text-white/70"
                      style={{ animation: `arena-word-rise 0.6s ${i * 0.08}s cubic-bezier(0.22,1,0.36,1) backwards` }}
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <Hairline className="my-4" />
                <div className="flex items-center justify-between">
                  <MonoLabel>Sources ingested</MonoLabel>
                  <span className="arena-num text-2xl text-white tabular-nums">{sources.toLocaleString()}</span>
                </div>
              </motion.div>
            )}

            {/* Stage 1: reasoning trace */}
            {active === 1 && (
              <motion.div
                key="x"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="arena-card p-6 h-[60vh] flex flex-col"
              >
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
              </motion.div>
            )}

            {/* Stage 2: crystallized probability */}
            {active === 2 && (
              <motion.div
                key="d"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="arena-card p-8 h-[60vh] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <MonoLabel tone="accent">D-00 · PUBLISHED PROBABILITY</MonoLabel>
                  <MonoLabel tone="faint">live</MonoLabel>
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="flex items-baseline gap-4">
                    <span
                      className="arena-display text-white"
                      style={{ fontSize: "clamp(96px, 14vw, 220px)", letterSpacing: "-0.06em", lineHeight: 0.9 }}
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
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-accent"
                      style={{ boxShadow: "0 0 12px #00E7FF" }}
                      animate={{ width: `${(prob / 0.5) * 100}%` }}
                      transition={{ duration: 0.4 }}
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
                    <div className="text-white mt-1 text-sm">France vs Argentina · QF · Win probability 0.24</div>
                  </div>
                  <div className="text-right">
                    <MonoLabel>Confidence</MonoLabel>
                    <div className="text-accent mt-1 text-sm font-mono">91%</div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
