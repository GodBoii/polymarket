"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Brain, ChevronRight, Sparkles, Terminal } from "lucide-react";

type Factor = {
  id: string;
  label: string;
  impact: number; // -1..1
  confidence: number; // 0..1
  detail: string;
};

const REASONS: Record<string, Factor[]> = {
  "Why did France move from 18% to 22%?": [
    { id: "squad", label: "Squad depth", impact: 0.42, confidence: 0.91, detail: "Bench quality re-rated +0.6σ after return of Tchouaméni and Koundé to full training." },
    { id: "injuries", label: "Injury concerns resolved", impact: 0.31, confidence: 0.88, detail: "Mbappé ankle knock cleared by medical staff at 14:02 GMT. Player trained at full intensity." },
    { id: "sentiment", label: "Market sentiment", impact: 0.18, confidence: 0.74, detail: "1.4M mentions in last 12h. Polarity shifted from 0.18 → 0.31." },
    { id: "sim", label: "Simulation confidence", impact: 0.09, confidence: 0.62, detail: "10,000 Monte Carlo runs converged on tighter win interval (0.49 – 0.58)." },
  ],
  "Will Brazil win the World Cup?": [
    { id: "squad", label: "Squad depth", impact: 0.36, confidence: 0.93, detail: "Deepest attacking roster in the tournament per FBref. Vinícius, Rodrygo, Endrick all rotating cleanly." },
    { id: "draw", label: "Bracket path", impact: 0.21, confidence: 0.78, detail: "Avoided France and England in projected semifinal slot. Probability of easier QF: 64%." },
    { id: "home", label: "Travel & altitude", impact: 0.08, confidence: 0.65, detail: "Squad has spent 14 days acclimatising in São Paulo before relocating." },
    { id: "form", label: "Recent form", impact: 0.14, confidence: 0.71, detail: "5-match xG differential of +2.4. Defensive duels won: 58%." },
  ],
  "Will England reach the semifinals?": [
    { id: "squad", label: "Squad depth", impact: 0.22, confidence: 0.82, detail: "Bellingham-Saka-Foden triangle producing 0.71 xG/90 over last 8 matches." },
    { id: "set", label: "Set piece threat", impact: 0.19, confidence: 0.86, detail: "8 set-piece goals this tournament. Top 1 in conversion rate." },
    { id: "gk", label: "Goalkeeper form", impact: 0.14, confidence: 0.79, detail: "Pickford save rate 84%. Above expected by +0.18." },
    { id: "draw", label: "Bracket difficulty", impact: -0.16, confidence: 0.68, detail: "Likely QF opponent: France. Semifinal opponent: Argentina/Brazil." },
  ],
};

const SUGGESTIONS = [
  "Why did France move from 18% to 22%?",
  "Will Brazil win the World Cup?",
  "Will England reach the semifinals?",
];

const TRACE = [
  "[ORACLE.forecaster v3.1] Resolving market context…",
  "→ Loaded 14,287 historical snapshots for {team: France, tournament: World Cup}",
  "→ Detected anomaly in last 24h: probability Δ = +4.2%",
  "→ Activating reason graph (4 factors, 0 contradictions)",
  "→ Running factor attribution…",
];

