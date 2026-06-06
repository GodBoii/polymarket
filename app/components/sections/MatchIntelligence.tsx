"use client";

import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Activity, CloudRain, Heart, Newspaper, ShieldAlert, TrendingUp, Users } from "lucide-react";

type Metric = {
  key: string;
  label: string;
  value: number; // 0..1
  display: string;
  tone: "accent" | "success" | "warning";
};

const STEPS = [
  {
    id: "squad",
    icon: ShieldAlert,
    title: "Squad depth changed.",
    body: "France confirmed Kylian Mbappé is fit for the quarterfinal after a minor ankle knock. Bench strength metrics re-rated the entire roster upward by +0.6σ.",
    delta: { arg: 0, fra: +2.1 },
    metrics: {
      winArg: 0.42,
      winFra: 0.51,
      draw: 0.07,
      penalty: 0.31,
      firstGoal: 0.58,
      over25: 0.64,
    } as const,
    feedType: "news",
    feedText: "RMC Sport · 14m ago · Mbappé trains at full intensity, expected to start",
  },
  {
    id: "injuries",
    icon: Activity,
    title: "Injury concerns resolved.",
    body: "Argentina's Cristian Romero passed late fitness checks. Defensive line stability now reads at 92 — a 14-day peak. Bookmaker uncertainty is being arbitraged away.",
    delta: { arg: +1.4, fra: -0.3 },
    metrics: {
      winArg: 0.46,
      winFra: 0.48,
      draw: 0.06,
      penalty: 0.28,
      firstGoal: 0.55,
      over25: 0.61,
    } as const,
    feedType: "social",
    feedText: "@TyCSports · 9m ago · Romero laughs in mixed zone, \"feeling great\"",
  },
  {
    id: "form",
    icon: TrendingUp,
    title: "Recent form rebalanced.",
    body: "France's last 5 matches produced +2.1 xG differential. Argentina's 5-match run sits at +0.7. The Elo-equivalent form curve has crossed.",
    delta: { arg: -0.6, fra: +1.9 },
    metrics: {
      winArg: 0.43,
      winFra: 0.52,
      draw: 0.05,
      penalty: 0.34,
      firstGoal: 0.61,
      over25: 0.66,
    } as const,
    feedType: "data",
    feedText: "Opta · 1m ago · xG differential updated across 5-game windows",
  },
  {
    id: "weather",
    icon: CloudRain,
    title: "Weather updated: 19°C, 14km/h wind.",
    body: "Lusail forecast stabilised. Slight tailwind favours attacking transitions on the right channel. Over 2.5 goals probability ticked up by 0.7%.",
    delta: { arg: +0.2, fra: +0.3 },
    metrics: {
      winArg: 0.44,
      winFra: 0.52,
      draw: 0.04,
      penalty: 0.33,
      firstGoal: 0.62,
      over25: 0.68,
    } as const,
    feedType: "data",
    feedText: "Met Office · 30m ago · Stadium micro-climate update",
  },
  {
    id: "sentiment",
    icon: Heart,
    title: "Public sentiment swung.",
    body: "1.4M social mentions in the last 12 hours. Sentiment polarity for France moved from 0.18 to 0.31. Crowd mood is the strongest predictor in this tournament so far.",
    delta: { arg: -0.4, fra: +1.2 },
    metrics: {
      winArg: 0.42,
      winFra: 0.54,
      draw: 0.04,
      penalty: 0.36,
      firstGoal: 0.64,
      over25: 0.7,
    } as const,
    feedType: "social",
    feedText: "Brandwatch · 2m ago · 14,000 mentions/min peak detected",
  },
  {
    id: "markets",
    icon: Users,
    title: "Markets absorbed the signal.",
    body: "22,400 individual participants repriced in the last hour. France implied probability moved from 18% to 22%. The market has stopped hedging.",
    delta: { arg: -0.1, fra: +1.0 },
    metrics: {
      winArg: 0.42,
      winFra: 0.55,
      draw: 0.03,
      penalty: 0.38,
      firstGoal: 0.65,
      over25: 0.72,
    } as const,
    feedType: "market",
    feedText: "ORACLE · Live · 22,400 trades · $3.4M volume · 1h",
  },
];

const FEED_ICONS = {
  news: Newspaper,
  social: Heart,
  data: Activity,
  market: TrendingUp,
} as const;

