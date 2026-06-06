"use client";

import { ArrowUpRight, Github, Twitter, Linkedin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function Footer() {
  const ref = useRef<HTMLElement>(null);
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

  return (
    <footer
      ref={ref}
      className="relative w-full bg-ink-950 overflow-hidden"
      style={{ minHeight: "100vh" }}
    >
      {/* Flows behind typography */}
      <div className="absolute inset-0 z-0 opacity-30">
        <svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <defs>
            <linearGradient id="footerFlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00E5FF" stopOpacity="0" />
              <stop offset="50%" stopColor="#00E5FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00FF88" stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from({ length: 14 }).map((_, i) => {
            const startX = (i * 73) % 1000;
            const endX = ((i * 73) + 600 + (i % 3) * 200) % 1000;
            const y = 80 + (i * 47) % 480;
            const controlY = y - 60 - (i % 4) * 20;
            const offset = (t * 60 + i * 150) % 1000;
            return (
              <path
                key={i}
                d={`M ${startX} ${y} Q 500 ${controlY} ${endX} ${y + (i % 2 === 0 ? -10 : 10)}`}
                fill="none"
                stroke="url(#footerFlow)"
                strokeWidth="0.8"
                strokeDasharray="50 950"
                strokeDashoffset={-offset}
                opacity={0.3 + (i % 3) * 0.2}
              />
            );
          })}
        </svg>
      </div>

      {/* Giant ORACLE wordmark */}
      <div className="relative z-10 w-full flex items-center justify-center pointer-events-none" style={{ minHeight: "60vh" }}>
        <div
          className="font-display text-white select-none"
          style={{
            fontSize: "25vw",
            lineHeight: 0.85,
            letterSpacing: "-0.04em",
            fontWeight: 500,
            opacity: 0.03,
          }}
        >
          ORACLE
        </div>
      </div>

      {/* Foreground footer content */}
      <div className="relative z-10 page-x pb-10">
        <div className="border-t border-white/8 pt-12">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 md:col-span-5">
              <div className="font-display text-3xl text-white mb-3" style={{ letterSpacing: "-0.02em" }}>
                ORACLE
              </div>
              <p className="text-white/55 text-sm leading-relaxed max-w-sm">
                The world&apos;s forecasting engine. Real-time intelligence for real-world events. Built in São Paulo, London, and Singapore.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <a href="#" className="h-9 w-9 rounded-full border border-white/10 flex items-center justify-center text-white/55 hover:text-white hover:border-white/20 transition-colors">
                  <Twitter size={14} />
                </a>
                <a href="#" className="h-9 w-9 rounded-full border border-white/10 flex items-center justify-center text-white/55 hover:text-white hover:border-white/20 transition-colors">
                  <Linkedin size={14} />
                </a>
                <a href="#" className="h-9 w-9 rounded-full border border-white/10 flex items-center justify-center text-white/55 hover:text-white hover:border-white/20 transition-colors">
                  <Github size={14} />
                </a>
              </div>
            </div>
            <div className="col-span-6 md:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-4">Markets</div>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#" className="hover:text-white">World Cup</a></li>
                <li><a href="#" className="hover:text-white">Champions League</a></li>
                <li><a href="#" className="hover:text-white">Premier League</a></li>
                <li><a href="#" className="hover:text-white">Ballon d'Or</a></li>
                <li><a href="#" className="hover:text-white">Copa América</a></li>
              </ul>
            </div>
            <div className="col-span-6 md:col-span-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-4">Product</div>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#" className="hover:text-white">Forecaster AI</a></li>
                <li><a href="#" className="hover:text-white">API</a></li>
                <li><a href="#" className="hover:text-white">Mobile</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Changelog</a></li>
              </ul>
            </div>
            <div className="col-span-12 md:col-span-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-4">Get the daily brief</div>
              <p className="text-white/55 text-sm leading-relaxed mb-4">
                The most important probability moves of the last 24 hours, in your inbox.
              </p>
              <form className="flex items-center gap-2 border border-white/10 rounded-full pl-4 pr-1 py-1">
                <input
                  placeholder="you@domain.com"
                  className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/30 py-2"
                />
                <button type="button" className="h-8 w-8 rounded-full bg-white text-ink-950 flex items-center justify-center">
                  <ArrowUpRight size={14} />
                </button>
              </form>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-white/8 flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono uppercase tracking-widest text-white/40">
            <div className="flex items-center gap-4">
              <span>© 2026 ORACLE Labs Ltd.</span>
              <a href="#" className="hover:text-white/70">Privacy</a>
              <a href="#" className="hover:text-white/70">Terms</a>
              <a href="#" className="hover:text-white/70">Disclosures</a>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-success animate-pulse-soft" />
              <span>All systems normal</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
