"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, History, LogOut, Play, Radio, RefreshCcw, ShieldCheck, TerminalSquare } from "lucide-react";
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

    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket(`${wsUrl}/ws/runs`);
    ws.onopen = () => {
      setLive(true);
      ws.send(JSON.stringify({ fixture_id: Number(fixtureId), dry_run: true }));
    };
    ws.onclose = () => {
      setLive(false);
      loadRuns();
    };
    ws.onerror = () => {
      setLive(false);
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

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#17202a]">
      <header className="border-b border-[#d9dee7] bg-white">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="flex items-center gap-2 font-display text-lg">
            <Radio size={18} className="text-[#0f8b8d]" />
            ORACLE Agent
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-sm text-[#617083] sm:block">{email}</span>
            <Link href="/console" className="flex h-9 items-center gap-2 border border-[#d9dee7] bg-white px-3 text-sm hover:bg-[#f1f3f7]">
              <TerminalSquare size={15} />
              Console
            </Link>
            <button onClick={signOut} className="grid h-9 w-9 place-items-center border border-[#d9dee7] bg-white hover:bg-[#f1f3f7]" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="grid gap-5">
          <div className="border border-[#d9dee7] bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase text-[#617083]">
                  <ShieldCheck size={14} className="text-[#0f8b8d]" />
                  Authenticated command center
                </div>
                <h1 className="font-display text-3xl">Start the Polymarket AI agent.</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#617083]">
                  Runs stay in dry-run mode and stream each research, prediction, strategy, executor, and ledger stage from the backend.
                </p>
              </div>
              <span className={`flex items-center gap-2 border px-3 py-2 text-sm ${live ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-[#d9dee7] bg-[#f7f8fa] text-[#617083]"}`}>
                <Activity size={15} />
                {live ? "Live" : "Idle"}
              </span>
            </div>

            <form onSubmit={startAgent} className="mt-6 grid gap-3 sm:grid-cols-[260px_auto]">
              <label className="text-sm font-medium">
                Fixture ID
                <input
                  className="mt-2 h-11 w-full border border-[#d9dee7] px-3 outline-none focus:border-[#0f8b8d]"
                  type="number"
                  value={fixtureId}
                  onChange={(e) => setFixtureId(Number(e.target.value))}
                />
              </label>
              <button disabled={live} className="mt-auto flex h-11 w-full items-center justify-center gap-2 bg-[#0f8b8d] px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-fit">
                <Play size={16} />
                Start agent
              </button>
            </form>
            {error && <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Metric label="Active stage" value={activeStage} />
            <Metric label="Stream events" value={String(events.length)} />
            <Metric label="Recent runs" value={String(runs.length)} />
          </div>

          <section className="border border-[#d9dee7] bg-white">
            <header className="flex items-center justify-between border-b border-[#d9dee7] px-4 py-3">
              <h2 className="font-display text-lg">Latest run</h2>
              {lastRun && (
                <Link href="/console" className="flex items-center gap-1 text-sm text-[#0f8b8d]">
                  Inspect <ArrowRight size={14} />
                </Link>
              )}
            </header>
            <pre className="max-h-[460px] overflow-auto bg-[#0e1116] p-4 text-xs leading-6 text-[#c9d1d9]">
              {lastRun ? JSON.stringify(lastRun.result || lastRun, null, 2) : "Start an agent run to see the result payload."}
            </pre>
          </section>
        </section>

        <aside className="border border-[#d9dee7] bg-white">
          <header className="flex items-center justify-between border-b border-[#d9dee7] px-4 py-3">
            <div className="flex items-center gap-2">
              <History size={16} className="text-[#0f8b8d]" />
              <h2 className="font-display text-lg">Run history</h2>
            </div>
            <button onClick={loadRuns} className="grid h-8 w-8 place-items-center border border-[#d9dee7] hover:bg-[#f1f3f7]" title="Refresh runs">
              <RefreshCcw size={14} />
            </button>
          </header>
          <div className="max-h-[calc(100vh-156px)] overflow-auto p-3">
            {runs.length === 0 ? (
              <p className="p-3 text-sm text-[#617083]">No agent runs yet.</p>
            ) : (
              <div className="grid gap-2">
                {runs.map((run) => (
                  <Link key={run.id} href="/console" className="grid gap-1 border border-[#e6e9ef] bg-[#f7f8fa] p-3 text-sm hover:border-[#0f8b8d]">
                    <span className="font-mono">#{run.id.slice(0, 8)}</span>
                    <span className="text-[#617083]">Fixture {run.fixture_id}</span>
                    <span className="w-fit bg-white px-2 py-1 text-xs text-[#617083]">{run.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d9dee7] bg-white p-4">
      <div className="text-xs uppercase text-[#617083]">{label}</div>
      <div className="mt-2 truncate font-display text-2xl">{value}</div>
    </div>
  );
}
