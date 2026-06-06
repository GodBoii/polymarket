"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Atom, Briefcase, Megaphone, Mic, Users } from "lucide-react";

type Node = {
  id: string;
  label: string;
  icon: "fans" | "analysts" | "traders" | "journalists" | "models";
  x: number; // 0..1
  y: number; // 0..1
  count: string;
};

const NODES: Node[] = [
  { id: "fans", label: "Fans", icon: "fans", x: 0.18, y: 0.22, count: "1.84M" },
  { id: "analysts", label: "Analysts", icon: "analysts", x: 0.82, y: 0.18, count: "42.1K" },
  { id: "traders", label: "Traders", icon: "traders", x: 0.5, y: 0.5, count: "187K" },
  { id: "journalists", label: "Journalists", icon: "journalists", x: 0.2, y: 0.78, count: "8.4K" },
  { id: "models", label: "Models", icon: "models", x: 0.82, y: 0.78, count: "1,204" },
];

const ICONS = {
  fans: Users,
  analysts: Briefcase,
  traders: Atom,
  journalists: Mic,
  models: Megaphone,
} as const;

export default function GlobalSentiment() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });
  const [tick, setTick] = useState(0);
  const [predictionCount, setPredictionCount] = useState(24_812_904);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setPredictionCount((c) => c + Math.floor(Math.random() * 1240 + 480));
    }, 700);
    return () => clearInterval(id);
  }, []);

  // Build edges (fully connected)
  const edges = useMemo(() => {
    const out: { a: Node; b: Node; key: string }[] = [];
    for (let i = 0; i < NODES.length; i++) {
      for (let j = i + 1; j < NODES.length; j++) {
        out.push({ a: NODES[i], b: NODES[j], key: `${NODES[i].id}-${NODES[j].id}` });
      }
    }
    return out;
  }, []);

  // Particle packets traveling along edges
  const packets = useMemo(() => {
    return edges.flatMap((e, idx) =>
      [0, 1, 2].map((k) => ({
        edgeKey: e.key,
        a: e.a,
        b: e.b,
        offset: ((idx * 0.13 + k * 0.31) % 1),
        speed: 0.0018 + ((idx + k) % 5) * 0.0004,
      })),
    );
  }, [edges]);

  const [packetPositions, setPacketPositions] = useState<Array<{ x: number; y: number; key: string }>>([]);
  useEffect(() => {
    if (!inView) return;
    let raf: number;
    const start = performance.now();
    const loop = (t: number) => {
      const elapsed = t - start;
      const positions = packets.map((p) => {
        const local = ((elapsed * p.speed) + p.offset) % 1;
        const x = p.a.x + (p.b.x - p.a.x) * local;
        const y = p.a.y + (p.b.y - p.a.y) * local + Math.sin(local * Math.PI) * -0.04;
        return { x, y, key: `${p.edgeKey}-${p.offset.toFixed(3)}` };
      });
      setPacketPositions(positions);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [packets, inView]);

  return (
    <section ref={ref} className="relative w-full bg-ink-950 py-24 md:py-40 overflow-hidden">
      <div className="page-x relative z-10">
        <div className="grid grid-cols-12 gap-8 mb-12">
          <div className="col-span-12 md:col-span-7">
            <div className="kicker mb-6">
              <span className="dot" />
              <span>05 / GLOBAL SENTIMENT ENGINE</span>
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
              The world's <br />
              <span className="text-signal-warning">collective mind.</span>
            </h2>
          </div>
          <div className="col-span-12 md:col-span-4 md:col-start-9 self-end">
            <p className="text-white/55 text-lg leading-relaxed">
              Fans, analysts, traders, journalists, and machine models — all contributing signals that converge into a single probability. You are looking at it think.
            </p>
            <div className="mt-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-success animate-pulse-soft" />
              <span>{(predictionCount / 1_000_000).toFixed(2)}M predictions processed · 12h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Network visualization — full bleed canvas, behind text on the next row */}
      <div className="relative w-full" style={{ height: "min(80vh, 760px)", minHeight: 520 }}>
        <svg
          viewBox="0 0 1000 700"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
        >
          <defs>
            <radialGradient id="nodeGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00E5FF" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="nodeGradGreen" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00FF88" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#00FF88" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="nodeGradYellow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFD166" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#FFD166" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
              <stop offset="50%" stopColor="rgba(0,229,255,0.25)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
            </linearGradient>
          </defs>

          {/* Edges */}
          {edges.map((e) => (
            <g key={e.key}>
              <line
                x1={e.a.x * 1000}
                y1={e.a.y * 700}
                x2={e.b.x * 1000}
                y2={e.b.y * 700}
                stroke="url(#edgeGrad)"
                strokeWidth="0.6"
              />
              <line
                x1={e.a.x * 1000}
                y1={e.a.y * 700}
                x2={e.b.x * 1000}
                y2={e.b.y * 700}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="0.4"
                strokeDasharray="2 4"
              />
            </g>
          ))}

          {/* Packets */}
          {packetPositions.map((p) => (
            <circle
              key={p.key}
              cx={p.x * 1000}
              cy={p.y * 700}
              r="1.6"
              fill="#00E5FF"
              opacity="0.9"
            />
          ))}

          {/* Nodes */}
          {NODES.map((n, i) => {
            const Icon = ICONS[n.icon];
            const toneGrad = i === 0 ? "url(#nodeGradGreen)" : i === 2 ? "url(#nodeGrad)" : i === 4 ? "url(#nodeGradYellow)" : "url(#nodeGrad)";
            return (
              <g key={n.id} transform={`translate(${n.x * 1000}, ${n.y * 700})`}>
                <motion.circle
                  r="80"
                  fill={toneGrad}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={inView ? { opacity: [0.4, 0.8, 0.4], scale: 1 } : {}}
                  transition={{ duration: 4 + i * 0.5, repeat: Infinity, delay: i * 0.4 }}
                />
                <circle r="22" fill="#0a0a0a" stroke={i === 0 ? "#00FF88" : i === 2 ? "#00E5FF" : i === 4 ? "#FFD166" : "#9bdcff"} strokeWidth="0.8" />
                <foreignObject x="-12" y="-12" width="24" height="24">
                  <div className="flex items-center justify-center w-full h-full" style={{ color: i === 0 ? "#00FF88" : i === 2 ? "#00E5FF" : i === 4 ? "#FFD166" : "#9bdcff" }}>
                    <Icon size={16} />
                  </div>
                </foreignObject>
                <text
                  y="42"
                  textAnchor="middle"
                  fill="#fff"
                  fontFamily="var(--font-geist), system-ui, sans-serif"
                  fontSize="13"
                  letterSpacing="-0.01em"
                  fontWeight="500"
                >
                  {n.label}
                </text>
                <text
                  y="58"
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.5)"
                  fontFamily="ui-monospace, monospace"
                  fontSize="9"
                  letterSpacing="0.15em"
                >
                  {n.count}
                </text>
              </g>
            );
          })}

          {/* Center hub label */}
          <g transform="translate(500, 350)">
            <text textAnchor="middle" fill="rgba(255,255,255,0.6)" fontFamily="ui-monospace, monospace" fontSize="9" letterSpacing="0.2em" y="-6">
              COLLECTIVE PROBABILITY
            </text>
            <text textAnchor="middle" fill="#00E5FF" fontFamily="var(--font-geist), system-ui" fontSize="32" fontWeight="500" letterSpacing="-0.02em" y="20">
              {(((tick * 17) % 100) / 10 + 18).toFixed(1)}%
            </text>
          </g>
        </svg>
      </div>

      {/* Bottom stat row */}
      <div className="page-x mt-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 border-t border-white/8 pt-8">
          {NODES.map((n) => (
            <div key={`b-${n.id}`}>
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">{n.label}</div>
              <div className="num-display text-2xl text-white mt-1" style={{ letterSpacing: "-0.02em" }}>{n.count}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
