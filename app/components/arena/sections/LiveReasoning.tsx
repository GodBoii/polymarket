"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Download } from "lucide-react";
import Kicker from "../primitives/Kicker";
import Hairline from "../primitives/Hairline";
import MonoLabel from "../primitives/MonoLabel";
import { REASONING_SEED, REASONING_TEMPLATES, type ReasoningEntry } from "../data/reasoning";

const VISIBLE_ROWS = 24;
const TICK_MS = 1400;

const STAGE_COLOR: Record<ReasoningEntry["stage"], string> = {
  RESEARCH: "rgba(255,255,255,0.7)",
  REASONING: "#00E7FF",
  DECISION: "#00FF88",
};

function tsAt(d: Date) {
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
}

export default function LiveReasoning() {
  const [entries, setEntries] = useState<ReasoningEntry[]>(() => REASONING_SEED.slice(0, VISIBLE_ROWS));
  const [paused, setPaused] = useState(false);
  const [countdowns, setCountdowns] = useState<number[]>([1200, 3400, 5800, 7900]);
  const tickRef = useRef<number | null>(null);
  const counterRef = useRef<number | null>(null);

  useEffect(() => {
    let i = 0;
    const tick = () => {
      if (!paused) {
        setEntries((prev) => {
          const tpl = REASONING_TEMPLATES[i % REASONING_TEMPLATES.length];
          i += 1;
          const next: ReasoningEntry = {
            ts: tsAt(new Date()),
            stage: tpl.stage,
            subject: tpl.subject,
            message: tpl.message,
            confidence: tpl.confidence,
            delta: tpl.delta,
          };
          const updated = [...prev, next];
          return updated.slice(-VISIBLE_ROWS);
        });
      }
      tickRef.current = window.setTimeout(tick, TICK_MS);
    };
    tickRef.current = window.setTimeout(tick, TICK_MS);
    return () => {
      if (tickRef.current) window.clearTimeout(tickRef.current);
    };
  }, [paused]);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdowns((arr) => arr.map((v) => (v <= 80 ? 1200 + Math.random() * 7000 : v - 80)));
    }, 80);
    counterRef.current && clearInterval(counterRef.current);
    counterRef.current = id as unknown as number;
    return () => clearInterval(id);
  }, []);

  return (
    <section id="reasoning" className="relative w-full bg-ink-950 py-24 md:py-36 overflow-hidden">
      <div className="absolute inset-0 arena-grid-bg opacity-20" aria-hidden />
      <div className="absolute top-6 right-6 md:top-8 md:right-10 select-none z-10">
        <MonoLabel tone="faint">04 / 09</MonoLabel>
      </div>
      <div className="relative page-x">
        <Kicker index="04">LIVE REASONING</Kicker>
        <div className="mt-6 grid grid-cols-12 gap-6 items-end">
          <h2
            className="col-span-12 lg:col-span-8 arena-display text-white"
            style={{ fontSize: "clamp(48px, 7vw, 120px)" }}
          >
            Every move,<br />timestamped.
          </h2>
          <p className="col-span-12 lg:col-span-4 text-white/55 text-base leading-relaxed">
            A real-time record of what changed, why, and how confident we are. No retroactive narrative. No cherry-picking. The reasoning is the product.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-12 gap-6">
          {/* Terminal */}
          <div className="col-span-12 lg:col-span-7 arena-terminal rounded-md overflow-hidden h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full" style={{ background: "#00FF88", boxShadow: "0 0 6px #00FF88" }} />
                <span className="text-white/85 text-[11px] font-mono" style={{ letterSpacing: "0.08em" }}>
                  LIVE · POLY-09 · v3.1.0 · /reasoning/stream · ACTIVE
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaused((p) => !p)}
                  className="flex items-center gap-1.5 text-[10px] font-mono uppercase px-2 py-1 border border-white/10 rounded-sm hover:border-white/20 transition-colors"
                  style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.7)" }}
                >
                  {paused ? <Play size={11} /> : <Pause size={11} />}
                  {paused ? "Resume" : "Pause"}
                </button>
                <button className="flex items-center gap-1.5 text-[10px] font-mono uppercase px-2 py-1 border border-white/10 rounded-sm hover:border-white/20 transition-colors"
                  style={{ letterSpacing: "0.18em", color: "rgba(255,255,255,0.7)" }}
                >
                  <Download size={11} />
                  Export
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-[12px] leading-6">
              {entries.map((e, i) => (
                <div key={i} className="flex items-start gap-3 hover:bg-white/[0.015] py-0.5">
                  <span className="text-white/35 w-[88px] flex-shrink-0">{e.ts}</span>
                  <span style={{ color: STAGE_COLOR[e.stage] }} className="w-[88px] flex-shrink-0 font-mono">
                    ▸ {e.stage}
                  </span>
                  <span className="text-white/55 w-[200px] flex-shrink-0 truncate">{e.subject}</span>
                  <span className="text-white/85 flex-1">
                    {e.message}
                    {e.delta !== undefined && (
                      <span
                        className="ml-2 font-mono"
                        style={{ color: e.delta > 0 ? "#00FF88" : "#FF5959" }}
                      >
                        {e.delta > 0 ? "▲" : "▼"} {Math.abs(e.delta * 100).toFixed(1)}%
                      </span>
                    )}
                  </span>
                  <span className="text-accent w-[44px] flex-shrink-0 text-right tabular-nums">
                    {(e.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-white/35">$</span>
                <span className="arena-caret" />
              </div>
            </div>
          </div>

          {/* Side panels */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
            <div className="arena-card p-5">
              <div className="flex items-center justify-between">
                <MonoLabel tone="accent">RECENT DECISIONS</MonoLabel>
                <MonoLabel tone="faint">3 / 12,481</MonoLabel>
              </div>
              <div className="mt-4 space-y-2">
                {entries.slice(-3).reverse().map((e, i) => (
                  <div key={i} className="arena-glass p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-white/55" style={{ letterSpacing: "0.1em" }}>{e.ts}</span>
                      <span
                        className="font-mono text-[10px] uppercase"
                        style={{ letterSpacing: "0.18em", color: STAGE_COLOR[e.stage] }}
                      >
                        {e.stage}
                      </span>
                    </div>
                    <div className="text-white text-sm mt-1">{e.subject}</div>
                    <div className="text-white/55 text-[11px] mt-0.5 line-clamp-2">{e.message}</div>
                    <div className="mt-2 h-px bg-white/10 relative">
                      <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${e.confidence * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="arena-card p-5">
              <div className="flex items-center justify-between">
                <MonoLabel tone="accent">NEXT REASONING STEPS</MonoLabel>
                <MonoLabel tone="faint">queued</MonoLabel>
              </div>
              <div className="mt-4 space-y-2">
                {[
                  "Resolving England midfield availability",
                  "Cross-check xG differential vs market",
                  "Run Monte Carlo (n=10,000)",
                  "Publish probability update",
                ].map((step, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px]"
                        style={{ background: "rgba(0, 231, 255, 0.08)", color: "#00E7FF", border: "1px solid rgba(0,231,255,0.32)" }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-white/85 text-sm">{step}</span>
                    </div>
                    <span className="font-mono text-[11px] text-white/55 tabular-nums">
                      {(countdowns[i] / 1000).toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="arena-card p-5">
              <div className="flex items-center justify-between">
                <MonoLabel tone="accent">COUNTERFACTUAL</MonoLabel>
                <MonoLabel tone="faint">n=4,182</MonoLabel>
              </div>
              <p className="mt-3 text-white/70 text-sm leading-relaxed">
                &ldquo;If Mbappé plays 60&apos; only, France&apos;s win probability moves from 0.51 to 0.42. Counterfactual is published alongside the headline probability.&rdquo;
              </p>
              <Hairline className="my-3" />
              <div className="flex items-center justify-between">
                <MonoLabel>With</MonoLabel>
                <span className="arena-num text-accent">0.42</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <MonoLabel>Without</MonoLabel>
                <span className="arena-num text-white">0.51</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
