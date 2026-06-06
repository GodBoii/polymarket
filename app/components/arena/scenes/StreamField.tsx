"use client";

import { useEffect, useRef, useState } from "react";

const ACCENT = "#00E7FF";
const SUCCESS = "#00FF88";

// Cheap deterministic 2D pseudo-noise (Perlin-ish)
function noise(x: number, y: number, t: number) {
  const a = Math.sin(x * 0.3 + t * 0.4) * Math.cos(y * 0.27 - t * 0.3);
  const b = Math.sin(x * 0.7 - t * 0.2) * Math.cos(y * 0.5 + t * 0.35);
  const c = Math.sin((x + y) * 0.18 + t * 0.1);
  return (a + b * 0.6 + c * 0.8) / 2.4;
}

type Drop = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  prob: number;
  hue: string;
  life: number;
};

type Props = {
  width?: number;
  height?: number;
  drops: { x: number; y: number; prob: number; hue?: "accent" | "success" }[];
  density?: number;
  className?: string;
};

export default function StreamField({ width = 1200, height = 480, drops, density = 24, className = "" }: Props) {
  const [t, setT] = useState(0);
  const animRef = useRef<number | null>(null);
  const fieldRef = useRef<{ x: number; y: number; ang: number }[]>([]);
  const [movingDrops, setMovingDrops] = useState<Drop[]>([]);

  // Build a static flow field
  useEffect(() => {
    const cells: { x: number; y: number; ang: number }[] = [];
    const step = 36;
    for (let y = 0; y < height + step; y += step) {
      for (let x = 0; x < width + step; x += step) {
        cells.push({ x, y, ang: 0 });
      }
    }
    fieldRef.current = cells;
  }, [width, height]);

  // Initialize moving drops
  useEffect(() => {
    const initial: Drop[] = drops.map((d, i) => ({
      x: d.x,
      y: d.y,
      vx: 0,
      vy: 0,
      prob: d.prob,
      hue: d.hue === "success" ? SUCCESS : ACCENT,
      life: 0,
    }));
    setMovingDrops(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops.length]);

  useEffect(() => {
    const start = performance.now();
    const loop = (now: number) => {
      setT((now - start) / 1000);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Build line endpoints for the flow field
  const lines: { x1: number; y1: number; x2: number; y2: number; opacity: number }[] = [];
  fieldRef.current.forEach((c) => {
    const ang = noise(c.x, c.y, t) * Math.PI * 1.2;
    const len = 14;
    lines.push({
      x1: c.x,
      y1: c.y,
      x2: c.x + Math.cos(ang) * len,
      y2: c.y + Math.sin(ang) * len,
      opacity: 0.12 + (noise(c.x * 0.5, c.y * 0.5, t * 0.4) + 1) * 0.18,
    });
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      className={`w-full h-full ${className}`}
      style={{ background: "transparent" }}
    >
      {/* Flow field */}
      <g>
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="#ffffff"
            strokeWidth="0.6"
            opacity={l.opacity}
          />
        ))}
      </g>

      {/* Center reference circle */}
      <circle
        cx={width / 2}
        cy={height / 2}
        r={Math.min(width, height) * 0.18}
        fill="none"
        stroke={ACCENT}
        strokeWidth="0.8"
        strokeDasharray="2 4"
        opacity="0.25"
      />

      {/* Drops */}
      {movingDrops.map((d, i) => {
        const angle = noise(d.x, d.y, t) * Math.PI * 1.4;
        const radius = 8 + d.prob * 22;
        return (
          <g key={i}>
            <circle
              cx={d.x + Math.cos(angle) * radius * 0.4}
              cy={d.y + Math.sin(angle) * radius * 0.4}
              r={4 + d.prob * 10}
              fill={d.hue}
              opacity={0.18}
            />
            <circle
              cx={d.x + Math.cos(angle) * radius * 0.4}
              cy={d.y + Math.sin(angle) * radius * 0.4}
              r={1.5 + d.prob * 3}
              fill={d.hue}
              opacity={0.9}
            />
          </g>
        );
      })}
    </svg>
  );
}
