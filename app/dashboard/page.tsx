"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  History,
  Loader2,
  LogOut,
  MessageSquare,
  Play,
  Radio,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TerminalSquare,
  UserRound,
  Wrench,
  XCircle,
  Zap,
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
  | { id: string; kind: "tool"; stage: string; title: string; status: "running" | "completed" | "error"; input?: unknown; output?: unknown; success?: boolean }
  | { id: string; kind: "thinking"; stage: string; title: string; content: string; thinkingPayload?: unknown }
  | { id: string; kind: "candidate"; stage: string; title: string; content: string; score?: number }
  | { id: string; kind: "decision"; stage: string; summary: Record<string, unknown> }
  | { id: string; kind: "ledger"; stage: string; title: string; content: string };

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001";

const STAGE_LABELS: Record<string, string> = {
  polycognitive: "POLYCOGNITIVE",
  fixture_selector: "Fixture Agent",
  fixture_selector_thinking: "Fixture Selection Thinking",
  match_context: "Match Context",
  polymarket_context: "Polymarket",
  exposure: "Exposure",
  prediction_submission: "Prediction",
  bet: "Bet",
  daily_batch: "Daily Batch",
  fixture_discovery: "Fixture Discovery",
  ledger_writer: "Ledger",
  decision: "Decision",
  account_status: "Account Status",
  ledger_thinking: "Thinking",
  match_context_digest: "Match Context Digest",
  polymarket_digest: "Polymarket Digest",
  probability_edge: "Probability & Edge",
};

// ─── Simple Markdown Renderer ─────────────────────────────────────────────────
function markdownToHtml(md: string): string {
  let html = md
    // Escape HTML entities first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');

  // Bold + italic combo
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr />");
  html = html.replace(/^===+$/gm, "<hr />");

  // Unordered lists (lines starting with - or *)
  html = html.replace(/^[-*] (.+)$/gm, '<li class="md-li">$1</li>');
  html = html.replace(/(<li class="md-li">.*<\/li>(\n|$))+/g, (match) => `<ul class="md-ul">${match}</ul>`);

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');

  // Double newline → paragraph break
  html = html.replace(/\n\n+/g, '</p><p class="md-p">');
  html = `<p class="md-p">${html}</p>`;

  // Single newlines within paragraphs
  html = html.replace(/<\/p><p class="md-p"><\/p><p class="md-p">/g, '</p><p class="md-p">');
  html = html.replace(/\n/g, "<br />");

  return html;
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
    />
  );
}

// ─── Transcript builder ───────────────────────────────────────────────────────
function buildTranscript(events: EventRow[], result?: Record<string, unknown>): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  // Track tool-call pairs: key → index in items array
  const toolIndex = new Map<string, number>();

  events.forEach((event, index) => {
    const payload = event.payload || {};

    if (event.event_type === "chat_message") {
      items.push({
        id: `m-${index}`,
        kind: "message",
        role: String(payload.role || "assistant"),
        stage: event.stage,
        content: String(payload.content || ""),
        summary: asRecord(payload.summary),
      });
    } else if (event.event_type === "tool_call_started") {
      const toolName = String(payload.tool_name || event.stage);
      const key = `${event.stage}::${toolName}`;
      const item: TranscriptItem = {
        id: `t-${index}`,
        kind: "tool",
        stage: event.stage,
        title: toolName,
        status: "running",
        input: payload.input,
        output: undefined,
        success: undefined,
      };
      toolIndex.set(key, items.length);
      items.push(item);
    } else if (event.event_type === "tool_call_completed") {
      const toolName = String(payload.tool_name || event.stage);
      const key = `${event.stage}::${toolName}`;
      const existingIdx = toolIndex.get(key);
      if (existingIdx !== undefined) {
        const existing = items[existingIdx] as Extract<TranscriptItem, { kind: "tool" }>;
        items[existingIdx] = {
          ...existing,
          status: payload.success === false ? "error" : "completed",
          output: payload.output,
          success: payload.success !== false,
        };
      } else {
        items.push({
          id: `tc-${index}`,
          kind: "tool",
          stage: event.stage,
          title: toolName,
          status: payload.success === false ? "error" : "completed",
          output: payload.output,
          success: payload.success !== false,
        });
      }
    } else if (event.event_type === "ledger_record") {
      if (event.stage === "ledger_thinking") {
        const stageLabel = String((payload as Record<string, unknown>).stage || "");
        items.push({
          id: `th-${index}`,
          kind: "thinking",
          stage: event.stage,
          title: STAGE_LABELS[stageLabel] || stageLabel || "Thinking",
          content: String(payload.description || ""),
          thinkingPayload: payload,
        });
      } else {
        items.push({
          id: `l-${index}`,
          kind: "ledger",
          stage: event.stage,
          title: String(payload.behavior || "Ledger record"),
          content: String(payload.description || (payload as Record<string, unknown>).action_summary || (payload as Record<string, unknown>).trigger_description || "Reasoning ledger record prepared"),
        });
      }
    } else if (event.event_type === "candidate_ranked") {
      items.push({
        id: `c-${index}`,
        kind: "candidate",
        stage: event.stage,
        title: String(payload.name || "Candidate fixture"),
        content: `Score ${String(payload.score ?? "n/a")} — ${Array.isArray(payload.score_reasons) ? payload.score_reasons.join(", ") : "market candidate"}`,
        score: typeof payload.score === "number" ? payload.score : undefined,
      });
    } else if (event.event_type === "fixture_selected") {
      items.push({
        id: `s-${index}`,
        kind: "ledger",
        stage: event.stage,
        title: "Fixture Selected",
        content: `Selected fixture: ${String(payload.name || payload.fixture_id || "unknown")}.`,
      });
    } else if (event.event_type === "decision") {
      items.push({ id: `d-${index}`, kind: "decision", stage: event.stage, summary: payload });
    }
  });

  const summary = asRecord(result?.summary);
  if (summary && !items.some((item) => item.kind === "decision")) {
    items.push({ id: "result-decision", kind: "decision", stage: "decision", summary });
  }
  return items;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

