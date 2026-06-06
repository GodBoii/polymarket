"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Activity, LogOut, Play, RefreshCcw, Radio, UserRound } from "lucide-react";
import Link from "next/link";
import AuthGate from "../components/AuthGate";
import { supabase } from "../lib/supabase";

type EventRow = {
  id?: string;
  run_id?: string;
  event_type: string;
  stage: string;
  payload: Record<string, unknown>;
  created_at?: string;
};

type RunRow = {
  id: string;
  fixture_id: number;
  status: string;
  fixture?: Record<string, unknown>;
  result?: Record<string, unknown>;
  created_at?: string;
  completed_at?: string;
  events?: EventRow[];
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8001";

export default function Page() {
  return (
    <AuthGate>
      {(session) => <ConsolePage sessionEmail={session.user.email || "operator"} />}
    </AuthGate>
  );
}

function ConsolePage({ sessionEmail }: { sessionEmail: string }) {
  const [fixtureId, setFixtureId] = useState(19609127);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunRow | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [live, setLive] = useState(false);
  const [activeStage, setActiveStage] = useState("idle");
  const [error, setError] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const tokenText = useMemo(
    () => events.filter((event) => event.event_type === "token").map((event) => String(event.payload.text || "")).join(""),
    [events],
  );

  async function loadRuns() {
    const response = await fetch(`${apiUrl}/runs`);
    const data = await response.json();
    setRuns(Array.isArray(data) ? data : data.runs || []);
  }

  async function loadEvents(runId: string) {
    const response = await fetch(`${apiUrl}/runs/${runId}`);
    const data = await response.json();
    setSelectedRun(data.run || data || null);
    setEvents(data.events || []);
  }

  async function startRun(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setEvents([]);
    setSelectedRun(null);
    setActiveStage("connecting");
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
      setError("WebSocket connection failed");
    };
    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data);
        if (parsed.type === "run_started") {
          setSelectedRun({ id: parsed.run_id, fixture_id: parsed.fixture_id, status: "running" });
          setActiveStage("started");
          return;
        }
        if (parsed.type === "run_completed") {
          setSelectedRun({ id: parsed.run_id, fixture_id: Number(fixtureId), status: "completed", result: parsed.result });
          setActiveStage("completed");
          setLive(false);
          loadRuns();
          return;
        }
        if (parsed.type === "error") {
          setError(parsed.message || "Run failed");
          setLive(false);
          return;
        }
        if (parsed.stage) setActiveStage(parsed.stage);
        setEvents((prev) => [
          ...prev,
          { event_type: parsed.type, stage: parsed.stage || "unknown", payload: parsed.payload || {} },
        ]);
      } catch {
        // ignore non-JSON frames
      }
    };
    wsRef.current = ws;
  }

  useEffect(() => {
    loadRuns();
  }, []);

  async function signOut() {
    if (wsRef.current) wsRef.current.close();
    await supabase.auth.signOut();
  }

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  return (
    <main className="shell">
      <aside className="sidebar">
        <header className="brand">
          <Radio size={18} />
          <span>World Cup Arena Agent</span>
        </header>
        <div className="session">
          <UserRound size={16} />
          <span>{sessionEmail}</span>
          <button className="ghost" onClick={signOut}>
            <LogOut size={14} />
          </button>
        </div>

        <Link className="dashboard-link" href="/dashboard">
          Dashboard
        </Link>

        <section className="runs">
          <header>
            <h2>Recent runs</h2>
            <button className="ghost" onClick={loadRuns}>
              <RefreshCcw size={14} />
            </button>
          </header>
          <ul>
            {runs.length === 0 && <li className="muted">No runs yet</li>}
            {runs.map((run) => (
              <li key={run.id}>
                <button
                  className={selectedRun?.id === run.id ? "active" : ""}
                  onClick={() => loadEvents(run.id)}
                >
                  <span className="run-id">#{run.id.slice(0, 8)}</span>
                  <span className="run-fixture">Fixture {run.fixture_id}</span>
                  <span className={`status status-${run.status}`}>{run.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <section className="workspace">
        <header className="workspace-head">
          <form className="launch" onSubmit={startRun}>
            <label>
              Fixture ID
              <input
                type="number"
                value={fixtureId}
                onChange={(e) => setFixtureId(Number(e.target.value))}
              />
            </label>
            <button type="submit">
              <Play size={14} />
              Start run
            </button>
          </form>
          <div className="status-bar">
            <span className={`live ${live ? "on" : ""}`}>
              <Activity size={14} />
              {live ? "Live" : "Idle"}
            </span>
            <span className="stage">Stage: {activeStage}</span>
          </div>
        </header>

        {selectedRun ? (
          <div className="panels">
            <article className="panel">
              <header>
                <h3>Fixture</h3>
              </header>
              <pre>{JSON.stringify(selectedRun.fixture ?? {}, null, 2)}</pre>
            </article>
            <article className="panel">
              <header>
                <h3>Result</h3>
              </header>
              <pre>{JSON.stringify(selectedRun.result ?? {}, null, 2)}</pre>
            </article>
            <article className="panel stream">
              <header>
                <h3>Token stream</h3>
                <span className="muted">{tokenText.length} chars</span>
              </header>
              <pre>{tokenText || "(waiting for tokens)"}</pre>
            </article>
            <article className="panel">
              <header>
                <h3>Events ({events.length})</h3>
              </header>
              <ol className="events">
                {events.map((event, idx) => (
                  <li key={idx}>
                    <span className="event-type">{event.event_type}</span>
                    <span className="event-stage">{event.stage}</span>
                    <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                  </li>
                ))}
              </ol>
            </article>
          </div>
        ) : (
          <p className="empty">Select a run from the sidebar to inspect its events.</p>
        )}
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 320px minmax(0, 1fr);
        }
        .sidebar {
          border-right: 1px solid #d9dee7;
          background: #fff;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
        }
        .session {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f1f3f7;
          padding: 8px 10px;
          border-radius: 8px;
        }
        .session span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dashboard-link {
          display: flex;
          justify-content: center;
          border: 1px solid #d9dee7;
          background: #f7f8fa;
          padding: 9px 10px;
          border-radius: 6px;
          font-size: 14px;
        }
        .login {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .login input,
        .launch input {
          border: 1px solid #d9dee7;
          padding: 8px;
          border-radius: 6px;
        }
        .runs ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 50vh;
          overflow: auto;
        }
        .runs button {
          width: 100%;
          text-align: left;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 4px 8px;
          padding: 8px 10px;
          background: #f7f8fa;
          border: 1px solid #e6e9ef;
          border-radius: 6px;
          cursor: pointer;
        }
        .runs button.active {
          border-color: #0f8b8d;
          background: #ecf6f6;
        }
        .run-id { font-family: monospace; }
        .run-fixture { color: #617083; font-size: 12px; }
        .status { font-size: 12px; padding: 2px 6px; border-radius: 4px; }
        .status-completed { background: #e0f4e6; color: #208b3a; }
        .status-failed { background: #fbe5e3; color: #b42318; }
        .status-running { background: #fff4d6; color: #8a5a00; }
        .status-pending { background: #eef0f4; color: #4a5568; }
        .workspace {
          padding: 18px 24px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .workspace-head {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 16px;
        }
        .launch {
          display: flex;
          gap: 8px;
          align-items: end;
        }
        .launch label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          color: #617083;
        }
        .panels {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .panel {
          background: #fff;
          border: 1px solid #d9dee7;
          border-radius: 8px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .panel header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .panel pre {
          background: #0e1116;
          color: #c9d1d9;
          padding: 10px;
          border-radius: 6px;
          font-size: 12px;
          max-height: 320px;
          overflow: auto;
          margin: 0;
        }
        .stream pre {
          max-height: 420px;
        }
        .events {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 420px;
          overflow: auto;
        }
        .events li {
          display: grid;
          gap: 4px;
          padding: 8px;
          background: #f7f8fa;
          border-radius: 6px;
        }
        .event-type { font-weight: 600; }
        .event-stage { color: #617083; font-size: 12px; }
        .empty { color: #617083; }
        .muted { color: #617083; font-size: 12px; }
        .status-bar {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .live {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          background: #eef0f4;
        }
        .live.on { background: #e0f4e6; color: #208b3a; }
        .stage { color: #617083; }
        button.ghost {
          background: transparent;
          border: none;
          cursor: pointer;
          color: #617083;
        }
      `}</style>
    </main>
  );
}
