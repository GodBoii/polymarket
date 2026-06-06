"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Circle,
  Clock,
  Cpu,
  History,
  Loader2,
  LogOut,
  Play,
  Radio,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TerminalSquare,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";
import AuthGate from "../components/AuthGate";
import { supabase } from "../lib/supabase";

type RunRow = {
  id: string;
  fixture_id: number;
  status: string;
  result?: Record<string, unknown>;
  created_at?: string;
  completed_at?: string;
};

type EventRow = {
  event_type: string;
  stage: string;
  payload: Record<string, unknown>;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001";

const PIPELINE_STAGES = [
  { id: "research", label: "Research", icon: Waves, hint: "Market context" },
  { id: "prediction", label: "Prediction", icon: TrendingUp, hint: "Probability model" },
  { id: "strategy", label: "Strategy", icon: Target, hint: "Position sizing" },
  { id: "executor", label: "Executor", icon: Zap, hint: "Order routing" },
  { id: "ledger", label: "Ledger", icon: Cpu, hint: "On-chain settle" },
] as const;

export default function DashboardPage() {
  return (
    <AuthGate>
      {(session) => <Dashboard email={session.user.email || "operator"} />}
    </AuthGate>
  );
}

function Dashboard({ email }: { email: string }) {
  const [fixtureId, setFixtureId] = useState(19609127);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [activeRun, setActiveRun] = useState<RunRow | null>(null);
  const [activeStage, setActiveStage] = useState("idle");
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  async function loadRuns() {
    try {
      const response = await fetch(`${apiUrl}/runs`);
      const data = await response.json();
      setRuns(Array.isArray(data) ? data : data.runs || []);
    } catch {
      setError("Could not load recent runs. Check that the backend is running on port 8001.");
    }
  }

  async function startAgent(e: FormEvent) {
    e.preventDefault();
    setError("");
    setEvents([]);
    setActiveRun(null);
    setActiveStage("connecting");
    setConnecting(true);

    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket(`${wsUrl}/ws/runs`);
    ws.onopen = () => {
      setLive(true);
      setConnecting(false);
      setActiveStage("started");
      ws.send(JSON.stringify({ fixture_id: Number(fixtureId), dry_run: true }));
    };
    ws.onclose = () => {
      setLive(false);
      setConnecting(false);
      loadRuns();
    };
    ws.onerror = () => {
      setLive(false);
      setConnecting(false);
      setError("WebSocket connection failed. Confirm the FastAPI backend is running.");
    };
    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        if (parsed.type === "run_started") {
          setActiveRun({ id: parsed.run_id, fixture_id: parsed.fixture_id, status: "running" });
          setActiveStage("started");
          return;
        }
        if (parsed.type === "run_completed") {
          setActiveRun({ id: parsed.run_id, fixture_id: Number(fixtureId), status: "completed", result: parsed.result });
          setActiveStage("completed");
          setLive(false);
          loadRuns();
          return;
        }
        if (parsed.type === "error") {
          setError(parsed.message || "Agent run failed");
          setLive(false);
          return;
        }
        if (parsed.stage) setActiveStage(parsed.stage);
        setEvents((prev) => [...prev, { event_type: parsed.type, stage: parsed.stage || "unknown", payload: parsed.payload || {} }]);
      } catch {
        setError("Received an unreadable event from the agent stream.");
      }
    };
    wsRef.current = ws;
  }

  async function signOut() {
    if (wsRef.current) wsRef.current.close();
    await supabase.auth.signOut();
  }

  useEffect(() => {
    loadRuns();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const lastRun = activeRun || runs[0];

  const completedStages = useMemo(() => {
    if (activeStage === "idle" || activeStage === "connecting" || activeStage === "started") {
      return new Set<string>();
    }
    const idx = PIPELINE_STAGES.findIndex((s) => s.id === activeStage);
    if (idx < 0) return new Set<string>();
    return new Set(PIPELINE_STAGES.slice(0, idx).map((s) => s.id));
  }, [activeStage]);

  const currentStage = PIPELINE_STAGES.find((s) => s.id === activeStage);
  const isFinished = activeStage === "completed";

  return (
    <main className="relative min-h-screen bg-ink-950 text-white">
      <div className="vignette" aria-hidden />
      <div className="grain" aria-hidden />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="relative h-6 w-6">
              <div className="absolute inset-0 rounded-full border border-accent" style={{ boxShadow: "0 0 12px rgba(0,229,255,0.5)" }} />
              <div className="absolute inset-1.5 rounded-full bg-accent" style={{ boxShadow: "0 0 16px rgba(0,229,255,0.8)" }} />
            </div>
            <span className="font-display text-lg" style={{ letterSpacing: "-0.02em" }}>ORACLE</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-white/35 sm:inline">/ Agent Console</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden truncate text-sm text-white/55 sm:block">{email}</span>
            <Link
              href="/console"
              className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3.5 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              <TerminalSquare size={14} />
              <span className="font-mono text-[11px] uppercase tracking-[0.16em]">Console</span>
            </Link>
            <button
              onClick={signOut}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.02] text-white/70 transition hover:border-signal-danger/40 hover:bg-signal-danger/10 hover:text-signal-danger"
              title="Sign out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-[1480px] gap-6 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        {/* Main column */}
        <section className="grid gap-6">
          {/* Hero / Start agent card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden border border-white/[0.08] bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent p-6 sm:p-8"
          >
            {/* Decorative glow */}
            <div className="pointer-events-none absolute -right-32 -top-32 h-64 w-64 rounded-full bg-accent/20 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -left-20 bottom-0 h-48 w-48 rounded-full bg-signal-success/10 blur-3xl" aria-hidden />

            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  Authenticated command center
                </div>
                <h1 className="font-display text-3xl leading-tight text-white sm:text-4xl" style={{ letterSpacing: "-0.02em" }}>
                  Run the Polymarket <span className="text-accent">AI agent</span>.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">
                  Every run stays in dry-run mode. You&apos;ll see each pipeline stage stream live from research
                  through on-chain settlement — no real capital at risk.
                </p>
              </div>

              <LiveBadge live={live} connecting={connecting} finished={isFinished} />
            </div>

            <form onSubmit={startAgent} className="relative mt-7 grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                  <span>Fixture ID</span>
                  <span className="text-white/30">Polymarket</span>
                </span>
                <div className="relative mt-2">
                  <input
                    className="h-12 w-full rounded-xl border border-white/10 bg-ink-900/80 px-4 pr-12 font-mono text-base text-white outline-none transition focus:border-accent/60 focus:bg-ink-900 focus:ring-2 focus:ring-accent/20"
                    type="number"
                    value={fixtureId}
                    onChange={(e) => setFixtureId(Number(e.target.value))}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs text-white/30">#</span>
                </div>
              </label>
              <button
                disabled={live || connecting}
                className="group relative mt-auto inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-accent px-6 text-sm font-semibold text-ink-950 transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                style={{ boxShadow: "0 0 24px rgba(0, 229, 255, 0.35)" }}
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {live || connecting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Play size={16} className="fill-current" />
                )}
                <span className="relative">{live || connecting ? "Streaming…" : "Start agent run"}</span>
              </button>
            </form>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-5 flex items-start gap-3 rounded-xl border border-signal-danger/30 bg-signal-danger/10 p-4"
                >
                  <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-signal-danger" />
                  <p className="text-sm text-signal-danger/90">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Pipeline visualizer */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="border border-white/[0.08] bg-white/[0.02] p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">Pipeline</div>
                <h2 className="mt-1 font-display text-lg text-white" style={{ letterSpacing: "-0.01em" }}>
                  {isFinished ? "Run completed" : currentStage ? `Now: ${currentStage.label}` : "Awaiting run"}
                </h2>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                {completedStages.size} / {PIPELINE_STAGES.length} stages
              </div>
            </div>

            <div className="relative grid grid-cols-5 gap-2 sm:gap-3">
              {/* Connector line */}
              <div className="pointer-events-none absolute left-0 right-0 top-5 hidden h-px bg-white/10 sm:block" aria-hidden />
              <div
                className="pointer-events-none absolute left-0 top-5 hidden h-px bg-accent transition-all duration-500 sm:block"
                style={{
                  width: `${(completedStages.size / PIPELINE_STAGES.length) * 100}%`,
                  boxShadow: "0 0 8px rgba(0, 229, 255, 0.6)",
                }}
                aria-hidden
              />

              {PIPELINE_STAGES.map((stage) => {
                const isCompleted = completedStages.has(stage.id);
                const isCurrent = currentStage?.id === stage.id && !isFinished;
                const Icon = stage.icon;

                return (
                  <div key={stage.id} className="relative flex flex-col items-center text-center">
                    <div
                      className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border transition-all duration-300 ${
                        isCompleted
                          ? "border-accent bg-accent text-ink-950"
                          : isCurrent
                          ? "border-accent bg-accent/15 text-accent"
                          : "border-white/15 bg-ink-900 text-white/35"
                      }`}
                      style={isCompleted || isCurrent ? { boxShadow: "0 0 16px rgba(0, 229, 255, 0.4)" } : undefined}
                    >
                      {isCompleted ? <Check size={16} strokeWidth={3} /> : isCurrent ? <Loader2 size={16} className="animate-spin" /> : <Icon size={15} />}
                    </div>
                    <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">{`0${PIPELINE_STAGES.indexOf(stage) + 1}`}</div>
                    <div className={`mt-1 text-xs font-medium ${isCurrent || isCompleted ? "text-white" : "text-white/50"}`}>
                      {stage.label}
                    </div>
                    <div className="mt-0.5 hidden text-[10px] text-white/30 sm:block">{stage.hint}</div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid gap-3 sm:grid-cols-3"
          >
            <Metric label="Active stage" value={currentStage?.label || (activeStage === "idle" ? "—" : activeStage)} icon={Activity} accent="accent" />
            <Metric label="Stream events" value={String(events.length)} icon={Sparkles} accent="success" />
            <Metric label="Recent runs" value={String(runs.length)} icon={History} accent="warning" />
          </motion.div>

          {/* Latest run payload */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="overflow-hidden border border-white/[0.08] bg-white/[0.02]"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">Latest run</div>
                <h2 className="mt-1 font-display text-lg text-white" style={{ letterSpacing: "-0.01em" }}>Result payload</h2>
              </div>
              {lastRun && (
                <Link
                  href="/console"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-1.5 text-xs text-accent transition hover:border-accent/40 hover:bg-accent/10"
                >
                  Open in console <ArrowRight size={12} />
                </Link>
              )}
            </header>
            <div className="relative">
              {lastRun ? (
                <pre className="max-h-[480px] overflow-auto bg-ink-900/80 p-5 font-mono text-[12px] leading-6 text-white/85">
                  {JSON.stringify(lastRun.result || lastRun, null, 2)}
                </pre>
              ) : (
                <EmptyState
                  icon={Play}
                  title="No run yet"
                  description="Start an agent run to inspect the result payload streamed back from the backend."
                />
              )}
            </div>
          </motion.section>

          {/* Live events feed */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="overflow-hidden border border-white/[0.08] bg-white/[0.02]"
          >
            <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">Live stream</div>
                <h2 className="mt-1 font-display text-lg text-white" style={{ letterSpacing: "-0.01em" }}>Agent events</h2>
              </div>
              {live && (
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-signal-success">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-success opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal-success" />
                  </span>
                  Streaming
                </span>
              )}
            </header>
            <div className="max-h-[300px] overflow-auto">
              {events.length === 0 ? (
                <EmptyState
                  icon={Radio}
                  title="Waiting for events"
                  description="Once a run starts, every research, prediction, and executor event will appear here in real time."
                />
              ) : (
                <ul className="divide-y divide-white/[0.04]">
                  <AnimatePresence initial={false}>
                    {events.slice().reverse().map((ev, i) => (
                      <motion.li
                        key={`${ev.stage}-${events.length - i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3 text-xs"
                      >
                        <span className="grid h-6 w-6 place-items-center rounded-full border border-accent/30 bg-accent/10 text-accent">
                          <ChevronRight size={12} />
                        </span>
                        <div className="min-w-0">
                          <div className="font-mono text-white/85">{ev.event_type}</div>
                          <div className="truncate font-mono text-[11px] text-white/40">stage: {ev.stage}</div>
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">
                          {String(events.length - i).padStart(3, "0")}
                        </span>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </motion.section>
        </section>

        {/* Sidebar */}
        <aside className="grid h-fit gap-6 lg:sticky lg:top-24">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="overflow-hidden border border-white/[0.08] bg-white/[0.02]"
          >
            <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
                  <History size={14} />
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">History</div>
                  <h2 className="font-display text-base text-white" style={{ letterSpacing: "-0.01em" }}>Run history</h2>
                </div>
              </div>
              <button
                onClick={loadRuns}
                className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.02] text-white/60 transition hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
                title="Refresh runs"
              >
                <RefreshCcw size={13} />
              </button>
            </header>

            <div className="max-h-[calc(100vh-220px)] overflow-auto p-3">
              {runs.length === 0 ? (
                <div className="px-2 py-6 text-center">
                  <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.02] text-white/30">
                    <Circle size={14} />
                  </div>
                  <p className="text-sm text-white/50">No agent runs yet.</p>
                  <p className="mt-1 text-xs text-white/30">Start a run to populate the timeline.</p>
                </div>
              ) : (
                <ul className="grid gap-2">
                  {runs.map((run, i) => (
                    <li key={run.id}>
                      <Link
                        href="/console"
                        className="group block rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition hover:border-accent/40 hover:bg-white/[0.04]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-white/45">
                                #{String(i + 1).padStart(2, "0")}
                              </span>
                              <span className="truncate font-mono text-xs text-white/85">
                                {run.id.slice(0, 8)}
                              </span>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-white/50">
                              <Target size={11} className="text-white/40" />
                              <span>Fixture {run.fixture_id}</span>
                            </div>
                            {run.created_at && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/35">
                                <Clock size={11} />
                                <span>{new Date(run.created_at).toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                          <StatusPill status={run.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>

          {/* Quick reference card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="relative overflow-hidden border border-white/[0.08] bg-gradient-to-br from-accent/[0.08] via-transparent to-transparent p-5"
          >
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent/10 blur-2xl" aria-hidden />
            <div className="relative">
              <div className="grid h-8 w-8 place-items-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
                <ShieldCheck size={15} />
              </div>
              <h3 className="mt-3 font-display text-base text-white" style={{ letterSpacing: "-0.01em" }}>Dry-run by default</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-white/55">
                Every run executes against the live agent graph but signs no transactions. Switch to
                live mode in the agent config to settle on-chain.
              </p>
              <Link
                href="/console"
                className="mt-4 inline-flex items-center gap-1.5 text-xs text-accent transition hover:gap-2"
              >
                <span>Open agent console</span>
                <ArrowUpRight size={12} />
              </Link>
            </div>
          </motion.div>
        </aside>
      </div>
    </main>
  );
}

function LiveBadge({ live, connecting, finished }: { live: boolean; connecting: boolean; finished: boolean }) {
  const config = live
    ? { label: "Live", textColor: "text-signal-success", bg: "bg-signal-success/10", border: "border-signal-success/30", dot: "bg-signal-success" }
    : connecting
    ? { label: "Connecting", textColor: "text-accent", bg: "bg-accent/10", border: "border-accent/30", dot: "bg-accent" }
    : finished
    ? { label: "Completed", textColor: "text-accent", bg: "bg-accent/10", border: "border-accent/30", dot: "bg-accent" }
    : { label: "Idle", textColor: "text-white/55", bg: "bg-white/[0.04]", border: "border-white/10", dot: "bg-white/40" };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border ${config.border} ${config.bg} px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] ${config.textColor}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {(live || connecting) && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.dot} opacity-75`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.dot}`} />
      </span>
      {config.label}
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent }: { label: string; value: string; icon: React.ComponentType<{ size?: number; className?: string }>; accent: "accent" | "success" | "warning" }) {
  const accentMap = {
    accent: { text: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
    success: { text: "text-signal-success", bg: "bg-signal-success/10", border: "border-signal-success/20" },
    warning: { text: "text-signal-warning", bg: "bg-signal-warning/10", border: "border-signal-warning/20" },
  };
  const c = accentMap[accent];

  return (
    <div className="group relative overflow-hidden border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-white/[0.14] hover:bg-white/[0.04]">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
          <div className="mt-2 truncate font-display text-3xl text-white tabular-nums" style={{ letterSpacing: "-0.02em" }}>{value}</div>
        </div>
        <div className={`grid h-9 w-9 place-items-center rounded-lg border ${c.border} ${c.bg} ${c.text}`}>
          <Icon size={15} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const config = normalized === "completed" || normalized === "success"
    ? { color: "text-signal-success", bg: "bg-signal-success/10", border: "border-signal-success/30", dot: "bg-signal-success" }
    : normalized === "running" || normalized === "live"
    ? { color: "text-accent", bg: "bg-accent/10", border: "border-accent/30", dot: "bg-accent" }
    : normalized === "failed" || normalized === "error"
    ? { color: "text-signal-danger", bg: "bg-signal-danger/10", border: "border-signal-danger/30", dot: "bg-signal-danger" }
    : { color: "text-white/60", bg: "bg-white/[0.04]", border: "border-white/10", dot: "bg-white/40" };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${config.border} ${config.bg} px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${config.color}`}>
      <span className={`h-1 w-1 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ size?: number; className?: string }>; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.02] text-white/30">
        <Icon size={18} />
      </div>
      <h3 className="font-display text-base text-white" style={{ letterSpacing: "-0.01em" }}>{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-white/45">{description}</p>
    </div>
  );
}