// ─── Page entry ───────────────────────────────────────────────────────────────
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [userScrolled, setUserScrolled] = useState(false);

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
            : { mode: "daily", dry_run: !liveOrders, concurrency: 2 },
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
          setActiveRun({ id: parsed.run_id, fixture_id: completedFixture, mode: result.mode || (manualMode ? "manual" : "daily"), status: "completed", result });
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

  // Auto-scroll transcript container (not the page)
  useEffect(() => {
    if (userScrolled) return;
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events, userScrolled]);

  // Detect when the user manually scrolls up — stop auto-scrolling
  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolled(distFromBottom > 80);
  }

  const lastRun = activeRun || runs[0];
  const transcript = useMemo(() => buildTranscript(events, activeRun?.result || lastRun?.result), [events, activeRun?.result, lastRun?.result]);
  const stageLabel = STAGE_LABELS[activeStage] || activeStage;

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      {/* Markdown styles injected globally */}
      <style>{`
        .markdown-body { font-size: 0.9rem; line-height: 1.75; color: rgba(255,255,255,0.85); }
        .markdown-body .md-h1 { font-size: 1.5rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #fff; }
        .markdown-body .md-h2 { font-size: 1.2rem; font-weight: 700; margin: 0.9rem 0 0.4rem; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.3rem; }
        .markdown-body .md-h3 { font-size: 1rem; font-weight: 600; margin: 0.7rem 0 0.3rem; color: rgba(255,255,255,0.9); }
        .markdown-body .md-p { margin: 0.5rem 0; }
        .markdown-body strong { color: #fff; font-weight: 600; }
        .markdown-body em { color: rgba(255,255,255,0.75); font-style: italic; }
        .markdown-body .md-code { background: rgba(0,229,255,0.08); color: #00e5ff; padding: 0.1rem 0.35rem; border-radius: 4px; font-family: monospace; font-size: 0.8rem; border: 1px solid rgba(0,229,255,0.15); }
        .markdown-body .md-ul { list-style: none; padding: 0; margin: 0.5rem 0; }
        .markdown-body .md-li { padding: 0.15rem 0 0.15rem 1.2rem; position: relative; color: rgba(255,255,255,0.8); }
        .markdown-body .md-li::before { content: "▸"; position: absolute; left: 0; color: #00e5ff; font-size: 0.7rem; top: 0.3rem; }
        .markdown-body .md-blockquote { border-left: 3px solid rgba(0,229,255,0.4); padding-left: 0.8rem; margin: 0.5rem 0; color: rgba(255,255,255,0.6); font-style: italic; }
        .markdown-body hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 0.75rem 0; }
        .tool-details summary::-webkit-details-marker { display: none; }
        .tool-details summary { list-style: none; }
        .thinking-details summary::-webkit-details-marker { display: none; }
        .thinking-details summary { list-style: none; }
      `}</style>

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
            <Link href="/profile" className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs text-white/70 hover:border-cyan-300/40 hover:text-cyan-300">
              <UserRound size={14} />
              Profile
            </Link>
            <button onClick={signOut} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/70 hover:border-red-400/40 hover:text-red-300" title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-6 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <section className="grid gap-6">
          {/* Hero / control panel */}
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
                  The agent fetches the pre-match slate, runs one fixed-fixture analysis per match, gathers SportMonks,
                  Supabase, and Polymarket evidence, then can submit guarded arena orders.
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
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">{manualMode ? "Manual fixture mode" : "Daily pre-match mode"}</span>
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
                : "Dry-run mode is enabled. The agent will discover the pre-match slate, predict, build ledgers, and prepare guarded order payloads, but it will not submit live Stair orders."}
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
                Backend live-orders capability: {backendLiveEnabled ? "enabled" : "disabled"}
              </div>
            </div>

            {error && <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</div>}
          </section>

          {/* Metrics */}
          <section className="grid gap-3 sm:grid-cols-3">
            <Metric label="Active stage" value={stageLabel === "idle" ? "-" : stageLabel} icon={Activity} />
            <Metric label="Transcript events" value={String(transcript.length)} icon={Sparkles} />
            <Metric label="Recent runs" value={String(runs.length)} icon={History} />
          </section>

          {/* ── Transcript panel ── */}
          <section className="overflow-hidden border border-white/[0.08] bg-white/[0.02]">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">Agent conversation</div>
                <h2 className="mt-1 font-display text-lg tracking-[-0.01em]">Polycognitive transcript</h2>
              </div>
              {userScrolled && transcript.length > 0 && (
                <button
                  onClick={() => {
                    setUserScrolled(false);
                    const el = scrollContainerRef.current;
                    if (el) el.scrollTop = el.scrollHeight;
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50 hover:border-cyan-300/40 hover:text-cyan-300 transition"
                >
                  <ChevronDown size={11} />
                  Scroll to bottom
                </button>
              )}
              {live && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                  Streaming
                </span>
              )}
            </header>

            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="max-h-[820px] overflow-y-auto bg-black/25 p-4 sm:p-5"
            >
              {transcript.length > 0 ? (
                <div className="grid gap-3">
                  {transcript.map((item) => <TranscriptCard key={item.id} item={item} />)}
                  {/* live typing indicator */}
                  {live && (
                    <div className="flex items-center gap-3 px-2">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-300">
                        <Bot size={14} />
                      </div>
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300/60" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300/60" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300/60" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                  {lastRun?.result && (
                    <details className="tool-details rounded-xl border border-white/[0.08] bg-black/20 p-4">
                      <summary className="flex cursor-pointer items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40 hover:text-white/60">
                        <ChevronRight size={12} className="details-chevron transition-transform" />
                        Debug payload
                      </summary>
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
        </section>

        {/* ── Sidebar ── */}
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
                            <span>{run.mode === "daily" || run.mode === "auto" ? "Daily slate" : "Fixture"} {run.fixture_id || ""}</span>
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

// ─── Transcript card router ───────────────────────────────────────────────────
function TranscriptCard({ item }: { item: TranscriptItem }) {
  if (item.kind === "decision") return <DecisionCard summary={item.summary} />;
  if (item.kind === "message") return <MessageCard item={item} />;
  if (item.kind === "tool") return <ToolCallCard item={item} />;
  if (item.kind === "thinking") return <ThinkingCard item={item} />;
  if (item.kind === "ledger") return <LedgerCard item={item} />;
  if (item.kind === "candidate") return <CandidateCard item={item} />;
  return null;
}

// ─── Message card (LLM output) ────────────────────────────────────────────────
function MessageCard({ item }: { item: Extract<TranscriptItem, { kind: "message" }> }) {
  const isAssistant = item.role === "assistant";
  return (
    <article className="flex gap-3">
      <div className={`mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-bold shadow-md ${isAssistant ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-300" : "border-white/15 bg-white/[0.05] text-white/60"}`}>
        {isAssistant ? <Bot size={15} /> : <span className="text-[10px] font-mono uppercase">{item.role.slice(0, 2)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-xs font-semibold text-white/80">{isAssistant ? "Agent" : item.role}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">{STAGE_LABELS[item.stage] || item.stage}</span>
        </div>
        <div className="rounded-2xl rounded-tl-sm border border-white/[0.08] bg-white/[0.04] px-5 py-4">
          {item.content ? (
            <MarkdownContent content={item.content} />
          ) : (
            <p className="text-sm text-white/40 italic">No content</p>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Tool call card (collapsible) ─────────────────────────────────────────────
function ToolCallCard({ item }: { item: Extract<TranscriptItem, { kind: "tool" }> }) {
  const isRunning = item.status === "running";
  const isError = item.status === "error";
  const stageLabel = STAGE_LABELS[item.stage] || item.stage;

  const statusColor = isRunning
    ? "border-cyan-300/30 bg-cyan-300/[0.06] text-cyan-300"
    : isError
    ? "border-red-400/30 bg-red-400/[0.06] text-red-300"
    : "border-emerald-300/30 bg-emerald-300/[0.06] text-emerald-300";

  const hasDetails = item.input !== undefined || item.output !== undefined;

  return (
    <article className={`rounded-2xl border ${isRunning ? "border-cyan-300/20 bg-cyan-300/[0.03]" : isError ? "border-red-400/20 bg-red-400/[0.03]" : "border-white/[0.08] bg-white/[0.025]"}`}>
      <details className="tool-details group" open={isRunning}>
        <summary className="flex cursor-pointer items-center gap-3 p-4 select-none">
          {/* Icon */}
          <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${statusColor}`}>
            {isRunning ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isError ? (
              <XCircle size={14} />
            ) : (
              <Wrench size={14} />
            )}
          </div>

          {/* Labels */}
          <div className="flex min-w-0 flex-1 items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/35">{stageLabel}</span>
            <span className="font-mono text-sm font-semibold text-white/90">{item.title}</span>
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${statusColor}`}>
              {item.status}
            </span>
          </div>

          {/* Chevron */}
          {hasDetails && (
            <ChevronDown size={14} className="shrink-0 text-white/30 transition-transform duration-200 group-open:rotate-180" />
          )}
        </summary>

        {hasDetails && (
          <div className="grid gap-3 border-t border-white/[0.06] px-4 pb-4 pt-3">
            {item.input !== undefined && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Zap size={11} className="text-white/30" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Input</span>
                </div>
                <pre className="max-h-48 overflow-auto rounded-xl bg-black/40 p-3.5 font-mono text-[11px] leading-5 text-white/70 scrollbar-thin">
                  {typeof item.input === "string" ? item.input : JSON.stringify(item.input, null, 2)}
                </pre>
              </div>
            )}
            {item.output !== undefined && (
              <div>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 size={11} className="text-emerald-300/60" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">Output</span>
                </div>
                <pre className="max-h-64 overflow-auto rounded-xl bg-black/40 p-3.5 font-mono text-[11px] leading-5 text-white/70 scrollbar-thin">
                  {typeof item.output === "string" ? item.output : JSON.stringify(item.output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </details>
    </article>
  );
}

// ─── Thinking card (collapsible) ──────────────────────────────────────────────
function ThinkingCard({ item }: { item: Extract<TranscriptItem, { kind: "thinking" }> }) {
  return (
    <article className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.04]">
      <details className="thinking-details group">
        <summary className="flex cursor-pointer items-center gap-3 p-4 select-none">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-violet-400/30 bg-violet-400/10 text-violet-300">
            <Brain size={14} />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-violet-300/50">Thinking</span>
            <span className="font-mono text-sm font-semibold text-violet-200">{item.title}</span>
          </div>
          <ChevronDown size={14} className="shrink-0 text-violet-300/40 transition-transform duration-200 group-open:rotate-180" />
        </summary>

        <div className="grid gap-3 border-t border-violet-400/10 px-4 pb-4 pt-3">
          {item.content && (
            <p className="text-sm leading-relaxed text-violet-200/70">{item.content}</p>
          )}
          {item.thinkingPayload !== undefined && (
            <pre className="max-h-64 overflow-auto rounded-xl bg-black/40 p-3.5 font-mono text-[11px] leading-5 text-violet-200/60">
              {JSON.stringify(item.thinkingPayload as Record<string, unknown>, null, 2)}
            </pre>
          )}
        </div>
      </details>
    </article>
  );
}

// ─── Ledger card ──────────────────────────────────────────────────────────────
function LedgerCard({ item }: { item: Extract<TranscriptItem, { kind: "ledger" }> }) {
  const stageLabel = STAGE_LABELS[item.stage] || item.stage;
  return (
    <article className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.03] p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-amber-300/25 bg-amber-300/10 text-amber-300">
          <Activity size={13} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300/50">{stageLabel}</span>
            <span className="font-semibold text-sm text-amber-100">{item.title}</span>
          </div>
          {item.content && (
            <p className="mt-1 text-sm leading-relaxed text-white/55">{item.content}</p>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Candidate card ───────────────────────────────────────────────────────────
function CandidateCard({ item }: { item: Extract<TranscriptItem, { kind: "candidate" }> }) {
  const score = item.score;
  const pct = score !== undefined ? Math.min(100, Math.max(0, Math.round(score * 10))) : null;
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/40">
          <Target size={13} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white/80">{item.title}</span>
            {score !== undefined && (
              <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[10px] text-white/50">
                Score {score}
              </span>
            )}
          </div>
          {pct !== null && (
            <div className="mt-2 h-1 rounded-full bg-white/[0.06]">
              <div className="h-1 rounded-full bg-gradient-to-r from-cyan-300/50 to-cyan-300" style={{ width: `${pct}%` }} />
            </div>
          )}
          <p className="mt-1.5 text-xs text-white/45">{item.content}</p>
        </div>
      </div>
    </article>
  );
}

// ─── Decision card ────────────────────────────────────────────────────────────
function DecisionCard({ summary }: { summary: Record<string, unknown> }) {
  const fixture = asRecord(summary.selected_fixture);
  const trade = asRecord(summary.trade);
  const shouldTrade = Boolean(summary.should_trade);
  const rationale = String(summary.rationale || "The agent compared football priors with market pricing and did not expose private chain-of-thought.");
  const order = asRecord(trade?.order);
  const payload = asRecord(order?.payload);
  const teamCode = String(trade?.team_code || payload?.team_code || "no team");
  const size = String(trade?.size_usdc || payload?.usd_size || "0");
  const limit = String(trade?.limit_price ?? payload?.worst_price ?? payload?.limit_price ?? "n/a");
  const status = String(trade?.order_status || order?.status || (trade?.submitted ? "submitted" : "prepared"));
  const rejection = String(trade?.rejection_reason || trade?.error || "");

  return (
    <article className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.04] p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-emerald-300">
          <CheckCircle2 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">Final decision</div>
          <h3 className="mt-1 font-display text-xl tracking-[-0.02em]">{shouldTrade ? "Live trade submitted" : "No-trade decision"}</h3>

          {/* Rationale rendered as markdown */}
          <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
            <MarkdownContent content={rationale} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Fixture" value={String(fixture?.name || fixture?.fixture_id || "n/a")} />
            <MiniStat label="Prediction" value={`${String(summary.prediction_outcome || "n/a")} ${String(summary.prediction_probability_display || "")}`} />
            <MiniStat label="Market" value={String(summary.market_probability_display || "n/a")} />
            <MiniStat label="Edge" value={`${String(summary.edge_pp ?? "n/a")} pp`} />
          </div>

          {trade && (
            <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.05] p-3 font-mono text-[11px] text-emerald-200/80">
              <span className="font-semibold">{String(trade.direction || "buy_yes").toUpperCase()}</span>{" "}
              {teamCode} size <span className="text-emerald-300">${size}</span>{" "}
              limit <span className="text-emerald-300">{limit}</span>{" "}
              best ask <span className="text-emerald-300">{String(trade.best_ask ?? "n/a")}</span>{" "}
              status <span className="text-emerald-300">{status}</span>
              {rejection && <div className="mt-2 text-red-200/80">Reason: {rejection}</div>}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Shared small components ───────────────────────────────────────────────────
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
  const color = ok
    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300"
    : running
    ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-300"
    : "border-white/10 bg-white/[0.04] text-white/60";
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
