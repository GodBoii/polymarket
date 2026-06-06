"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { LayoutDashboard, ArrowUpRight } from "lucide-react";
import { supabase } from "../lib/supabase";

const SECTIONS = [
  { id: "arena",        label: "Arena" },
  { id: "engine",       label: "Engine" },
  { id: "intelligence", label: "Intelligence" },
  { id: "reasoning",    label: "Reasoning" },
  { id: "leaderboard",  label: "Leaderboard" },
  { id: "edge",         label: "Edge" },
];

export default function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("hero");
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSignedIn(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setSignedIn(!!session);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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
        scrolled ? "bg-[#050505]/70 backdrop-blur-xl border-b border-white/[0.06]" : ""
      }`}
    >
      <div className="page-x flex items-center justify-between h-16 md:h-20">
        <a href="#hero" className="flex items-center gap-3">
          <div className="relative h-6 w-6">
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, transparent 50%, #00E7FF 50%)",
              }}
            />
            <div className="absolute inset-0.5 bg-ink-950" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-mono text-accent text-[10px]"
                style={{ letterSpacing: "0.18em" }}
              >
                P
              </span>
            </div>
          </div>
          <span
            className="font-display text-white"
            style={{ letterSpacing: "-0.02em", fontSize: "16px", fontWeight: 500 }}
          >
            POLYCOGNITIVE
          </span>
          <span
            className="font-mono text-white/40 hidden md:inline"
            style={{ letterSpacing: "0.22em", fontSize: "10px" }}
          >
            ·&nbsp;STAIR&nbsp;ARENA
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-1">
          {SECTIONS.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="relative px-3 py-2 text-[11px] font-mono uppercase transition-colors"
              style={{
                letterSpacing: "0.18em",
                color: active === s.id ? "#ffffff" : "rgba(255,255,255,0.55)",
              }}
            >
              <span className="text-accent mr-1.5">{String(i + 1).padStart(2, "0")}</span>
              {s.label}
              {active === s.id && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-x-2 -bottom-px h-px bg-accent"
                  style={{ boxShadow: "0 0 8px rgba(0,231,255,0.5)" }}
                />
              )}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {signedIn ? (
            <a href="/dashboard" className="btn btn-primary !py-2 !px-4 !text-sm">
              <LayoutDashboard size={14} />
              Dashboard
            </a>
          ) : (
            <a href="/auth" className="btn btn-primary !py-2 !px-4 !text-sm">
              Mission Control
              <ArrowUpRight size={14} />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
