"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, useState } from "react";

type Market = {
  id: string;
  question: string;
  probability: number;
  delta: number;
  volume: string;
  category: string;
  x: number; // 0..1
  y: number; // 0..1
  z: number; // -1..1
  rot: number;
  tone: "accent" | "success" | "warning" | "neutral";
  close: string[]; // ids this is related to
};

const MARKETS: Market[] = [
  {
    id: "m-messi",
    question: "Will Messi become coach of Argentina?",
    probability: 14,
    delta: +0.4,
    volume: "$2.4M",
    category: "Players",
    x: 0.12, y: 0.15, z: 0.3, rot: -4,
    tone: "accent",
    close: ["m-haaland", "m-brazil"],
  },
  {
    id: "m-haaland",
    question: "Will Haaland win the Ballon d'Or?",
    probability: 34,
    delta: +0.3,
    volume: "$8.1M",
    category: "Awards",
    x: 0.78, y: 0.22, z: 0.6, rot: 3,
    tone: "success",
    close: ["m-messi", "m-england"],
  },
  {
    id: "m-england",
    question: "Will England reach the semifinals?",
    probability: 14,
    delta: +0.6,
    volume: "$28.1M",
    category: "World Cup",
    x: 0.08, y: 0.55, z: 0.1, rot: -2,
    tone: "warning",
    close: ["m-haaland", "m-brazil"],
  },
  {
    id: "m-brazil",
    question: "Will Brazil win the World Cup?",
    probability: 23,
    delta: +0.4,
    volume: "$48.2M",
    category: "World Cup",
    x: 0.5, y: 0.4, z: 0.8, rot: 1,
    tone: "accent",
    close: ["m-messi", "m-england", "m-climate"],
  },
  {
    id: "m-climate",
    question: "Will 2025 be the warmest year on record?",
    probability: 71,
    delta: -0.2,
    volume: "$3.8M",
    category: "World",
    x: 0.85, y: 0.62, z: 0.2, rot: -3,
    tone: "success",
    close: ["m-brazil", "m-fed"],
  },
  {
    id: "m-fed",
    question: "Will the Fed cut rates in Q1?",
    probability: 38,
    delta: +1.4,
    volume: "$124.7M",
    category: "Macro",
    x: 0.42, y: 0.78, z: 0.5, rot: 2,
    tone: "warning",
    close: ["m-climate"],
  },
  {
    id: "m-ai",
    question: "Will an AI win a Fields Medal by 2030?",
    probability: 22,
    delta: +0.9,
    volume: "$1.1M",
    category: "Science",
    x: 0.7, y: 0.85, z: 0.0, rot: -2,
    tone: "accent",
    close: ["m-fed"],
  },
];

