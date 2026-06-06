# Polymarket World Cup Arena Architecture

This project is an agentic research-and-trading system for the Stair AI World Cup Agent Arena. The goal is to separate football signal gathering, market signal gathering, historical-prior research, prediction, strategy, execution, and audit logging into clear stages.

## Core Idea

The system treats the Sportmonks fixture ID as the anchor identity for a match. From that single fixture ID, the backend resolves:

- football data from Sportmonks,
- market data from Polymarket,
- historical priors from Supabase,
- a prediction from MiMo through Agno,
- a strategy decision,
- an optional order,
- and a reasoning/audit trace.

The important design principle is that the prediction stage should be independent from the live market stage. The prediction agent should primarily see football and historical evidence. The strategy agent then compares that independent belief against Polymarket pricing to decide if there is an edge.

## Agent Flow

1. Fixture Selector
   - Input: target fixture ID or schedule.
   - Output: normalized fixture identity.

2. Sportmonks Research Agent
   - Input: fixture ID.
   - Output: pre-game football digest.
   - Data includes participants, kickoff, Sportmonks predictions, odds, and xG when available.

3. Polymarket Market Agent
   - Input: fixture ID / fixture code.
   - Output: market pricing digest.
   - Data includes event slug, market condition IDs, YES token IDs, and CLOB midpoints.

4. Supabase Historical Agent
   - Input: country identifiers.
   - Output: historical priors digest.
   - Data includes country style, structure, knockout patterns, stage records, special-match records, and head-to-head rows when available.

5. Prediction Agent
   - Input: Sportmonks digest + Supabase digest.
   - Output: independent probability prediction.

6. Strategy Agent
   - Input: prediction + Polymarket digest.
   - Output: trade/no-trade decision.

7. Executor
   - Input: strategy.
   - Output: dry-run order payload, real order response, or skipped trade.

8. Ledger Writer
   - Input: all prior stages.
   - Output: dry-run ledger records or submitted arena ledger batch.

## Provider Roles

Sportmonks answers: what is happening in football?

Supabase answers: what does tournament history suggest?

Polymarket answers: what does the market currently believe, and what can we trade?

MiMo + Agno answer: how do we turn messy provider data into structured reasoning outputs?

## Toolkits

The backend has three toolkit groups.

`ArenaDataToolkit`

- `get_sportmonks_schedule`
- `get_sportmonks_fixture`
- `get_polymarket_mapping`
- `get_polymarket_event`
- `get_polymarket_midpoint`
- `get_arena_polymarket_market`
- `get_supabase_catalog`
- `get_supabase_rows`

`ArenaTradingToolkit`

- `get_agent_profile`
- `get_exposure`
- `submit_order`
- `get_order_status`
- `close_order`

`ArenaLedgerToolkit`

- `submit_ledger_batch`

The data toolkit is safe for research agents. Trading tools should only be exposed to executor/bet agents.

## Local Demo Mode

For the local demo, backend runs on:

```text
http://localhost:8001
ws://localhost:8001/ws/runs
```

The frontend runs on:

```text
http://localhost:3000
```

The backend attempts to save runs/events to the new Supabase project. If the Supabase `agent_runs` and `agent_events` tables do not exist yet, it falls back to local JSON storage at:

```text
python-backend/storage/app_runs.json
```

This fallback exists so demos work even before Supabase schema setup is finished.

## Production Direction

For the deployed Vercel frontend to call the laptop backend, expose the backend through a public tunnel such as Cloudflare Tunnel. Then set:

```text
NEXT_PUBLIC_API_URL=https://your-public-backend-url
NEXT_PUBLIC_WS_URL=wss://your-public-backend-url
```

Keep the service-role Supabase key only in the backend environment. Never expose it to Vercel frontend code.
