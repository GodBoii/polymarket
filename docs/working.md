# Working

## Runtime Flow

The dashboard opens a WebSocket to the FastAPI backend:

```text
ws://localhost:8001/ws/runs
```

Default launch payload:

```json
{"mode":"auto","dry_run":true}
```

Manual override payload:

```json
{"mode":"manual","fixture_id":19609127,"dry_run":true}
```

## Auto Scout

Auto mode starts by fetching the SportMonks World Cup 2026 schedule. The backend flattens stages and rounds into a single fixture list, filters to named-team fixtures, then checks the first upcoming candidates for:

- Polymarket mapping availability,
- Polymarket Gamma markets,
- CLOB midpoint availability,
- SportMonks prediction row count,
- SportMonks odds row count.

Each candidate gets a score. The highest-ranked candidate becomes the selected fixture for deeper analysis.

## Deep Analysis

Once a fixture is selected, the backend gathers:

- SportMonks fixture context: participants, predictions, odds, xG when available, and richer context when accepted by the proxy.
- Polymarket context: arena mapping, Gamma event data, token IDs, and CLOB midpoints.
- Supabase priors: historical country/team aggregates and head-to-head rows.

SportMonks participant `country_id` values are the primary Supabase join keys. Historical `dim_match` lookup is only a fallback.

## Agent Stages

The backend uses Agno/OpenRouter agents for structured JSON digests:

- Fixture Selector: normalizes the selected fixture.
- SportMonks Research Agent: summarizes football signals without market prices.
- Polymarket Market Agent: summarizes price and execution handles.
- Supabase Historical Agent: summarizes historical priors.
- Prediction Agent: estimates outcome probabilities without seeing market prices.
- Strategy Agent: compares prediction to market prices and decides trade/no-trade.

The prediction stage is intentionally separate from the market stage so the strategy stage can measure disagreement instead of copying the market.

## Stream Events

The backend still emits low-level events, but the dashboard primarily renders UI-friendly events:

- `chat_message`: readable assistant update.
- `tool_call_started`: provider/tool card begins.
- `tool_call_completed`: provider/tool card completes.
- `candidate_ranked`: auto-scout candidate score.
- `fixture_selected`: chosen match.
- `decision`: final prediction/trade summary.
- `ledger_record`: dry-run Reasoning Ledger record.

## Dry-Run vs Live

Dry-run is the default. In dry-run:

- no orders are submitted,
- no ledger batch is posted,
- ledger records are built and returned for inspection,
- order payloads are shown as simulated execution.

When `dry_run=false`, the executor may submit arena orders and the ledger sink posts records to the arena ledger batch endpoint.
