"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Hairline from "./arena/primitives/Hairline";
import MonoLabel from "./arena/primitives/MonoLabel";
import { AGENT } from "./arena/data/agent";

const FOOTER_LINKS = {
  Mission: ["The Arena", "Forecast Engine", "Intelligence", "Reasoning", "Leaderboard"],
  Agent:   ["POLY-09", "Model Card", "Audit Trail", "Changelog", "Status"],
  Research:["Calibration", "Backtests", "Methodology", "Papers", "Datasets"],
  Press:   ["Brand Kit", "Contact", "Press Brief"],
};

export default function Footer() {
  const ref = useRef<HTMLElement>(null);
  const [t, setT] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <footer ref={ref} className="relative w-full bg-ink-950 overflow-hidden" style={{ minHeight: "100vh" }}>
      {/* Live prediction streams */}
      <div className="absolute inset-0 z-0 opacity-50">
        <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          {Array.from({ length: 18 }).map((_, i) => {
            const y = 60 + (i * 41) % 620;
            const startX = (i * 67) % 1000;
            const endX = (startX + 700 + (i % 3) * 200) % 1000;
            const controlY = y - 80 - (i % 4) * 20;
            const offset = (t * 80 + i * 200) % 1000;
            return (
              <g key={i}>
                <path
                  d={`M ${startX} ${y} Q 500 ${controlY} ${endX} ${y + (i % 2 === 0 ? -10 : 10)}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="0.8"
                />
                <path
                  d={`M ${startX} ${y} Q 500 ${controlY} ${endX} ${y + (i % 2 === 0 ? -10 : 10)}`}
                  fill="none"
                  stroke={i % 4 === 0 ? "#00E7FF" : "rgba(255,255,255,0.4)"}
                  strokeWidth="0.9"
                  strokeDasharray="60 940"
                  strokeDashoffset={-offset}
                  opacity={i % 4 === 0 ? 0.85 : 0.3}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Giant agent wordmark */}
      <div className="relative z-10 w-full flex items-start justify-center pointer-events-none" style={{ minHeight: "55vh", paddingTop: "8vh" }}>
        <div
          className="font-display text-white select-none"
          style={{
            fontSize: "22vw",
            lineHeight: 0.85,
            letterSpacing: "-0.04em",
            fontWeight: 500,
            opacity: 0.03,
          }}
        >
          POLYCOGNITIVE
        </div>
      </div>

      {/* Foreground content */}
      <div className="relative z-10 page-x pb-12 -mt-24 md:-mt-32">
        <Hairline strong />
        <div className="grid grid-cols-12 gap-8 pt-12">
          <div className="col-span-12 md:col-span-4">
            <div className="font-display text-white text-2xl" style={{ letterSpacing: "-0.02em" }}>
              POLYCOGNITIVE
            </div>
            <MonoLabel tone="faint" className="mt-2 block">
              STAIR&nbsp;AI&nbsp;ARENA · {AGENT.codename} · v{AGENT.modelVersion.replace("v", "")}
            </MonoLabel>
            <p className="mt-6 text-white/55 text-sm leading-relaxed max-w-sm">
              One agent. Forty-seven competitors. One published probability per second. The reasoning is the product.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-signal-success" style={{ boxShadow: "0 0 6px #00FF88" }} />
              <MonoLabel>Tournament ACTIVE</MonoLabel>
            </div>
          </div>

          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title} className="col-span-6 md:col-span-2">
              <MonoLabel tone="faint" className="mb-4 block">{title}</MonoLabel>
              <ul className="space-y-2 text-sm">
                {links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-white/70 hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-6 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-4">
          <MonoLabel tone="faint">© 2026 POLYCOGNITIVE · Menlo Park · London · Singapore</MonoLabel>
          <div className="flex items-center gap-4">
            <MonoLabel tone="faint">184.2M datapoints/hr</MonoLabel>
            <a href="#" className="font-mono text-[10px] text-white/55 hover:text-white uppercase" style={{ letterSpacing: "0.18em" }}>
              Audit log <ArrowUpRight size={11} className="inline -mt-0.5 ml-1" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