function MarketCard({ m, hovered, onHover }: { m: Market; hovered: string | null; onHover: (id: string | null) => void }) {
  const toneColor =
    m.tone === "success" ? "#00FF88" : m.tone === "warning" ? "#FFD166" : m.tone === "accent" ? "#00E5FF" : "rgba(255,255,255,0.4)";
  const isHovered = hovered === m.id;
  const isRelated = hovered !== null && m.close.includes(hovered);
  const isDimmed = hovered !== null && !isHovered && !isRelated;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      onMouseEnter={() => onHover(m.id)}
      onMouseLeave={() => onHover(null)}
      animate={{
        y: [0, -6, 0, 4, 0],
      }}
      transition={{
        y: { duration: 8 + (m.z * 4), repeat: Infinity, ease: "easeInOut", delay: m.x },
        opacity: { duration: 0.5 },
      }}
      className="absolute cursor-pointer"
      style={{
        left: `${m.x * 100}%`,
        top: `${m.y * 100}%`,
        zIndex: Math.round(10 + m.z * 10),
        transform: `translate(-50%, -50%) rotate(${m.rot}deg)`,
        width: 280,
        opacity: isDimmed ? 0.25 : 1,
        transition: "opacity 0.4s ease",
      }}
    >
      <div
        className="relative p-5 border backdrop-blur-md"
        style={{
          background: isHovered
            ? "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)"
            : "linear-gradient(180deg, rgba(10,10,10,0.85) 0%, rgba(5,5,5,0.85) 100%)",
          borderColor: isHovered ? toneColor : isRelated ? `${toneColor}66` : "rgba(255,255,255,0.1)",
          boxShadow: isHovered
            ? `0 16px 48px rgba(0,0,0,0.4), 0 0 32px ${toneColor}33`
            : "0 8px 24px rgba(0,0,0,0.3)",
          transition: "all 0.3s ease",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">{m.category}</span>
          <span className="font-mono text-[10px] text-white/40 tabular">{m.volume}</span>
        </div>
        <div className="text-white text-base font-display mb-4 leading-snug" style={{ letterSpacing: "-0.01em" }}>
          {m.question}
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="num-display text-3xl text-white" style={{ letterSpacing: "-0.02em", color: toneColor }}>
              {m.probability}%
            </div>
            <div className="font-mono text-[10px] text-white/40 mt-0.5">Yes</div>
          </div>
          <div className="text-right font-mono text-[11px]" style={{ color: m.delta >= 0 ? "#00FF88" : "#FF5577" }}>
            {m.delta >= 0 ? "▲" : "▼"} {Math.abs(m.delta).toFixed(1)}%
          </div>
        </div>
        {/* tiny probability bar */}
        <div className="mt-3 h-0.5 bg-white/8 relative">
          <div
            className="absolute inset-y-0 left-0"
            style={{ background: toneColor, width: `${m.probability}%`, boxShadow: `0 0 8px ${toneColor}` }}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default function MarketDiscovery() {
  const [hovered, setHovered] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <section ref={ref} className="relative w-full bg-ink-950 py-24 md:py-40 overflow-hidden">
      <div className="page-x relative z-10">
        <div className="grid grid-cols-12 gap-8 mb-12">
          <div className="col-span-12 md:col-span-7">
            <div className="kicker mb-6">
              <span className="dot" />
              <span>08 / MARKET DISCOVERY</span>
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
              Every question <br />
              <span className="text-signal-warning">is a market.</span>
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 md:col-start-9 self-end">
            <p className="text-white/55 text-lg leading-relaxed">
              From Messi to monetary policy. Each market is a node in a vast constellation of human belief. Hover to see how they connect.
            </p>
          </div>
        </div>
      </div>

      {/* The constellation — full bleed */}
      <div className="relative w-full" style={{ height: "min(90vh, 880px)", minHeight: 640 }}>
        {/* Relationship lines as SVG */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {MARKETS.flatMap((m) =>
            m.close.map((cId) => {
              const target = MARKETS.find((x) => x.id === cId);
              if (!target) return null;
              const dimmed = hovered && hovered !== m.id && hovered !== target.id;
              return (
                <line
                  key={`${m.id}-${cId}`}
                  x1={m.x * 100}
                  y1={m.y * 100}
                  x2={target.x * 100}
                  y2={target.y * 100}
                  stroke={dimmed ? "rgba(255,255,255,0.04)" : "rgba(0,229,255,0.3)"}
                  strokeWidth={dimmed ? 0.05 : 0.1}
                  strokeDasharray="0.5 0.5"
                />
              );
            }),
          )}
          {/* Active connection lines */}
          {hovered &&
            MARKETS.find((m) => m.id === hovered)?.close.map((cId) => {
              const target = MARKETS.find((x) => x.id === cId);
              if (!target) return null;
              return (
                <line
                  key={`active-${cId}`}
                  x1={MARKETS.find((m) => m.id === hovered)!.x * 100}
                  y1={MARKETS.find((m) => m.id === hovered)!.y * 100}
                  x2={target.x * 100}
                  y2={target.y * 100}
                  stroke="#00E5FF"
                  strokeWidth="0.15"
                  style={{ filter: "drop-shadow(0 0 1px rgba(0,229,255,0.6))" }}
                />
              );
            })}
        </svg>

        {/* Cards */}
        <div className="relative w-full h-full">
          {MARKETS.map((m) => (
            <MarketCard key={m.id} m={m} hovered={hovered} onHover={setHovered} />
          ))}
        </div>
      </div>

      <div className="page-x mt-8">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-widest text-white/40">
          <span>Hover a card to reveal its related markets.</span>
          <span>3,481 markets · live</span>
        </div>
      </div>
    </section>
  );
}
