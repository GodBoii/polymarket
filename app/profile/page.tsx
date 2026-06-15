"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  ExternalLink,
  History,
  LineChart,
  Loader2,
  Radio,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import AuthGate from "../components/AuthGate";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

type AnyRecord = Record<string, unknown>;

type AgentProfilePayload = {
  agent?: AnyRecord;
  public_profile?: AnyRecord | null;
  wallet?: AnyRecord;
  exposure?: { positions?: AnyRecord[]; unmapped?: AnyRecord[]; source?: string };
  orders?: AnyRecord[];
  recent_predictions?: AnyRecord | null;
  confidence_series?: AnyRecord | null;
  ledger_trace?: { records?: AnyRecord[]; next_cursor?: string } | null;
  local_runs?: AnyRecord[];
};

export default function ProfilePage() {
  return (
    <AuthGate>
      {() => <Profile />}
    </AuthGate>
  );
}

function Profile() {
  const [data, setData] = useState<AgentProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/agent-profile`, { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(String(body.detail || `Profile request failed (${response.status})`));
      }
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load agent profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const agent = data?.agent || {};
  const publicProfile = data?.public_profile || {};
  const wallet = data?.wallet || {};
  const positions = data?.exposure?.positions || [];
  const orders = data?.orders || [];
  const traceRecords = data?.ledger_trace?.records || [];
  const runs = data?.local_runs || [];
  const displayName = text(agent.display_name) || text(publicProfile.display_name) || "Agent profile";
  const bio = text(agent.bio) || text(publicProfile.bio);

  const totals = useMemo(() => {
    const exposureValue = positions.reduce((sum, row) => sum + number(row.value_usdc), 0);
    const exposureCost = positions.reduce((sum, row) => sum + number(row.avg_cost_usdc) * number(row.quantity), 0);
    const unrealizedPnl = positions.reduce((sum, row) => sum + number(row.unrealized_pnl_usdc), 0);
    const realizedPnl = orders.reduce((sum, row) => sum + number(row.realized_pnl_usdc), 0);
    const wins = orders.filter((row) => text(row.outcome_result) === "won").length;
    const losses = orders.filter((row) => text(row.outcome_result) === "lost").length;
    return { exposureValue, exposureCost, unrealizedPnl, realizedPnl, wins, losses };
  }, [positions, orders]);

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#050505]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-7 w-7 place-items-center rounded-full border border-cyan-300 text-cyan-300 shadow-[0_0_18px_rgba(0,229,255,0.45)]">
              <Radio size={14} />
            </div>
            <span className="font-display text-lg tracking-[-0.02em]">POLYCOGNITIVE</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-white/35 sm:inline">/ Agent Profile</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs text-white/70 hover:border-cyan-300/40 hover:text-cyan-300">
              <Activity size={14} />
              Dashboard
            </Link>
            <button onClick={loadProfile} className="inline-flex h-9 items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 text-xs text-cyan-200 hover:border-cyan-300/50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <LineChart size={14} />}
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-5 py-7 lg:px-8">
        {error && (
          <section className="mb-6 border border-red-400/25 bg-red-400/[0.06] p-4 text-sm text-red-100">
            {error}
          </section>
        )}

        <section className="relative overflow-hidden border border-white/[0.08] bg-[radial-gradient(circle_at_20%_0%,rgba(0,229,255,0.22),transparent_30%),radial-gradient(circle_at_90%_20%,rgba(0,255,136,0.10),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.012))] p-6 sm:p-8">
          {loading && !data ? (
            <div className="flex min-h-[260px] items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan-200">
              <Loader2 className="animate-spin" size={18} />
              Loading live Stair telemetry
            </div>
          ) : (
            <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_430px]">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(0,229,255,0.8)]" />
                  {text(agent.lifecycle_phase) || "live"} / {text(agent.slug) || "current-agent"}
                </div>
                <h1 className="max-w-4xl font-display text-4xl leading-[0.95] tracking-[-0.02em] sm:text-6xl">
                  {displayName}
                </h1>
                {bio && <p className="mt-5 max-w-3xl text-sm leading-7 text-white/62">{bio}</p>}
                <div className="mt-6 flex flex-wrap gap-2">
                  <ExternalAnchor href={text(wallet.polymarket_profile_url)} label="Polymarket Profile" />
                  <ExternalAnchor href={text(wallet.polyscan_url)} label="Polygon Wallet" />
                </div>
              </div>

              <div className="grid gap-3 border border-white/[0.08] bg-black/30 p-4">
                <MetricLine label="Wallet address" value={shortAddress(text(wallet.address))} />
                <MetricLine label="Funder" value={shortAddress(text(wallet.funder_address))} />
                <MetricLine label="Created" value={formatDate(agent.created_at)} />
                <MetricLine label="Exposure source" value={text(data?.exposure?.source) || "unavailable"} />
              </div>
            </div>
          )}
        </section>

        {data && (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Wallet} label="Available USDC" value={money(wallet.available_balance_usdc ?? wallet.available_usdc)} tone="cyan" />
              <StatCard icon={ShieldCheck} label="Locked USDC" value={money(wallet.locked_balance_usdc ?? wallet.locked_usdc)} tone="white" />
              <StatCard icon={CircleDollarSign} label="Marked Exposure" value={money(totals.exposureValue)} tone="green" />
              <StatCard icon={totals.realizedPnl >= 0 ? TrendingUp : TrendingDown} label="Realized P&L" value={signedMoney(totals.realizedPnl)} tone={totals.realizedPnl >= 0 ? "green" : "red"} />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
              <Panel title="Open Exposure" eyebrow={`${positions.length} live token lines`}>
                {positions.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-collapse text-left">
                      <thead className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                        <tr className="border-b border-white/[0.08]">
                          <th className="py-3 pr-4 font-medium">Fixture</th>
                          <th className="py-3 pr-4 font-medium">Team</th>
                          <th className="py-3 pr-4 font-medium">Quantity</th>
                          <th className="py-3 pr-4 font-medium">Avg Cost</th>
                          <th className="py-3 pr-4 font-medium">Mark</th>
                          <th className="py-3 pr-4 font-medium">Value</th>
                          <th className="py-3 font-medium">Unrealized</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-xs tabular-nums">
                        {positions.map((row, index) => (
                          <tr key={`${text(row.outcome_token_id)}-${index}`} className="border-b border-white/[0.05] last:border-0">
                            <td className="py-3 pr-4 text-white/78">{text(row.fixture_id)}</td>
                            <td className="py-3 pr-4 text-cyan-200">{text(row.team_code)}</td>
                            <td className="py-3 pr-4 text-white/65">{decimal(row.quantity)}</td>
                            <td className="py-3 pr-4 text-white/65">{money(row.avg_cost_usdc)}</td>
                            <td className="py-3 pr-4 text-white/65">{percent(row.mark_price)}</td>
                            <td className="py-3 pr-4 text-white/78">{money(row.value_usdc)}</td>
                            <td className={`py-3 ${number(row.unrealized_pnl_usdc) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{signedMoney(row.unrealized_pnl_usdc)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState icon={Target} title="No open token exposure" description="Stair AI returned no active holdings for this agent wallet." />
                )}
              </Panel>

              <Panel title="Settlement Scorecard" eyebrow="real outcomes">
                <div className="grid grid-cols-3 gap-3">
                  <ScoreTile label="Won" value={String(totals.wins)} className="border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-200" />
                  <ScoreTile label="Lost" value={String(totals.losses)} className="border-red-300/20 bg-red-300/[0.05] text-red-200" />
                  <ScoreTile label="Open" value={String(orders.filter((row) => text(row.outcome_result) === "open").length)} className="border-cyan-300/20 bg-cyan-300/[0.05] text-cyan-200" />
                </div>
                <div className="mt-5 space-y-3">
                  <MetricLine label="Exposure cost basis" value={money(totals.exposureCost)} />
                  <MetricLine label="Unrealized P&L" value={signedMoney(totals.unrealizedPnl)} />
                  <MetricLine label="Resolved P&L" value={signedMoney(totals.realizedPnl)} />
                </div>
              </Panel>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
              <Panel title="Order History" eyebrow={`${orders.length} Stair orders`}>
                {orders.length ? (
                  <div className="grid gap-3">
                    {orders.map((order) => (
                      <OrderRow key={text(order.order_id)} order={order} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={History} title="No Stair orders returned" description="The arena order endpoint returned an empty order list." />
                )}
              </Panel>

              <Panel title="Reasoning Ledger" eyebrow={`${traceRecords.length} latest records`}>
                {traceRecords.length ? (
                  <div className="space-y-3">
                    {traceRecords.slice(0, 10).map((record) => (
                      <TraceRow key={text(record.record_id)} record={record} />
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Bot} title="No ledger trace returned" description="The authenticated ledger trace endpoint did not return records." />
                )}
              </Panel>
            </section>

            <Panel className="mt-6" title="Run History" eyebrow={`${runs.length} local FastAPI runs`}>
              {runs.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-left">
                    <thead className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
                      <tr className="border-b border-white/[0.08]">
                        <th className="py-3 pr-4 font-medium">Run</th>
                        <th className="py-3 pr-4 font-medium">Fixture</th>
                        <th className="py-3 pr-4 font-medium">Prediction</th>
                        <th className="py-3 pr-4 font-medium">Bet Team</th>
                        <th className="py-3 pr-4 font-medium">Bet Value</th>
                        <th className="py-3 pr-4 font-medium">Edge</th>
                        <th className="py-3 font-medium">Completed</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs tabular-nums">
                      {runs.map((run) => {
                        const fixture = record(run.fixture);
                        const prediction = record(run.prediction);
                        const bet = record(run.bet);
                        return (
                          <tr key={text(run.id)} className="border-b border-white/[0.05] last:border-0">
                            <td className="py-3 pr-4 text-white/70">{shortId(text(run.id))}</td>
                            <td className="py-3 pr-4 text-white/80">{text(fixture.name) || text(fixture.fixture_id)}</td>
                            <td className="py-3 pr-4 text-cyan-200">{text(prediction.outcome)} {probability(prediction.probability)}</td>
                            <td className="py-3 pr-4 text-white/75">{text(bet.team_code) || "no trade"}</td>
                            <td className="py-3 pr-4 text-white/75">{money(bet.size_usdc)}</td>
                            <td className="py-3 pr-4 text-white/75">{points(bet.edge_pp)}</td>
                            <td className="py-3 text-white/45">{formatDate(run.completed_at || run.created_at)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={Clock} title="No local run history" description="The FastAPI run store returned no completed or active runs." />
              )}
            </Panel>
          </>
        )}
      </div>
    </main>
  );
}

function Panel({ title, eyebrow, children, className = "" }: { title: string; eyebrow: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`border border-white/[0.08] bg-white/[0.025] p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.07] pb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/60">{eyebrow}</div>
          <h2 className="mt-1 font-display text-xl tracking-[-0.02em]">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; tone: "cyan" | "green" | "red" | "white" }) {
  const tones = {
    cyan: "border-cyan-300/20 bg-cyan-300/[0.055] text-cyan-200",
    green: "border-emerald-300/20 bg-emerald-300/[0.055] text-emerald-200",
    red: "border-red-300/20 bg-red-300/[0.055] text-red-200",
    white: "border-white/10 bg-white/[0.035] text-white/80",
  };
  return (
    <div className="border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/38">{label}</div>
          <div className="mt-2 font-display text-3xl tracking-[-0.02em] tabular-nums">{value}</div>
        </div>
        <div className={`grid h-10 w-10 place-items-center border ${tones[tone]}`}>
          <Icon size={17} />
        </div>
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: AnyRecord }) {
  const outcome = text(order.outcome_result);
  const isWin = outcome === "won";
  const isLoss = outcome === "lost";
  const Icon = isWin ? CheckCircle2 : isLoss ? XCircle : Clock;
  const color = isWin ? "text-emerald-300 border-emerald-300/25 bg-emerald-300/[0.06]" : isLoss ? "text-red-300 border-red-300/25 bg-red-300/[0.06]" : "text-cyan-200 border-cyan-300/20 bg-cyan-300/[0.05]";
  return (
    <article className="border border-white/[0.07] bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-white/90">{text(order.team_code)} YES</span>
            <span className={`inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${color}`}>
              <Icon size={11} />
              {outcome || text(order.status)}
            </span>
          </div>
          <div className="mt-1 font-mono text-[11px] text-white/42">{shortId(text(order.order_id))} / fixture {text(order.fixture_id)} / {text(order.window)}</div>
        </div>
        <div className="text-right font-mono text-xs tabular-nums">
          <div className="text-white/80">{money(order.usd_size_filled || order.usd_size_requested)}</div>
          <div className={number(order.realized_pnl_usdc) >= 0 ? "text-emerald-300" : "text-red-300"}>{order.realized_pnl_usdc == null ? "unsettled" : signedMoney(order.realized_pnl_usdc)}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <Mini label="Avg fill" value={price(order.open_avg_fill_price)} />
        <Mini label="Limit" value={price(order.open_limit_price)} />
        <Mini label="Settled as" value={text(record(order.settlement).outcome) || "pending"} />
        <Mini label="Filled" value={formatDate(firstFillTime(order))} />
      </div>
    </article>
  );
}

function TraceRow({ record }: { record: AnyRecord }) {
  return (
    <article className="border border-white/[0.07] bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300/70">{text(record.behavior)}</div>
        <div className="font-mono text-[10px] text-white/32">{formatDate(record.server_ts_utc || record.client_ts_utc)}</div>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-white/58">
        {text(record.description) || text(record.prompt) || text(record.trigger_description) || text(record.output_payload) || shortId(text(record.record_id))}
      </p>
    </article>
  );
}

function ScoreTile({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className={`border p-4 text-center ${className}`}>
      <div className="font-display text-3xl tabular-nums">{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] opacity-70">{label}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/[0.06] bg-white/[0.025] p-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/32">{label}</div>
      <div className="mt-1 truncate font-mono text-[11px] text-white/70">{value}</div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-2 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">{label}</span>
      <span className="truncate text-right font-mono text-xs text-white/78">{value || "unavailable"}</span>
    </div>
  );
}

function ExternalAnchor({ href, label }: { href: string; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.035] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/70 hover:border-cyan-300/40 hover:text-cyan-200">
      {label}
      <ArrowUpRight size={13} />
    </a>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ComponentType<{ size?: number }>; title: string; description: string }) {
  return (
    <div className="grid min-h-44 place-items-center border border-dashed border-white/[0.08] bg-black/20 p-6 text-center">
      <div>
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-white/35">
          <Icon size={17} />
        </div>
        <h3 className="font-display text-base">{title}</h3>
        <p className="mt-1 max-w-sm text-xs leading-5 text-white/45">{description}</p>
      </div>
    </div>
  );
}

function record(value: unknown): AnyRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown): string {
  if (value === null || value === undefined || value === "") return "n/a";
  return `$${number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function signedMoney(value: unknown): string {
  const n = number(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${money(n)}`;
}

function decimal(value: unknown): string {
  return number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function price(value: unknown): string {
  if (value === null || value === undefined || value === "") return "n/a";
  return number(value).toFixed(4);
}

function percent(value: unknown): string {
  if (value === null || value === undefined || value === "") return "n/a";
  return `${Math.round(number(value) * 100)}%`;
}

function probability(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return `(${percent(value)})`;
}

function points(value: unknown): string {
  if (value === null || value === undefined || value === "") return "n/a";
  return `${number(value).toFixed(2)} pp`;
}

function shortAddress(value: string): string {
  return value && value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-6)}` : value;
}

function shortId(value: string): string {
  return value && value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value || "n/a";
}

function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "n/a";
  const raw = typeof value === "number" ? value : Number(value);
  const date = Number.isFinite(raw) && String(value).length >= 12 ? new Date(raw) : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function firstFillTime(order: AnyRecord): unknown {
  const fills = order.open_fills;
  if (!Array.isArray(fills) || !fills.length) return null;
  return record(fills[0]).filled_at;
}
