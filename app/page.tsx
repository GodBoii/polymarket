"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Activity, LogOut, Play, RefreshCcw, Radio, UserRound } from "lucide-react";
import { supabase } from "./lib/supabase";

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

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
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
    setRuns(data);
  }

  async function loadRun(runId: string) {
    const response = await fetch(`${apiUrl}/runs/${runId}`);
    const data = await response.json();
    setSelectedRun(data);
    setEvents(data.events || []);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessionEmail(data.session?.user.email || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email || null);
    });
    loadRuns().catch(() => undefined);
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) setError(signUpError.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  function startRun() {
    setEvents([]);
    setSelectedRun(null);
    setLive(true);
    setActiveStage("connecting");
    setError("");

    const socket = new WebSocket(`${wsUrl}/ws/runs`);
    wsRef.current = socket;
    socket.onopen = () => socket.send(JSON.stringify({ fixture_id: fixtureId, dry_run: true }));
    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.type === "run_started") {
        setSelectedRun({ id: data.run_id, fixture_id: data.fixture_id, status: "running" });
        setActiveStage("started");
      } else if (data.type === "run_completed") {
        setSelectedRun({ id: data.run_id, fixture_id: fixtureId, status: "completed", result: data.result });
        setActiveStage("completed");
        setLive(false);
        loadRuns().catch(() => undefined);
      } else if (data.type === "error") {
        setError(data.message);
        setLive(false);
      } else {
        setActiveStage(data.stage || data.type);
        setEvents((current) => [...current, { event_type: data.type, stage: data.stage, payload: data.payload }]);
      }
    };
    socket.onerror = () => {
      setError("WebSocket connection failed.");
      setLive(false);
    };
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Activity size={18} />
          <span>World Cup Arena</span>
        </div>

        {sessionEmail ? (
          <div className="authRow">
            <UserRound size={16} />
            <span>{sessionEmail}</span>
            <button className="iconButton" onClick={signOut} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <form className="authForm" onSubmit={signIn}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" type="email" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />
            <button type="submit">Sign in</button>
          </form>
        )}

        <div className="runBox">
          <label>Fixture ID</label>
          <input value={fixtureId} onChange={(e) => setFixtureId(Number(e.target.value))} />
          <button className="primary" onClick={startRun} disabled={live}>
            <Play size={16} />
            <span>{live ? "Running" : "Run Agent"}</span>
          </button>
        </div>

        <div className="historyHead">
          <span>Past Runs</span>
          <button className="iconButton" onClick={loadRuns} title="Refresh">
            <RefreshCcw size={15} />
          </button>
        </div>
        <div className="runList">
          {runs.map((run) => (
            <button key={run.id} className="runItem" onClick={() => loadRun(run.id)}>
              <span>{run.fixture?.name ? String(run.fixture.name) : `Fixture ${run.fixture_id}`}</span>
              <small>{run.status} · {run.created_at ? new Date(run.created_at).toLocaleString() : run.id.slice(0, 8)}</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Agent Run Console</h1>
            <p>{selectedRun?.id || "No run selected"}</p>
          </div>
          <div className={live ? "status live" : "status"}>
            <Radio size={15} />
            <span>{activeStage}</span>
          </div>
        </header>

        {error && <div className="error">{error}</div>}

        <section className="summaryGrid">
          <Panel title="Prediction" data={selectedRun?.result?.prediction} />
          <Panel title="Strategy" data={selectedRun?.result?.strategy} />
          <Panel title="Execution" data={selectedRun?.result?.execution} />
        </section>

        <section className="stream">
          <div className="sectionTitle">Live Stream</div>
          <pre>{tokenText || "Waiting for streamed agent output..."}</pre>
        </section>

        <section className="events">
          <div className="sectionTitle">Stage Events</div>
          {events.map((event, index) => (
            <details key={`${event.stage}-${index}`} open={index > events.length - 4}>
              <summary>
                <span>{event.stage}</span>
                <small>{event.event_type}</small>
              </summary>
              <pre>{JSON.stringify(event.payload, null, 2)}</pre>
            </details>
          ))}
        </section>
      </section>
    </main>
  );
}

function Panel({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="panel">
      <div className="panelTitle">{title}</div>
      <pre>{data ? JSON.stringify(data, null, 2) : "No data yet"}</pre>
    </div>
  );
}
