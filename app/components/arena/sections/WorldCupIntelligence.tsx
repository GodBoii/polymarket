"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Kicker from "../primitives/Kicker";
import Hairline from "../primitives/Hairline";
import MonoLabel from "../primitives/MonoLabel";
import StreamField from "../scenes/StreamField";
import { WC_WINNER, WC_QUALIFICATION, WC_MATCHES } from "../data/wcStreams";

const TABS = [
  { id: "winner",        label: "WINNER" },
  { id: "tournament",    label: "TOURNAMENT" },
  { id: "qualification", label: "QUALIFICATION" },
  { id: "match",         label: "MATCH" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function WorldCupIntelligence() {
  const [tab, setTab] = useState<TabId>("winner");

  return (
    <section id="intelligence" className="relative w-full bg-ink-950 py-24 md:py-36 overflow-hidden">
      <div className="absolute inset-0 arena-grid-bg opacity-25" aria-hidden />
      <div className="absolute top-6 right-6 md:top-8 md:right-10 select-none z-10">
        <MonoLabel tone="faint">03 / 09</MonoLabel>
      </div>

      <div className="relative page-x">
        <Kicker index="03">WORLD CUP INTELLIGENCE</Kicker>
        <div className="mt-6 grid grid-cols-12 gap-6 items-end">
          <h2
            className="col-span-12 lg:col-span-8 arena-display text-white"
            style={{ fontSize: "clamp(48px, 7vw, 120px)" }}
          >
            The tournament,<br />as the model sees it.
          </h2>
          <div className="col-span-12 lg:col-span-4">
            <p className="text-white/55 text-base leading-relaxed">
              Four visualisations. One published probability per market, per minute. No tables, no sportsbook — only the model&apos;s view of the tournament.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-12 flex items-center gap-1 overflow-x-auto arena-scrollbar-hide border-b border-white/[0.06]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative px-4 py-3 text-[11px] font-mono uppercase transition-colors"
              style={{
                letterSpacing: "0.18em",
                color: tab === t.id ? "#ffffff" : "rgba(255,255,255,0.55)",
              }}
            >
              {t.label}
              {tab === t.id && (
                <motion.div
                  layoutId="wc-tab"
                  className="absolute inset-x-3 -bottom-px h-px bg-accent"
                  style={{ boxShadow: "0 0 8px #00E7FF" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-12 min-h-[68vh]">
          <AnimatePresence mode="wait">
            {tab === "winner" && (
              <motion.div key="w" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                <WinnerTab />
              </motion.div>
            )}
            {tab === "tournament" && (
              <motion.div key="t" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                <TournamentTab />
              </motion.div>
            )}
            {tab === "qualification" && (
              <motion.div key="q" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                <QualificationTab />
              </motion.div>
            )}
            {tab === "match" && (
              <motion.div key="m" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                <MatchTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Insight footer */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { tag: "EDGE-01", title: "When a probability moves by 0.6% in 4 minutes, the cause is rarely a single piece of news. It's the interaction of fourteen inputs our layer-2 reasoning cross-references in real time." },
            { tag: "EDGE-02", title: "Our calibration error across 4,182 markets is 0.018. The next-best agent in the Arena is 0.024. A small number, but it compounds." },
            { tag: "EDGE-03", title: "We log every input, every weight, and every counterfactual. The reasoning is the product, not the prediction." },
            { tag: "EDGE-04", title: "We publish only the probabilities we can defend. There is no redaction, no curation, no retroactive narrative." },
          ].map((it) => (
            <div key={it.tag}>
              <Hairline className="mb-4" />
              <MonoLabel tone="accent">{it.tag}</MonoLabel>
              <p className="mt-3 text-white/70 text-sm leading-relaxed">{it.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================== TABS ============================== */

function WinnerTab() {
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8 arena-card relative h-[68vh] overflow-hidden">
        <div className="absolute inset-0">
          <StreamField
            width={1200}
            height={680}
            drops={WC_WINNER.map((t, i) => {
              const angle = (i / WC_WINNER.length) * Math.PI * 2;
              const r = Math.min(1200, 680) * 0.32;
              return {
                x: 600 + Math.cos(angle) * r,
                y: 340 + Math.sin(angle) * r,
                prob: t.winProb / 30,
                hue: "accent",
              };
            })}
          />
        </div>
        <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
          <MonoLabel tone="accent">WINNER · LIVE</MonoLabel>
          <MonoLabel tone="faint">2,481,901 sims / min</MonoLabel>
        </div>
      </div>
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-2">
        {WC_WINNER.map((t) => (
          <div key={t.code} className="arena-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-sm flex items-center justify-center font-mono text-[10px] text-white"
                style={{ background: "rgba(0, 231, 255, 0.08)", border: "1px solid rgba(0, 231, 255, 0.32)" }}
              >
                {t.code}
              </div>
              <div>
                <div className="text-white text-sm" style={{ letterSpacing: "-0.01em" }}>{t.name}</div>
                <MonoLabel tone="faint">{t.confederation}</MonoLabel>
              </div>
            </div>
            <div className="text-right">
              <div className="arena-num text-white text-lg">{t.winProb.toFixed(1)}%</div>
              <div
                className="font-mono text-[10px]"
                style={{ color: t.delta >= 0 ? "#00FF88" : "#FF5959", letterSpacing: "0.04em" }}
              >
                {t.delta > 0 ? "▲" : "▼"} {Math.abs(t.delta).toFixed(1)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TournamentTab() {
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8 arena-card relative h-[68vh] overflow-hidden">
        <BracketTree />
        <div className="absolute top-4 left-4 z-10">
          <MonoLabel tone="accent">REACH · TOURNAMENT TREE</MonoLabel>
        </div>
        <div className="absolute bottom-4 right-4 z-10">
          <MonoLabel tone="faint">2,481,901 sims / min</MonoLabel>
        </div>
      </div>
      <div className="col-span-12 lg:col-span-4 flex flex-col gap-2">
        {WC_WINNER.slice(0, 6).map((t) => (
          <div key={t.code} className="arena-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-sm flex items-center justify-center font-mono text-[10px] text-white"
                  style={{ background: "rgba(0, 231, 255, 0.08)", border: "1px solid rgba(0, 231, 255, 0.32)" }}>
                  {t.code}
                </div>
                <span className="text-white text-sm">{t.name}</span>
              </div>
              <span className="arena-num text-white">{t.winProb.toFixed(1)}%</span>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[
                { label: "R16", v: 100 },
                { label: "QF", v: t.reachQF },
                { label: "SF", v: t.reachSF },
                { label: "F",  v: t.reachF },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-start">
                  <MonoLabel tone="faint">{s.label}</MonoLabel>
                  <div className="h-px w-full bg-white/10 mt-1 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${s.v}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-white/70 mt-1">{s.v}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketTree() {
  const left = ["BRA", "ENG", "ESP"];
  const right = ["FRA", "ARG", "GER"];
  return (
    <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
      {/* Connecting lines */}
      <g stroke="#00E7FF" strokeWidth="0.8" fill="none" opacity="0.4">
        <line x1="220" y1="160" x2="500" y2="300" />
        <line x1="220" y1="300" x2="500" y2="300" />
        <line x1="220" y1="440" x2="500" y2="300" />
        <line x1="780" y1="160" x2="500" y2="300" />
        <line x1="780" y1="300" x2="500" y2="300" />
        <line x1="780" y1="440" x2="500" y2="300" />
      </g>
      {/* Center final */}
      <circle cx="500" cy="300" r="60" fill="rgba(0, 231, 255, 0.05)" stroke="#00E7FF" strokeWidth="1" />
      <text x="500" y="296" textAnchor="middle" fill="#fff" fontSize="10" fontFamily="monospace" letterSpacing="2">FINAL</text>
      <text x="500" y="312" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="monospace">14 JUL · 19:00</text>

      {/* Left nodes */}
      {left.map((c, i) => {
        const team = WC_WINNER.find((t) => t.code === c)!;
        return (
          <g key={c} transform={`translate(120,${130 + i * 140})`}>
            <circle r="44" fill="rgba(255,255,255,0.02)" stroke="rgba(0,231,255,0.4)" strokeWidth="1" />
            <circle r="14" fill="#00E7FF" opacity="0.85" />
            <text y="-60" textAnchor="middle" fill="#fff" fontSize="11" fontFamily="monospace" letterSpacing="1">{c}</text>
            <text y="-46" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="monospace">{team.reachF}% → F</text>
          </g>
        );
      })}
      {/* Right nodes */}
      {right.map((c, i) => {
        const team = WC_WINNER.find((t) => t.code === c)!;
        return (
          <g key={c} transform={`translate(880,${130 + i * 140})`}>
            <circle r="44" fill="rgba(255,255,255,0.02)" stroke="rgba(0,231,255,0.4)" strokeWidth="1" />
            <circle r="14" fill="#00E7FF" opacity="0.85" />
            <text y="-60" textAnchor="middle" fill="#fff" fontSize="11" fontFamily="monospace" letterSpacing="1">{c}</text>
            <text y="-46" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="9" fontFamily="monospace">{team.reachF}% → F</text>
          </g>
        );
      })}
    </svg>
  );
}

function QualificationTab() {
  return (
    <div className="space-y-3">
      {WC_QUALIFICATION.map((lane) => (
        <div key={lane.confederation} className="arena-card p-5">
          <div className="flex items-center justify-between mb-4">
            <MonoLabel tone="accent">{lane.confederation} · {lane.slots} SLOTS</MonoLabel>
            <MonoLabel tone="faint">{lane.teams.length} teams</MonoLabel>
          </div>
          <div className="grid grid-cols-12 gap-2">
            {lane.teams.map((t) => (
              <div key={t.code} className="col-span-6 md:col-span-3 lg:col-span-2 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm font-mono">{t.code}</span>
                  <span
                    className="font-mono text-[10px]"
                    style={{ color: t.delta >= 0 ? "#00FF88" : "#FF5959" }}
                  >
                    {t.delta > 0 ? "▲" : t.delta < 0 ? "▼" : "·"} {Math.abs(t.delta * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1 bg-white/5 mt-2 relative overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${t.prob * 100}%`, boxShadow: "0 0 6px #00E7FF" }} />
                </div>
                <span className="font-mono text-[10px] text-white/70 mt-1">{(t.prob * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {WC_MATCHES.map((m) => (
        <div key={m.id} className="arena-card p-6 flex flex-col items-center">
          <MonoLabel tone="accent">{m.round}</MonoLabel>
          <div className="mt-8 flex items-center justify-center gap-6">
            <TeamOrb prob={m.pHome} code={m.home.code} name={m.home.name} />
            <div className="text-center">
              <div className="font-mono text-[10px] text-white/40" style={{ letterSpacing: "0.18em" }}>VS</div>
              <div className="font-mono text-xs text-accent mt-1">{m.startsIn}</div>
            </div>
            <TeamOrb prob={m.pAway} code={m.away.code} name={m.away.name} />
          </div>
          <div className="mt-8 w-full">
            <Hairline className="mb-2" />
            <div className="flex justify-between py-1">
              <MonoLabel>Draw</MonoLabel>
              <span className="arena-num text-white">{(m.pDraw * 100).toFixed(1)}%</span>
            </div>
            <Hairline className="mb-2" />
            <div className="flex justify-between py-1">
              <MonoLabel>Confidence</MonoLabel>
              <span className="arena-num text-accent">{(m.confidence * 100).toFixed(0)}%</span>
            </div>
            <Hairline />
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamOrb({ prob, code, name }: { prob: number; code: string; name: string }) {
  const r = 30 + prob * 50;
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: r * 2, height: r * 2 }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0, 231, 255, 0.2) 0%, transparent 70%)" }}
        />
        <div
          className="absolute inset-2 rounded-full border"
          style={{ borderColor: "rgba(0, 231, 255, 0.5)" }}
        />
        <div
          className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-white"
          style={{ letterSpacing: "0.06em" }}
        >
          {code}
        </div>
      </div>
      <div className="mt-3 text-white text-sm">{name}</div>
      <div className="arena-num text-accent text-lg">{(prob * 100).toFixed(1)}%</div>
    </div>
  );
}
