"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Node = {
  id: string;
  label: string;
  flag?: string;
  probability: number;
  delta: number;
  history: number[];
};

type Tournament = {
  id: string;
  label: string;
  rounds: { name: string; nodes: Node[] }[];
};

const TOURNAMENTS: Tournament[] = [
  {
    id: "wc",
    label: "World Cup",
    rounds: [
      {
        name: "Quarterfinals",
        nodes: [
          { id: "wc-1", label: "Brazil", flag: "🇧🇷", probability: 23, delta: +0.4, history: [18, 19, 21, 22, 23] },
          { id: "wc-2", label: "Argentina", flag: "🇦🇷", probability: 18, delta: -0.2, history: [14, 15, 17, 19, 18] },
          { id: "wc-3", label: "France", flag: "🇫🇷", probability: 16, delta: +0.7, history: [10, 12, 13, 15, 16] },
          { id: "wc-4", label: "England", flag: "🏴", probability: 14, delta: +0.6, history: [9, 10, 11, 13, 14] },
          { id: "wc-5", label: "Spain", flag: "🇪🇸", probability: 10, delta: -0.1, history: [8, 9, 11, 10, 10] },
          { id: "wc-6", label: "Germany", flag: "🇩🇪", probability: 8, delta: +0.1, history: [6, 7, 8, 8, 8] },
          { id: "wc-7", label: "Netherlands", flag: "🇳🇱", probability: 6, delta: -0.2, history: [5, 6, 7, 6, 6] },
          { id: "wc-8", label: "Portugal", flag: "🇵🇹", probability: 5, delta: +0.3, history: [3, 4, 4, 5, 5] },
        ],
      },
    ],
  },
  {
    id: "ucl",
    label: "Champions League",
    rounds: [
      {
        name: "Round of 16",
        nodes: [
          { id: "ucl-1", label: "Man City", flag: "🏴", probability: 27, delta: +1.1, history: [21, 22, 24, 26, 27] },
          { id: "ucl-2", label: "Real Madrid", flag: "🇪🇸", probability: 22, delta: -0.3, history: [19, 21, 22, 23, 22] },
          { id: "ucl-3", label: "Bayern", flag: "🇩🇪", probability: 18, delta: +0.4, history: [14, 15, 16, 17, 18] },
          { id: "ucl-4", label: "PSG", flag: "🇫🇷", probability: 14, delta: +0.6, history: [10, 11, 12, 13, 14] },
          { id: "ucl-5", label: "Inter", flag: "🇮🇹", probability: 9, delta: -0.2, history: [8, 9, 10, 10, 9] },
          { id: "ucl-6", label: "Arsenal", flag: "🏴", probability: 7, delta: +0.1, history: [5, 5, 6, 7, 7] },
          { id: "ucl-7", label: "Barcelona", flag: "🇪🇸", probability: 2, delta: -0.4, history: [3, 3, 2, 2, 2] },
          { id: "ucl-8", label: "Dortmund", flag: "🇩🇪", probability: 1, delta: +0.0, history: [1, 1, 1, 1, 1] },
        ],
      },
    ],
  },
  {
    id: "epl",
    label: "Premier League",
    rounds: [
      {
        name: "Title race",
        nodes: [
          { id: "epl-1", label: "Arsenal", flag: "🏴", probability: 41, delta: -0.5, history: [38, 40, 42, 42, 41] },
          { id: "epl-2", label: "Man City", flag: "🏴", probability: 38, delta: +0.8, history: [33, 34, 35, 37, 38] },
          { id: "epl-3", label: "Liverpool", flag: "🏴", probability: 17, delta: -0.2, history: [18, 19, 18, 17, 17] },
          { id: "epl-4", label: "Chelsea", flag: "🏴", probability: 3, delta: +0.1, history: [2, 2, 2, 3, 3] },
          { id: "epl-5", label: "Spurs", flag: "🏴", probability: 1, delta: +0.0, history: [1, 1, 1, 1, 1] },
          { id: "epl-6", label: "Newcastle", flag: "🏴", probability: 0, delta: +0.0, history: [0, 0, 0, 0, 0] },
        ],
      },
    ],
  },
  {
    id: "bdor",
    label: "Ballon d'Or",
    rounds: [
      {
        name: "Top 5",
        nodes: [
          { id: "bdor-1", label: "Haaland", flag: "🇳🇴", probability: 34, delta: +0.3, history: [28, 30, 32, 33, 34] },
          { id: "bdor-2", label: "Mbappé", flag: "🇫🇷", probability: 22, delta: +0.8, history: [16, 17, 19, 21, 22] },
          { id: "bdor-3", label: "Vinícius Jr", flag: "🇧🇷", probability: 18, delta: -0.4, history: [16, 17, 19, 18, 18] },
          { id: "bdor-4", label: "Bellingham", flag: "🏴", probability: 14, delta: +0.2, history: [11, 12, 13, 14, 14] },
          { id: "bdor-5", label: "Saka", flag: "🏴", probability: 8, delta: -0.1, history: [7, 8, 8, 8, 8] },
        ],
      },
    ],
  },
];

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 80;
  const h = 22;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const path = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((d - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

export default function TournamentExplorer() {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const t = TOURNAMENTS[active];

  return (
    <section className="relative w-full bg-ink-950 py-24 md:py-40">
      <div className="page-x">
        <div className="grid grid-cols-12 gap-8 mb-12">
          <div className="col-span-12 md:col-span-7">
            <div className="kicker mb-6">
              <span className="dot" />
              <span>06 / TOURNAMENT EXPLORER</span>
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
              Every tournament. <br />
              <span className="text-accent">One map.</span>
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 md:col-start-9 self-end">
            <p className="text-white/55 text-lg leading-relaxed">
              The shape of belief, rendered as a bracket. Each node is a probability. Each line is a market reaction. Hover to expose the history.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-10 border-b border-white/8">
          {TOURNAMENTS.map((tour, i) => (
            <button
              key={tour.id}
              onClick={() => setActive(i)}
              className={`relative px-5 py-3 font-mono text-xs uppercase tracking-widest transition-colors ${
                active === i ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {tour.label}
              {active === i && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute left-0 right-0 -bottom-px h-px bg-accent"
                  style={{ boxShadow: "0 0 8px rgba(0,229,255,0.6)" }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Bracket */}
        <AnimatePresence mode="wait">
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-white/40">
              {t.rounds[0].name}
            </div>
            <div className="space-y-2">
              {t.rounds[0].nodes.map((n) => {
                const positive = n.delta >= 0;
                return (
                  <div
                    key={n.id}
                    onMouseEnter={() => setHovered(n.id)}
                    onMouseLeave={() => setHovered(null)}
                    className="group relative grid grid-cols-12 items-center gap-4 px-4 py-3 border border-white/8 hover:border-white/20 transition-colors cursor-pointer"
                  >
                    <div className="col-span-1 text-2xl">{n.flag}</div>
                    <div className="col-span-4 text-white font-display text-lg" style={{ letterSpacing: "-0.01em" }}>{n.label}</div>
                    <div className="col-span-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
                      {hovered === n.id ? "Last 5 updates" : "Trend"}
                    </div>
                    <div className="col-span-2">
                      <Sparkline data={n.history} color={positive ? "#00FF88" : "#FFD166"} />
                    </div>
                    <div className="col-span-2 text-right num-display text-2xl text-white" style={{ letterSpacing: "-0.02em" }}>
                      {n.probability}%
                    </div>
                    <div className="col-span-1 text-right font-mono text-[11px]" style={{ color: positive ? "#00FF88" : "#FF5577" }}>
                      {positive ? "▲" : "▼"} {Math.abs(n.delta).toFixed(1)}
                    </div>
                    {/* Bottom fill bar */}
                    <div className="absolute inset-x-0 bottom-0 h-px bg-white/4">
                      <div
                        className="h-full transition-all duration-700"
                        style={{
                          width: `${n.probability * 2}%`,
                          maxWidth: "100%",
                          background: positive ? "#00FF88" : "#FFD166",
                          opacity: 0.4,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center gap-4 text-[11px] font-mono uppercase tracking-widest text-white/40">
          <span>Hover any node to reveal the 5-update history.</span>
          <span className="ml-auto">{t.rounds[0].nodes.length} live markets</span>
        </div>
      </div>
    </section>
  );
}
