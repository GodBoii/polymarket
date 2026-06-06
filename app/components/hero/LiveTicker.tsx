"use client";

import { useEffect, useState } from "react";

type Tick = {
  market: string;
  outcome: string;
  probability: number;
  delta: number;
  region: string;
};

const BASE_TICKS: Tick[] = [
  { market: "World Cup Winner", outcome: "Brazil", probability: 23, delta: +0.4, region: "LATAM" },
  { market: "World Cup Winner", outcome: "Argentina", probability: 18, delta: -0.2, region: "EU" },
  { market: "World Cup Winner", outcome: "France", probability: 16, delta: +0.7, region: "EU" },
  { market: "Champions League", outcome: "Man City", probability: 27, delta: +1.1, region: "EU" },
  { market: "Ballon d'Or", outcome: "Haaland", probability: 34, delta: +0.3, region: "EU" },
  { market: "Premier League", outcome: "Arsenal", probability: 41, delta: -0.5, region: "EU" },
  { market: "World Cup Winner", outcome: "England", probability: 14, delta: +0.6, region: "EU" },
  { market: "La Liga", outcome: "Real Madrid", probability: 62, delta: +0.2, region: "EU" },
  { market: "World Cup Winner", outcome: "Spain", probability: 10, delta: -0.1, region: "EU" },
  { market: "Bundesliga", outcome: "Bayern", probability: 73, delta: -0.4, region: "EU" },
  { market: "World Cup Winner", outcome: "Germany", probability: 8, delta: +0.1, region: "EU" },
  { market: "Ballon d'Or", outcome: "Mbappé", probability: 22, delta: +0.8, region: "EU" },
  { market: "Serie A", outcome: "Inter", probability: 48, delta: -0.3, region: "EU" },
  { market: "Ligue 1", outcome: "PSG", probability: 81, delta: +0.0, region: "EU" },
  { market: "World Cup Winner", outcome: "Netherlands", probability: 6, delta: -0.2, region: "EU" },
  { market: "Copa América", outcome: "Uruguay", probability: 12, delta: +0.4, region: "LATAM" },
];

export default function LiveTicker() {
  const [ticks, setTicks] = useState<Tick[]>(BASE_TICKS);
  const [volume, setVolume] = useState(2489137);

  useEffect(() => {
    const id = setInterval(() => {
      setTicks((prev) =>
        prev.map((t) => {
          const wiggle = (Math.random() - 0.5) * 0.3;
          return {
            ...t,
            probability: Math.max(1, Math.min(99, t.probability + wiggle)),
            delta: wiggle,
          };
        }),
      );
      setVolume((v) => v + Math.floor(Math.random() * 250 + 60));
    }, 1400);
    return () => clearInterval(id);
  }, []);

  // Duplicate for seamless marquee
  const display = [...ticks, ...ticks];

  return (
    <div className="w-full border-t border-white/10 bg-black/55 backdrop-blur-md">
      <div className="page-x flex items-center gap-6 py-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-block h-2 w-2 rounded-full bg-signal-success animate-pulse-soft" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/55">
            Live
          </span>
        </div>
        <div className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-white/40 hidden md:block">
          VOL · {volume.toLocaleString()}
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="flex gap-6 animate-[flow_60s_linear_infinite] whitespace-nowrap will-change-transform"
               style={{ width: "max-content" }}>
            {display.map((t, i) => {
              const positive = t.delta >= 0;
              return (
                <span key={i} className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-white/40">{t.region}</span>
                  <span className="text-white/70">{t.market}</span>
                  <span className="text-white">{t.outcome}</span>
                  <span className="num-display text-white">
                    {t.probability.toFixed(1)}%
                  </span>
                  <span
                    className="font-mono"
                    style={{ color: positive ? "#00FF88" : "#FF5577" }}
                  >
                    {positive ? "▲" : "▼"} {Math.abs(t.delta).toFixed(2)}
                  </span>
                  <span className="text-white/15 mx-2">|</span>
                </span>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/80 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/80 to-transparent" />
        </div>
      </div>
      <style jsx>{`
        @keyframes flow {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
      `}</style>
    </div>
  );
}
