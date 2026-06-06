"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import { ChevronDown, ArrowUpRight, Search } from "lucide-react";

const SECTIONS = [
  { id: "markets", label: "Markets" },
  { id: "rivers", label: "Rivers" },
  { id: "match", label: "Match" },
  { id: "sentiment", label: "Sentiment" },
  { id: "tournaments", label: "Tournaments" },
  { id: "ai", label: "AI" },
  { id: "discover", label: "Discover" },
];

export default function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("");

  useMotionValueEvent(scrollY, "change", (v) => {
    setScrolled(v > 60);
  });

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) setActive(s.id);
          });
        },
        { rootMargin: "-40% 0px -50% 0px" },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-black/55 backdrop-blur-xl border-b border-white/8" : ""
      }`}
    >
      <div className="page-x flex items-center justify-between h-16 md:h-20">
        <a href="#" className="flex items-center gap-3">
          <div className="relative h-6 w-6">
            <div className="absolute inset-0 rounded-full border border-accent" style={{ boxShadow: "0 0 12px rgba(0,229,255,0.5)" }} />
            <div className="absolute inset-1.5 rounded-full bg-accent" style={{ boxShadow: "0 0 16px rgba(0,229,255,0.8)" }} />
          </div>
          <span className="font-display text-white text-lg" style={{ letterSpacing: "-0.02em" }}>ORACLE</span>
        </a>

        <nav className="hidden lg:flex items-center gap-1">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="relative px-3 py-2 text-sm font-mono uppercase tracking-widest transition-colors"
              style={{ color: active === s.id ? "#ffffff" : "rgba(255,255,255,0.55)" }}
            >
              <span className="text-accent mr-1.5">{String(SECTIONS.indexOf(s) + 1).padStart(2, "0")}</span>
              {s.label}
              {active === s.id && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-x-2 -bottom-px h-px bg-accent"
                  style={{ boxShadow: "0 0 8px rgba(0,229,255,0.5)" }}
                />
              )}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button className="hidden md:flex items-center gap-2 px-3 py-2 border border-white/10 rounded-full text-sm text-white/55 hover:text-white hover:border-white/20 transition-colors">
            <Search size={14} />
            <span className="font-mono text-[11px] uppercase tracking-widest">Search markets</span>
          </button>
          <a href="/auth" className="btn btn-primary !py-2 !px-4 !text-sm">
            Sign in <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </header>
  );
}
