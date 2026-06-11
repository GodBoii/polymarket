"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock,
  Database,
  History,
  Loader2,
  LogOut,
  MessageSquare,
  Play,
  Radio,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import AuthGate from "../components/AuthGate";
import { supabase } from "../lib/supabase";

type RunRow = {
  id: string;
  fixture_id: number;
  mode?: string;
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

type HealthResponse = {
  status: string;
  live_orders_enabled?: boolean;
};

type TranscriptItem =
  | { id: string; kind: "message"; role: string; stage: string; content: string; summary?: Record<string, unknown> }
  | { id: string; kind: "tool"; stage: string; title: string; content: string; status: "running" | "completed"; payload?: unknown }
  | { id: string; kind: "candidate"; stage: string; title: string; content: string; score?: number }
  | { id: string; kind: "decision"; stage: string; summary: Record<string, unknown> }
  | { id: string; kind: "ledger"; stage: string; title: string; content: string };

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001";

const STAGE_LABELS: Record<string, string> = {
  polycognitive: "POLYCOGNITIVE",
  fixture_selector: "Fixture agent",
  match_context: "Match context",
  polymarket_context: "Polymarket",
  exposure: "Exposure",
  prediction_submission: "Prediction",
  bet: "Bet",
  ledger_writer: "Ledger",
  decision: "Decision",
};

export default function DashboardPage() {
  return (
    <AuthGate>
      {(session) => <Dashboard email={session.user.email || "operator"} />}
    </AuthGate>
  );
}

function Dashboard({ email }: { email: string }) {
  const [fixtureId, setFixtureId] = useState(19609127);
  const [manualMode, setManualMode] = useState(false);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [activeRun, setActiveRun] = useState<RunRow | null>(null);
  const [activeStage, setActiveStage] = useState("idle");
  const [live, setLive] = useState(false);
  const [liveOrders, setLiveOrders] = useState(false);
  const [backendLiveEnabled, setBackendLiveEnabled] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  async function loadHealth() {
    try {
      const response = await fetch(`${apiUrl}/health`);
      const data: HealthResponse = await response.json();
      setBackendLiveEnabled(Boolean(data.live_orders_enabled));
    } catch {
      setBackendLiveEnabled(false);
    }
  }

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
    if (liveOrders && !backendLiveEnabled) {
      setConnecting(false);
      setActiveStage("idle");
      setError("Live Stair orders are not enabled on the backend yet. Restart the Docker backend after setting ALLOW_LIVE_ORDERS=true.");
      return;
    }

    const ws = new WebSocket(`${wsUrl}/ws/runs`);
    ws.onopen = () => {
      setLive(true);
      setConnecting(false);
      setActiveStage("started");
      ws.send(
        JSON.stringify(
          manualMode
            ? { mode: "manual", fixture_id: Number(fixtureId), dry_run: !liveOrders }
            : { mode: "auto", dry_run: !liveOrders },
        ),
      );
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
          setActiveRun({ id: parsed.run_id, fixture_id: parsed.fixture_id || 0, mode: parsed.mode, status: "running" });
          setActiveStage("started");
          return;
        }
        if (parsed.type === "run_completed") {
          const result = parsed.result || {};
          const completedFixture = Number(result.fixture?.fixture_id || result.summary?.selected_fixture?.fixture_id || parsed.fixture_id || 0);
          setActiveRun({ id: parsed.run_id, fixture_id: completedFixture, mode: result.mode || (manualMode ? "manual" : "auto"), status: "completed", result });
          setActiveStage("completed");
          setLive(false);
          loadRuns();
          return;
        }
        if (parsed.type === "error") {
          setError(parsed.message || "Agent run failed");
          setLive(false);
          setConnecting(false);
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
    loadHealth();
    loadRuns();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const lastRun = activeRun || runs[0];
  const transcript = useMemo(() => buildTranscript(events, activeRun?.result || lastRun?.result), [events, activeRun?.result, lastRun?.result]);
  const stageLabel = STAGE_LABELS[activeStage] || activeStage;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#050505]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-7 w-7 place-items-center rounded-full border border-cyan-300 text-cyan-300 shadow-[0_0_18px_rgba(0,229,255,0.45)]">
              <Radio size={14} />
            </div>
            <span className="font-display text-lg tracking-[-0.02em]">POLYCOGNITIVE</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-white/35 sm:inline">/ Polycognitive Console</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden truncate text-sm text-white/55 sm:block">{email}</span>
            <Link href="/console" className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs text-white/70 hover:border-cyan-300/40 hover:text-cyan-300">
              <TerminalSquare size={14} />
              Console
            </Link>
            <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/70 hover:border-red-400/40 hover:text-red-300" title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <section className="grid gap-6">
          <section className="relative overflow-hidden border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(0,229,255,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  Authenticated command center
                </div>
                <h1 className="font-display text-3xl leading-tight tracking-[-0.02em] sm:text-5xl">
                  Run the <span className="text-cyan-300">Polycognitive agent</span>.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/58">
                  The agent scouts World Cup markets, selects a match, gathers SportMonks, Supabase, and Polymarket evidence,
                  then explains its prediction and can submit a real arena order when the strategy selects a trade.
                </p>
              </div>
              <LiveBadge live={live} connecting={connecting} activeStage={stageLabel} />
            </div>

            <form onSubmit={startAgent} className="mt-8 grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/65 transition hover:border-white/20">
                  <input type="checkbox" checked={manualMode} onChange={(e) => setManualMode(e.target.checked)} className="h-3.5 w-3.5 accent-cyan-300" />
                  Manual fixture override
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-xs text-amber-100 transition hover:border-amber-300/35">
                  <input
                    type="checkbox"
                    checked={liveOrders}
                    disabled={!backendLiveEnabled}
                    onChange={(e) => setLiveOrders(e.target.checked)}
                    className="h-3.5 w-3.5 accent-amber-300"
                  />
                  Enable live Stair orders
                </label>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">{manualMode ? "Manual fixture mode" : "Auto scout mode"}</span>
              </div>
              {manualMode && (
                <label>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Fixture ID</span>
                  <input
                    className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 font-mono text-base text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/15"
                    type="number"
                    value={fixtureId}
                    onChange={(e) => setFixtureId(Number(e.target.value))}
                  />
                </label>
              )}
              <button disabled={live || connecting || (liveOrders && !backendLiveEnabled)} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-6 text-sm font-semibold text-black shadow-[0_0_24px_rgba(0,229,255,0.35)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit">
                {live || connecting ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="fill-current" />}
                {live || connecting ? "Streaming..." : liveOrders ? "Run with live orders" : "Run dry run"}
              </button>
            </form>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-xs leading-relaxed text-white/58">
              {liveOrders
                ? "Live-order mode is enabled. The backend will require ALLOW_LIVE_ORDERS=true and can submit real Stair play-money orders."
                : "Dry-run mode is enabled. The agent will still scout, predict, build the ledger, and prepare order payloads, but it will not submit live Stair orders."}
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                Backend live-orders capability: {backendLiveEnabled ? "enabled" : "disabled"}
              </div>
            </div>

            {error && <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <Metric label="Active stage" value={stageLabel === "idle" ? "-" : stageLabel} icon={Activity} />
            <Metric label="Transcript events" value={String(transcript.length)} icon={Sparkles} />
            <Metric label="Recent runs" value={String(runs.length)} icon={History} />
          </section>

          <section className="overflow-hidden border border-white/[0.08] bg-white/[0.02]">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">Agent conversation</div>
                <h2 className="mt-1 font-display text-lg tracking-[-0.01em]">Polycognitive transcript</h2>
              </div>
              {live && <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">Streaming</span>}
            </header>
            <div className="max-h-[720px] overflow-auto bg-black/25 p-4 sm:p-5">
              {transcript.length > 0 ? (
                <div className="grid gap-4">
                  {transcript.map((item) => <TranscriptCard key={item.id} item={item} />)}
                  {lastRun?.result && (
                    <details className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Debug payload</summary>
                      <pre className="mt-3 max-h-[360px] overflow-auto rounded-lg bg-black/50 p-3 font-mono text-[11px] leading-5 text-white/75">
                        {JSON.stringify(lastRun.result, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                <EmptyState icon={MessageSquare} title="No transcript yet" description="Start the Polycognitive agent to watch it scout, call tools, reason, and make a live arena decision." />
              )}
            </div>
          </section>

          <section className="overflow-hidden border border-white/[0.08] bg-white/[0.02]">
            <header className="border-b border-white/[0.06] px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">Live stream</div>
              <h2 className="mt-1 font-display text-lg tracking-[-0.01em]">Raw event pulse</h2>
            </header>
            <div className="max-h-[260px] overflow-auto">
              {events.length === 0 ? (
                <EmptyState icon={Radio} title="Waiting for events" description="Compact stream pulses appear here while the transcript shows the readable agent response." />
              ) : (
                <ul className="divide-y divide-white/[0.04]">
                  {events.slice().reverse().map((ev, i) => (
                    <li key={`${ev.stage}-${events.length - i}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-5 py-3 text-xs">
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-300"><Activity size={12} /></span>
                      <div className="min-w-0">
                        <div className="font-mono text-white/85">{ev.event_type}</div>
                        <div className="truncate font-mono text-[11px] text-white/40">stage: {ev.stage}</div>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">{String(events.length - i).padStart(3, "0")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </section>

        <aside className="grid h-fit gap-6 lg:sticky lg:top-24">
          <section className="overflow-hidden border border-white/[0.08] bg-white/[0.02]">
            <header className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2">
                <History size={16} className="text-cyan-300" />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">History</div>
                  <h2 className="font-display text-base tracking-[-0.01em]">Run history</h2>
                </div>
              </div>
              <button onClick={loadRuns} className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/60 hover:border-cyan-300/40 hover:text-cyan-300" title="Refresh runs">
                <RefreshCcw size={13} />
              </button>
            </header>
            <div className="max-h-[calc(100vh-220px)] overflow-auto p-3">
              {runs.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-white/45">No agent runs yet.</p>
              ) : (
                <ul className="grid gap-2">
                  {runs.map((run, i) => (
                    <li key={run.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-white/85">#{String(i + 1).padStart(2, "0")} {run.id.slice(0, 8)}</div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/50">
                            <Target size={11} />
                            <span>{run.mode === "auto" ? "Auto scout" : "Fixture"} {run.fixture_id || ""}</span>
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
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="border border-cyan-300/15 bg-cyan-300/[0.04] p-5">
            <ShieldCheck size={18} className="text-cyan-300" />
            <h3 className="mt-3 font-display text-base tracking-[-0.01em]">Execution mode</h3>
            <p className="mt-2 text-xs leading-relaxed text-white/55">
              The dashboard now defaults to dry-run mode. Turn on live Stair orders only when your backend is launched with `ALLOW_LIVE_ORDERS=true` and you intentionally want real arena execution.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function buildTranscript(events: EventRow[], result?: Record<string, unknown>): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  events.forEach((event, index) => {
    const payload = event.payload || {};
    if (event.event_type === "chat_message") {
      items.push({ id: `m-${index}`, kind: "message", role: String(payload.role || "assistant"), stage: event.stage, content: String(payload.content || ""), summary: asRecord(payload.summary) });
    } else if (event.event_type === "tool_call_started" || event.event_type === "tool_call_completed") {
      items.push({
        id: `t-${index}`,
        kind: "tool",
        stage: event.stage,
        title: String(payload.tool_name || STAGE_LABELS[event.stage] || event.stage),
        content: String(payload.summary || (event.event_type === "tool_call_started" ? "Tool call started" : "Tool call completed")),
        status: event.event_type === "tool_call_started" ? "running" : "completed",
        payload: payload.output || payload.input,
      });
    } else if (event.event_type === "candidate_ranked") {
      items.push({
        id: `c-${index}`,
        kind: "candidate",
        stage: event.stage,
        title: String(payload.name || "Candidate fixture"),
        content: `Score ${String(payload.score ?? "n/a")} - ${Array.isArray(payload.score_reasons) ? payload.score_reasons.join(", ") : "market candidate"}`,
        score: typeof payload.score === "number" ? payload.score : undefined,
      });
    } else if (event.event_type === "fixture_selected") {
      items.push({ id: `s-${index}`, kind: "message", role: "assistant", stage: event.stage, content: `Selected fixture: ${String(payload.name || payload.fixture_id || "unknown")}.` });
    } else if (event.event_type === "decision") {
      items.push({ id: `d-${index}`, kind: "decision", stage: event.stage, summary: payload });
    } else if (event.event_type === "ledger_record") {
      items.push({ id: `l-${index}`, kind: "ledger", stage: event.stage, title: String(payload.behavior || "Ledger record"), content: String(payload.description || payload.action_summary || payload.trigger_description || "Reasoning Ledger record prepared") });
    }
  });

  const summary = asRecord(result?.summary);
  if (summary && !items.some((item) => item.kind === "decision")) {
    items.push({ id: "result-decision", kind: "decision", stage: "decision", summary });
  }
  return items;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function TranscriptCard({ item }: { item: TranscriptItem }) {
  if (item.kind === "decision") return <DecisionCard summary={item.summary} />;
  const stage = STAGE_LABELS[item.stage] || item.stage;
  const Icon = item.kind === "tool" ? Wrench : item.kind === "candidate" ? Search : item.kind === "ledger" ? Database : Bot;
  const tone = item.kind === "ledger" ? "border-amber-300/20 bg-amber-300/[0.04]" : item.kind === "tool" ? "border-cyan-300/20 bg-cyan-300/[0.04]" : item.kind === "candidate" ? "border-white/[0.08] bg-white/[0.025]" : "border-white/[0.08] bg-white/[0.035]";
  return (
    <article className={`rounded-2xl border ${tone} p-4`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-black/25 text-cyan-300">
          <Icon size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">{stage}</span>
            {item.kind === "tool" && <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">{item.status}</span>}
          </div>
          <h3 className="mt-1 text-sm font-semibold text-white">{item.kind === "message" ? item.role === "assistant" ? "Agent" : item.role : item.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-white/70">{item.content}</p>
          {"payload" in item && item.payload ? (
            <pre className="mt-3 max-h-36 overflow-auto rounded-lg bg-black/35 p-3 font-mono text-[11px] leading-5 text-white/60">{JSON.stringify(item.payload, null, 2)}</pre>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function DecisionCard({ summary }: { summary: Record<string, unknown> }) {
  const fixture = asRecord(summary.selected_fixture);
  const trade = asRecord(summary.trade);
  const shouldTrade = Boolean(summary.should_trade);
  return (
    <article className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.045] p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-emerald-300">
          <CheckCircle2 size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">Final decision</div>
          <h3 className="mt-1 font-display text-xl tracking-[-0.02em]">{shouldTrade ? "Live trade submitted" : "No-trade decision"}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{String(summary.rationale || "The agent compared football priors with market pricing and did not expose private chain-of-thought.")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Fixture" value={String(fixture?.name || fixture?.fixture_id || "n/a")} />
            <MiniStat label="Prediction" value={`${String(summary.prediction_outcome || "n/a")} ${String(summary.prediction_probability_display || "")}`} />
            <MiniStat label="Market" value={String(summary.market_probability_display || "n/a")} />
            <MiniStat label="Edge" value={`${String(summary.edge_pp ?? "n/a")} pp`} />
          </div>
          {trade && (
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/20 p-3 font-mono text-[11px] text-white/60">
              {String(trade.direction || "none").toUpperCase()} {String(trade.team_code || "no team")} size ${String(trade.size_usdc || "0")} limit {String(trade.limit_price ?? "n/a")}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ size?: number; className?: string }> }) {
  return (
    <div className="border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">{label}</div>
          <div className="mt-2 truncate font-display text-3xl tracking-[-0.02em]">{value}</div>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
          <Icon size={15} />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</div>
      <div className="mt-1 truncate text-sm text-white/85">{value}</div>
    </div>
  );
}

function LiveBadge({ live, connecting, activeStage }: { live: boolean; connecting: boolean; activeStage: string }) {
  const label = live ? activeStage : connecting ? "Connecting" : "Idle";
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">
      <span className={`h-1.5 w-1.5 rounded-full ${live || connecting ? "bg-cyan-300 animate-pulse" : "bg-white/40"}`} />
      {label}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const ok = normalized === "completed" || normalized === "success";
  const running = normalized === "running" || normalized === "live";
  const color = ok ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300" : running ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-300" : "border-white/10 bg-white/[0.04] text-white/60";
  return <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${color}`}>{status}</span>;
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ size?: number }>; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.02] text-white/30">
        <Icon size={18} />
      </div>
      <h3 className="font-display text-base tracking-[-0.01em]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-white/45">{description}</p>
    </div>
  );
}
