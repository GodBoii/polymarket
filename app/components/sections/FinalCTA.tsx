"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const POINTS = [
  // continents outline (rough lat/lon)
  { lat: 60, lon: 10 }, { lat: 50, lon: 30 }, { lat: 35, lon: 50 }, { lat: 20, lon: 80 },
  { lat: 40, lon: 110 }, { lat: 30, lon: 130 }, { lat: 0, lon: 110 }, { lat: -10, lon: 130 },
  { lat: -30, lon: 140 }, { lat: -25, lon: -45 }, { lat: 0, lon: -60 }, { lat: 25, lon: -90 },
  { lat: 40, lon: -100 }, { lat: 55, lon: -75 }, { lat: 30, lon: 5 }, { lat: 0, lon: 15 },
  { lat: -15, lon: 25 }, { lat: -30, lon: 20 },
];

const FLOWS = [
  { from: { lat: 51.5, lon: -0.1 }, to: { lat: -23.5, lon: -46.6 }, label: "London → São Paulo", value: "$84K/min" },
  { from: { lat: 35.7, lon: 139.7 }, to: { lat: 19.1, lon: 72.9 }, label: "Tokyo → Mumbai", value: "$61K/min" },
  { from: { lat: 40.7, lon: -74 }, to: { lat: 48.9, lon: 2.3 }, label: "New York → Paris", value: "$112K/min" },
  { from: { lat: -33.9, lon: 18.4 }, to: { lat: 30, lon: 31 }, label: "Cape Town → Cairo", value: "$48K/min" },
  { from: { lat: 55.8, lon: 37.6 }, to: { lat: 41, lon: 29 }, label: "Moscow → Istanbul", value: "$72K/min" },
  { from: { lat: 19.4, lon: -99.1 }, to: { lat: 34, lon: -118.2 }, label: "Mexico City → LA", value: "$58K/min" },
];

function project(lat: number, lon: number, cx: number, cy: number, r: number) {
  // Simple equirectangular — same projection the hero's "latLonToVec3" implies
  const x = cx + (lon / 180) * r;
  const y = cy - (lat / 90) * r * 0.5;
  return { x, y };
}

export default function FinalCTA() {
  const [t, setT] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const loop = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cx = 500, cy = 300, r = 280;

  return (
    <section className="relative w-full bg-ink-950 py-24 md:py-40 overflow-hidden">
      {/* Globe visualization — full bleed, sits behind text */}
      <div className="absolute inset-0 z-0">
        <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="w-full h-full opacity-70">
          <defs>
            <radialGradient id="globeBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0a1418" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#050505" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0" />
              <stop offset="50%" stopColor="#00E5FF" stopOpacity="1" />
              <stop offset="100%" stopColor="#00FF88" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Globe background */}
          <circle cx={cx} cy={cy} r={r} fill="url(#globeBg)" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" />
          <ellipse cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)" />

          {/* Latitude lines */}
          {[-60, -30, 0, 30, 60].map((lat) => {
            const y = cy - (lat / 90) * r * 0.5;
            const w = Math.sqrt(Math.max(0, 1 - (lat / 90) ** 2)) * r;
            return (
              <line key={lat} x1={cx - w} y1={y} x2={cx + w} y2={y} stroke="rgba(255,255,255,0.04)" />
            );
          })}

          {/* Longitude lines (rotated) */}
          {[0, 45, 90, 135].map((rot) => (
            <ellipse
              key={rot}
              cx={cx}
              cy={cy}
              rx={r * Math.abs(Math.cos((rot * Math.PI) / 180))}
              ry={r}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
            />
          ))}

          {/* Continent dots */}
          {POINTS.map((p, i) => {
            const { x, y } = project(p.lat, p.lon, cx, cy, r);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r="1.2" fill="#00E5FF" opacity="0.7" />
                <circle cx={x} cy={y} r="3" fill="none" stroke="#00E5FF" strokeOpacity="0.3" />
              </g>
            );
          })}

          {/* Flows */}
          {FLOWS.map((f, i) => {
            const a = project(f.from.lat, f.from.lon, cx, cy, r);
            const b = project(f.to.lat, f.to.lon, cx, cy, r);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2 - 30;
            const path = `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
            const len = 600;
            const offset = (t * 80 + i * 200) % len;
            return (
              <g key={i}>
                <path d={path} fill="none" stroke="rgba(0,229,255,0.2)" strokeWidth="0.6" />
                <path
                  d={path}
                  fill="none"
                  stroke="url(#flowGrad)"
                  strokeWidth="1.4"
                  strokeDasharray="40 560"
                  strokeDashoffset={-offset}
                  style={{ filter: "drop-shadow(0 0 4px rgba(0,229,255,0.6))" }}
                />
                <circle cx={a.x} cy={a.y} r="2" fill="#00E5FF" />
                <circle cx={b.x} cy={b.y} r="2" fill="#00FF88" />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Foreground content */}
      <div className="page-x relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="kicker mb-8 justify-center">
            <span className="dot" />
            <span>09 / JOIN THE MARKETPLACE</span>
          </div>
          <h2
            className="font-display text-white"
            style={{
              fontSize: "clamp(56px, 9vw, 160px)",
              lineHeight: 0.95,
              letterSpacing: "-0.04em",
              fontWeight: 500,
            }}
          >
            See the future <br />
            <span className="text-accent">form in real time.</span>
          </h2>
          <p className="mt-8 text-white/60 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            The world&apos;s beliefs. One marketplace. Open an account in 90 seconds, deposit in any currency, and start forecasting the events that matter to you.
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <a className="btn btn-primary" href="/auth">
              Start forecasting
              <ArrowUpRight size={16} />
            </a>
            <a className="btn btn-ghost" href="#markets">
              Explore markets
            </a>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 md:gap-10 font-mono text-[11px] uppercase tracking-widest text-white/40">
            <span>No deposit minimums</span>
            <span className="text-white/20">·</span>
            <span>Withdraw anytime</span>
            <span className="text-white/20">·</span>
            <span>30+ currencies</span>
            <span className="text-white/20">·</span>
            <span>Regulated · SOC2</span>
          </div>
        </div>
      </div>
    </section>
  );
}