function MetricRow({ label, value, display, tone }: Metric) {
  const toneColor = tone === "success" ? "#00FF88" : tone === "warning" ? "#FFD166" : "#00E5FF";
  const [pct, setPct] = useState(value * 100);
  useEffect(() => {
    const id = setInterval(() => {
      setPct((cur) => {
        const next = cur + (Math.random() - 0.5) * 0.25;
        return Math.max(0, Math.min(100, next));
      });
    }, 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">{label}</span>
        <span className="num-display text-white text-base" style={{ letterSpacing: "-0.01em" }}>{display}</span>
      </div>
      <div className="h-1 bg-white/8 relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0"
          animate={{ width: `${(pct / 100) * 100}%` }}
          transition={{ duration: 0.6 }}
          style={{ background: toneColor, boxShadow: `0 0 12px ${toneColor}` }}
        />
      </div>
    </div>
  );
}

export default function MatchIntelligence() {
  const [activeStep, setActiveStep] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (v) => {
      const idx = Math.min(STEPS.length - 1, Math.floor(v * STEPS.length));
      setActiveStep(idx);
    });
    return () => unsubscribe();
  }, [scrollYProgress]);

  const current = STEPS[activeStep];
  const FeedIcon = FEED_ICONS[current.feedType as keyof typeof FEED_ICONS];

  return (
    <section ref={ref} className="relative w-full bg-ink-950" style={{ height: `${100 + STEPS.length * 100}vh` }}>
      <div className="page-x pt-24 md:pt-32 pb-12">
        <div className="kicker mb-6">
          <span className="dot" />
          <span>04 / MATCH INTELLIGENCE</span>
        </div>
        <h2
          className="font-display text-white max-w-4xl"
          style={{
            fontSize: "clamp(48px, 7vw, 112px)",
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
            fontWeight: 500,
          }}
        >
          Argentina <span className="text-white/30">vs</span> France.
          <br />
          <span className="text-accent">Why the line moved.</span>
        </h2>
      </div>

      <div className="page-x grid grid-cols-12 gap-8">
        {/* Sticky match card */}
        <div className="col-span-12 lg:col-span-7 lg:sticky lg:top-24 self-start h-fit">
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">QF · Lusail Stadium · 20:00 GMT</span>
              <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-signal-success">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-success animate-pulse-soft" />
                Live
              </span>
            </div>

            {/* Teams */}
            <div className="grid grid-cols-2 gap-6 items-center mb-10">
              <div>
                <div className="text-6xl mb-3">🇦🇷</div>
                <div className="text-2xl font-display text-white">Argentina</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1">Defending champions</div>
                <div className="mt-4 num-display text-5xl text-white" style={{ letterSpacing: "-0.04em" }}>
                  <AnimatedNumber value={current.metrics.winArg} />%
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1">Win probability</div>
              </div>
              <div className="text-right">
                <div className="text-6xl mb-3">🇫🇷</div>
                <div className="text-2xl font-display text-white">France</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1">2018 winners</div>
                <div className="mt-4 num-display text-5xl text-accent" style={{ letterSpacing: "-0.04em" }}>
                  <AnimatedNumber value={current.metrics.winFra} />%
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mt-1">Win probability</div>
              </div>
            </div>

            {/* Probability bar comparison */}
            <div className="h-2 bg-white/8 mb-8 relative">
              <motion.div
                className="absolute inset-y-0 left-0 bg-accent"
                animate={{ width: `${current.metrics.winFra * 100}%` }}
                transition={{ duration: 0.6 }}
                style={{ boxShadow: "0 0 16px rgba(0,229,255,0.4)" }}
              />
              <motion.div
                className="absolute inset-y-0 right-0 bg-white"
                animate={{ width: `${current.metrics.winArg * 100}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>

            {/* Secondary metrics */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              <MetricRow
                key={`d-${activeStep}-draw`}
                label="Draw probability"
                value={current.metrics.draw}
                display={`${(current.metrics.draw * 100).toFixed(1)}%`}
                tone="warning"
              />
              <MetricRow
                key={`p-${activeStep}-pen`}
                label="Penalty probability"
                value={current.metrics.penalty}
                display={`${(current.metrics.penalty * 100).toFixed(1)}%`}
                tone="warning"
              />
              <MetricRow
                key={`f-${activeStep}-fg`}
                label="First goal · France"
                value={current.metrics.firstGoal}
                display={`${(current.metrics.firstGoal * 100).toFixed(1)}%`}
                tone="accent"
              />
              <MetricRow
                key={`o-${activeStep}-25`}
                label="Over 2.5 goals"
                value={current.metrics.over25}
                display={`${(current.metrics.over25 * 100).toFixed(1)}%`}
                tone="success"
              />
            </div>

            {/* Live feed */}
            <div className="mt-10 border-t border-white/8 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <FeedIcon size={12} className="text-accent" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">Live signal feed</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="text-white/80 text-sm leading-relaxed"
                >
                  {current.feedText}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Scrolling narrative */}
        <div className="col-span-12 lg:col-span-5 lg:pl-8">
          <div className="space-y-[40vh] pb-[40vh]">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = i === activeStep;
              return (
                <div
                  key={step.id}
                  className="border-l-2 pl-6 transition-colors duration-500"
                  style={{ borderColor: isActive ? "#00E5FF" : "rgba(255,255,255,0.08)" }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Icon size={16} className={isActive ? "text-accent" : "text-white/40"} />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
                      Step {String(i + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
                    </span>
                  </div>
                  <h3
                    className="font-display text-white mb-3"
                    style={{ fontSize: "clamp(28px, 3vw, 44px)", lineHeight: 1.05, letterSpacing: "-0.02em", fontWeight: 500 }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-white/55 text-base leading-relaxed mb-4 max-w-md">
                    {step.body}
                  </p>
                  <div className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-widest">
                    <div>
                      <div className="text-white/40">Argentina</div>
                      <div style={{ color: step.delta.arg >= 0 ? "#00FF88" : "#FF5577" }}>
                        {step.delta.arg >= 0 ? "+" : ""}{step.delta.arg.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-white/40">France</div>
                      <div style={{ color: step.delta.fra >= 0 ? "#00FF88" : "#FF5577" }}>
                        {step.delta.fra >= 0 ? "+" : ""}{step.delta.fra.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [n, setN] = useState(value * 100);
  useEffect(() => {
    const id = setInterval(() => {
      setN((cur) => {
        const next = cur + (Math.random() - 0.5) * 0.3;
        return Math.max(0, Math.min(100, next));
      });
    }, 1200);
    return () => clearInterval(id);
  }, []);
  return <>{n.toFixed(1)}</>;
}