export default function AIForecaster() {
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [activeFactors, setActiveFactors] = useState<Factor[]>([]);
  const [traceLines, setTraceLines] = useState<string[]>([]);
  const [executed, setExecuted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  const run = (q: string) => {
    setQuestion(q);
    setActiveFactors([]);
    setTraceLines([]);
    setExecuted(false);
    setThinking(true);
    const factors = REASONS[q] || REASONS["Why did France move from 18% to 22%?"];
    let cancelled = false;
    // Stream trace lines
    TRACE.forEach((line, i) => {
      setTimeout(() => {
        if (cancelled) return;
        setTraceLines((prev) => [...prev, line]);
      }, 300 * i);
    });
    // Then reveal factors one by one
    setTimeout(() => {
      setExecuted(true);
      factors.forEach((f, i) => {
        setTimeout(() => {
          if (cancelled) return;
          setActiveFactors((prev) => [...prev, f]);
        }, 700 * (i + 1));
      });
      setTimeout(() => {
        if (cancelled) return;
        setThinking(false);
      }, 700 * (factors.length + 1) + 400);
    }, 300 * TRACE.length + 200);
    return () => {
      cancelled = true;
    };
  };

  return (
    <section className="relative w-full bg-ink-950 py-24 md:py-40">
      <div className="page-x">
        <div className="grid grid-cols-12 gap-8 mb-12">
          <div className="col-span-12 md:col-span-7">
            <div className="kicker mb-6">
              <span className="dot" />
              <span>07 / AI FORECASTER</span>
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
              Mission control <br />
              <span className="text-signal-success">for belief.</span>
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 md:col-start-9 self-end">
            <p className="text-white/55 text-lg leading-relaxed">
              Ask ORACLE why anything moved. It reads the same signals the market sees, and explains the move in plain language.
            </p>
          </div>
        </div>

        {/* Console */}
        <div className="border border-white/8 bg-[#04070a]">
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Terminal size={12} className="text-white/40" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">ORACLE.forecaster</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-widest text-white/40">
              <span>v3.1</span>
              <span className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${thinking ? "bg-signal-warning animate-pulse-soft" : "bg-signal-success"}`} />
                {thinking ? "Computing" : "Ready"}
              </span>
            </div>
          </div>

          {/* Trace */}
          <div ref={streamRef} className="px-5 py-4 font-mono text-xs space-y-1 max-h-44 overflow-hidden border-b border-white/8">
            {traceLines.map((l, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className={l.startsWith("→") ? "text-white/60" : "text-accent"}
              >
                {l}
              </motion.div>
            ))}
            {thinking && (
              <div className="text-white/40 animate-pulse">▊</div>
            )}
          </div>

          {/* Active question + factors */}
          <div className="p-5 md:p-8 min-h-[280px]">
            <AnimatePresence mode="wait">
              {!executed ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-white/40 text-sm"
                >
                  Awaiting query. Try a suggested prompt below or type your own.
                </motion.div>
              ) : (
                <motion.div
                  key="q"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-start gap-3 mb-6">
                    <div className="h-6 w-6 rounded-full bg-white/8 flex items-center justify-center shrink-0">
                      <Sparkles size={12} className="text-accent" />
                    </div>
                    <div className="text-white text-lg font-display" style={{ letterSpacing: "-0.01em" }}>
                      {question}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {activeFactors.map((f) => {
                      const positive = f.impact >= 0;
                      return (
                        <motion.div
                          key={f.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="grid grid-cols-12 items-center gap-4 border-t border-white/8 pt-3"
                        >
                          <div className="col-span-12 md:col-span-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/55">
                            <Brain size={12} className="text-accent" />
                            {f.label}
                          </div>
                          <div className="col-span-12 md:col-span-6">
                            <div className="h-1 bg-white/8 relative">
                              <motion.div
                                className="absolute inset-y-0"
                                style={{
                                  background: positive ? "#00FF88" : "#FF5577",
                                  boxShadow: `0 0 8px ${positive ? "#00FF88" : "#FF5577"}`,
                                }}
                                initial={{ width: 0, left: positive ? "50%" : "auto", right: positive ? "auto" : "50%" }}
                                animate={{
                                  width: `${Math.abs(f.impact) * 50}%`,
                                  ...(positive ? { left: "50%" } : { right: "50%" }),
                                }}
                                transition={{ duration: 0.6 }}
                              />
                              <div className="absolute inset-y-0 left-1/2 w-px bg-white/15" />
                            </div>
                          </div>
                          <div className="col-span-6 md:col-span-2 num-display text-sm" style={{ color: positive ? "#00FF88" : "#FF5577", letterSpacing: "-0.01em" }}>
                            {positive ? "+" : ""}{(f.impact * 100).toFixed(1)}% impact
                          </div>
                          <div className="col-span-6 md:col-span-1 text-right font-mono text-[10px] text-white/40">
                            {Math.round(f.confidence * 100)}%
                          </div>
                        </motion.div>
                      );
                    })}
                    {activeFactors.length > 0 && activeFactors.length < 4 && (
                      <div className="font-mono text-[10px] uppercase tracking-widest text-white/30 animate-pulse">▊ computing next factor</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input */}
          <div className="border-t border-white/8 p-4">
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && question.trim()) run(question);
                }}
                placeholder="Ask ORACLE.forecaster…"
                className="flex-1 bg-transparent outline-none text-white placeholder-white/30 font-mono text-sm"
              />
              <button
                onClick={() => question.trim() && run(question)}
                disabled={!question.trim()}
                className="h-8 w-8 rounded-full bg-accent text-ink-950 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ boxShadow: "0 0 20px rgba(0,229,255,0.4)" }}
              >
                <ArrowUp size={14} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => run(s)}
                  className="group flex items-center gap-1.5 px-3 py-1.5 border border-white/8 hover:border-white/20 rounded-full text-[11px] font-mono text-white/55 hover:text-white transition-colors"
                >
                  {s}
                  <ChevronRight size={11} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
