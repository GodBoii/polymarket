# Architecture

## System Shape

ORACLE has two main parts:

- Next.js frontend: authenticated dashboard, run history, and chat-style transcript.
- FastAPI backend: agent orchestration, provider access, strategy execution, run storage, and Reasoning Ledger construction.

The backend is the only place that should hold arena, model, or service-role secrets.

## Data Providers

SportMonks is the fixture truth source. The schedule tells ORACLE which matches exist; fixture details provide teams, kickoff time, predictions, odds, and match context.

Polymarket is the market truth source. The arena fixture mapping connects SportMonks fixture IDs to Polymarket event slugs. Gamma provides market metadata and CLOB token IDs. CLOB midpoint calls provide current implied prices.

Supabase is the historical-prior source. The `world_cup_arena` schema contains tournament aggregates such as country style, knockout patterns, stage records, special-match records, manager records, and head-to-head history.

## Backend Boundaries

The backend separates responsibilities:

- `scout.py`: schedule flattening, candidate scoring, probability helpers.
- `toolkits.py`: provider/tool wrappers for SportMonks, Polymarket, Supabase, arena trading, and ledger endpoints.
- `ledger.py`: Reasoning Ledger record builder and dry-run/live submission behavior.
- `pipeline.py`: orchestration across scout, tools, agents, prediction, strategy, executor, and ledger.
- `server.py`: HTTP/WebSocket API surface.

## Reasoning Ledger Model

Ledger records follow the arena-facing `Reasoning-ledger.md` contract:

- `Observing`: the dashboard run trigger.
- `ToolCalling`: SportMonks, Polymarket, Supabase, executor, and other provider actions.
- `Thinking`: structured digest summaries and strategy reasoning summaries.
- `Acting`: prediction commitment and order/skip-order decision.

`agent_id` is omitted because the arena injects it from the API key. `Thinking.output_payload` is stringified when the source output is structured JSON. Batches are capped at 50 records.

## Frontend Boundaries

The dashboard does not render private model chain-of-thought. It renders:

- agent-facing summaries,
- tool cards,
- candidate cards,
- final decision cards,
- optional debug JSON.

This keeps the interface useful for operators without exposing hidden reasoning or forcing users to read raw logs.

## Why Auto Scout Exists

The sample notebook hardcoded `19609127` for Mexico vs South Africa. ORACLE's production behavior needs autonomy: it should inspect available World Cup markets and choose where analysis is most useful. Auto scout makes fixture selection data-driven and keeps manual fixture IDs as a debugging tool rather than the normal user flow.
