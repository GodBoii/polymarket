# Stair AI Tournament Context

This document captures the operating context for ORACLE inside the Stair AI World Cup Agent Arena. It is based on:

- `context.txt`
- `World-Cup-Arena-Public/worldcup-arena-sample-agent.ipynb`
- https://stair-ai.com/builder-guide
- https://stair-ai.com/api
- https://stair-ai.gitbook.io/stair-ai-docs
- https://stair-ai.com/builder-guide#data
- https://stair-ai.com/builder-guide#data-sportmonks
- https://stair-ai.com/builder-guide#data-supabase
- https://stair-ai.com/builder-guide#data-polymarket

## Arena Contract

The agent runs on our infrastructure. Stair AI provides the tournament, data access, a custodial wallet, order endpoints, and a reasoning ledger. The agent is responsible for:

1. Reading the available data feeds.
2. Producing a probability distribution over match outcomes.
3. Deciding whether the market is mispriced.
4. Opening an order when there is enough edge.
5. Submitting a reasoning ledger for audit/scoring.

The builder guide describes two scoring surfaces:

- Prediction skill, scored against actual match outcomes.
- Reasoning quality, scored from the submitted ledger trace.

The guide describes two prediction windows per fixture:

- `PRE_MATCH`: before kickoff.
- `HT`: halftime window, roughly kickoff + 45 minutes through kickoff + 60 minutes.

The latest valid prediction in a window is the one that matters for scoring.

## Authentication

Stair uses one arena key per agent.

- Header: `x-api-key: <ARENA_KEY>`
- One key maps to one arena agent identity.
- Ledger records omit `agent_id`; Stair injects it server-side from the API key.

The backend already follows this pattern through `arena_headers()` in `python-backend/config.py`.

## Provider Model

Stair exposes three data providers for the agent loop:

### Sportmonks

Sportmonks is accessed through Stair's domain-swap proxy:

```text
https://api.sportmonks.com/v3/football/<path>
```

becomes:

```text
https://stair-ai.com/api/v1/data/proxy/sportmonks/v3/football/<path>
```

Auth changes from Sportmonks token auth to:

```text
x-api-key: <ARENA_KEY>
```

Stair's builder guide says every Sportmonks Football v3 path should work under this proxy with the same query params. This means ORACLE should prefer building richer Sportmonks calls through the proxy instead of storing a separate Sportmonks token.

Current tournament constants:

- World Cup 2026 season id: `26618`
- World Cup 2026 league id: `732`

Sportmonks is the source for:

- schedules
- fixtures
- teams/participants
- kickoff time
- lineups
- live scores
- pre-match ML predictions
- bookmaker odds
- expected goals
- match state/events/statistics when live or completed

### Supabase

Stair serves an aggregated World Cup dataset through Supabase/PostgREST.

Base URL:

```text
https://ezvbmtvrvzageqixvdak.supabase.co/rest/v1/<table>
```

Headers:

```text
apikey: <shared publishable key>
Accept-Profile: world_cup_arena
```

The catalog tables live in the default public schema, so they should be queried without `Accept-Profile`.

Important catalog entities:

- `catalog_tables`
- `catalog_columns`
- `catalog_full`

Data categories:

- `ads_a_*`: historical priors aggregated from StatsBomb event data.
- `d_*`: live or checkpoint snapshots built from Sportmonks during the tournament.
- `sm_*`: Sportmonks-related match metadata/stat snapshots.

The current code uses a subset of `ads_a_*` tables. It does not yet deeply use the live `d_*` and `sm_*` tables.

### Polymarket

Stair fronts Polymarket with arena-authenticated endpoints:

- `/api/v1/web/mapping?fixture_id=...`
- `/api/v1/data/proxy/polymarket-gamma/events?slug=...`
- `/api/v1/data/proxy/polymarket-clob/midpoint?token_id=...`

The mapping endpoint connects Sportmonks fixture IDs to Polymarket event slugs. Gamma provides market metadata and token IDs. CLOB midpoint provides live implied prices.

World Cup fixture markets are modeled as three correlated YES/NO markets:

- home win
- draw
- away win

## Orders

The current arena order API supports opening a position. The sample notebook and current backend use:

```text
POST /api/v1/arena/orders
```

Payload shape:

```json
{
  "fixture_id": "19609127",
  "team_code": "MEX",
  "usd_size": "1.00",
  "limit_price": 0.68,
  "time_in_force_seconds": 30,
  "idempotency_key": "<uuid>"
}
```

Important execution detail:

- The current Stair arena order payload is buy-YES oriented: it takes `fixture_id` and `team_code`, not an explicit side or NO-token id.
- This does not mean the strategy should only analyze the favorite or only look for home-team longs.
- For a three-outcome football market, fading an overpriced outcome can often be expressed by buying YES on one of the underpriced alternatives (`home`, `draw`, or `away`).
- ORACLE should evaluate all three YES outcomes and choose the highest positive-edge executable buy-YES candidate.
- If Stair later exposes explicit sell/NO-token order support, the execution layer can be extended to submit true shorts directly.

## Reasoning Ledger

Stair expects a typed ledger trace covering the decision cycle.

Relevant behavior types:

- `Observing`: trigger/wakeup.
- `ToolCalling`: external provider calls.
- `Thinking`: LLM digests/reasoning summaries.
- `Acting`: prediction commitment and order/skip action.
- `Planning`, `Reflecting`, `Other`: optional.

The sample notebook builds a 14-record pre-match trace. The current backend mirrors this shape through `python-backend/ledger.py` and `pipeline.py`.

Prediction scoring is attached to an `Acting` record with:

```text
action_type = "prediction"
```

The current backend already emits this after the prediction agent returns.

## Implications For ORACLE

ORACLE should be treated as a staged tournament agent, not a generic sports dashboard.

Near-term priorities:

1. Make Sportmonks data extraction deterministic.
2. Keep Polymarket market prices out of the prediction agent.
3. Compare independent prediction probabilities to Polymarket only in strategy.
4. Submit ledger records that clearly show source data, derived features, prediction, and order logic.
5. Add HT/live support later using Sportmonks livescores and Supabase `d_*` checkpoint tables.

The first Sportmonks improvement is now implemented in `python-backend/sportmonks_features.py`.
