# Polymarket Agent Analysis

Date: 2026-06-07

## Scope

Reviewed:

- Polymarket Python SDK docs
- Polymarket market-maker trading docs
- Stair AI builder guide Polymarket section
- Stair AI live endpoints for listings, fixture markets, settlement, and exposure
- Current ORACLE code paths in `python-backend/toolkits.py`, `pipeline.py`, `agents.py`, `strategy_features.py`, and tests

## Current Implementation

ORACLE currently uses Polymarket in four places:

1. `GET /api/v1/web/mapping?fixture_id=...`
   - maps a Sportmonks fixture ID to a Polymarket event slug.

2. `GET /api/v1/data/proxy/polymarket-gamma/events?slug=...`
   - fetches Polymarket Gamma event metadata and nested winner markets.
   - `build_moneyline_from_gamma()` extracts:
     - question/title
     - condition ID
     - CLOB token IDs
     - YES token ID
     - NO token ID

3. `GET /api/v1/data/proxy/polymarket-clob/midpoint?token_id=...`
   - fetches one midpoint per YES token.
   - the agent treats midpoint as market-implied probability.

4. `POST /api/v1/arena/orders`
   - submits a Stair arena buy-YES order using:
     - `fixture_code`
     - `team_code`
     - `usd_size`
     - `limit_price`
     - `time_in_force_seconds`
     - `idempotency_key`

The latest Stair read endpoints are also already wrapped in `ArenaTradingToolkit`:

- `GET /api/v1/arena/exposure`
- `GET /api/v1/arena/orders/{order_id}`
- `POST /api/v1/arena/orders/{order_id}/close`

But the prediction pipeline does not yet use exposure, status polling, settlement, or close-order logic in decision making.

## Stair AI Live Endpoint Shapes

Observed with the local arena key:

### Listings

`GET /api/v1/data/polymarket/listings`

Returns:

```json
{
  "fixtures": [
    {"fixture_code": "19609127"}
  ]
}
```

This is a better fixture-market availability source than repeatedly calling the older mapping endpoint during scout.

### Normalized Fixture Market

`GET /api/v1/data/polymarket/markets/{fixture_code}`

For `19609127`, returns:

```json
{
  "fixture_code": "19609127",
  "kickoff_at": 1781204400000,
  "polymarket_event_slug": "fifwc-mex-rsa-2026-06-11",
  "outcomes": [
    {
      "name": "MEX",
      "condition_id": "...",
      "token_id": "...",
      "mid_price": 0.685
    },
    {
      "name": "ZAF",
      "condition_id": "...",
      "token_id": "...",
      "mid_price": 0.105
    },
    {
      "name": "draw",
      "condition_id": "...",
      "token_id": "...",
      "mid_price": 0.205
    }
  ]
}
```

This normalized endpoint already contains exactly what the Polymarket Market Agent needs for the core World Cup 1X2 trade:

- fixture code
- outcome names
- condition IDs
- YES token IDs
- mid prices
- event slug
- kickoff timestamp

### Settlement

`GET /api/v1/data/polymarket/markets/{fixture_code}/settlement`

For an unresolved match, returns:

```json
{
  "fixture_code": "19609127",
  "status": "pending",
  "settled_outcome": null,
  "settled_at": null,
  "outcome_prices": {
    "MEX": null,
    "ZAF": null,
    "draw": null
  }
}
```

This should be used after matches and during post-run monitoring, not during pre-match prediction unless status is no longer pending.

### Exposure

`GET /api/v1/arena/exposure`

Current account response:

```json
{
  "positions": []
}
```

This is currently unused in strategy. That is a major gap because the agent can open duplicate/additive positions on the same fixture without considering existing exposure.

## Important Polymarket Mechanics From Docs

Polymarket's current Python SDK exposes public clients for discovery/market data and secure clients for authenticated trading. The docs emphasize structured model objects, Decimal-like precision handling, pagination, SDK exceptions, order books, current prices, historical prices, and batch quotes.

The SDK supports realtime streams for market books, price changes, last-trade prices, best bid/ask, market resolution, and user order/trade events.

For trading, Polymarket supports limit orders, expiring limit orders, market orders, create-then-post flows, batch orders, order management, and position lifecycle methods. The docs explicitly warn that live order snippets submit real orders and transactions.

Market-maker docs emphasize:

- two-sided quoting around fair value
- batch order submission
- GTC/GTD/FOK/FAK order types
- cancelling stale quotes
- monitoring open orders
- tick-size compliance
- fee awareness
- inventory-aware quote skew
- price guards against midpoint/book outliers
- kill switch behavior
- realtime fill monitoring

In the Stair arena, we should not assume all native Polymarket actions are available. Stair currently gives a simplified arena order wrapper, and the builder guide says the main action is opening a buy-YES position. Newer endpoints now expose exposure, order status, close, market listings, normalized markets, and settlement.

## Current Gaps

### 1. We Use Midpoint Only

Current edge uses:

```text
agent probability - midpoint
```

But midpoint is not necessarily executable. A wide or empty book can show an attractive midpoint while the actual ask is too expensive or liquidity is tiny.

Needed:

- best bid
- best ask
- spread
- ask depth near the selected limit
- last trade price
- stale quote detection

### 2. No Spread or Liquidity Quality

The Strategy Agent does not know whether a market is liquid. It should not treat:

```text
mid=0.105, spread=0.02
```

the same as:

```text
mid=0.105, spread=0.25
```

Needed derived fields:

- `spread`
- `relative_spread`
- `best_bid`
- `best_ask`
- `top_ask_size`
- `depth_to_5_usdc`
- `liquidity_grade`

### 3. No Tick-Size Handling

The Strategy Agent may return a limit price that does not conform to Polymarket tick size. Polymarket docs warn orders can be rejected when price does not match tick size.

Needed:

- fetch tick size through CLOB proxy if Stair allows it
- otherwise infer conservative tick from price bands only if documented
- round down buy limits to valid ticks
- include `limit_price_rounded`

### 4. No Exposure-Aware Strategy

The toolkit can call `GET /arena/exposure`, but the pipeline does not use it before placing orders.

Needed:

- fetch exposure before strategy
- attach current positions to strategy context
- avoid adding to an already large same-outcome position
- avoid accidental duplicate orders
- allow close/hedge analysis when a position exists and market moved

### 5. No Order Lifecycle

Current execution submits once and stops. The agent does not:

- poll order status
- detect unfilled/partial/filled
- cancel or close stale orders
- record fill details
- update ledger with final execution status

Needed:

- post-submit polling loop for `GET /arena/orders/{order_id}`
- final execution summary
- optional close-order workflow where supported

### 6. No Settlement Monitoring

Settlement endpoint is available but unused.

Needed:

- post-match monitor
- settled outcome reconciliation
- prediction-vs-market-vs-PnL report
- learning record for calibration

### 7. Scout Still Uses Older Mapping Flow

Scout currently loops through schedule candidates, calls mapping, then Gamma, then midpoint. Stair now provides `GET /data/polymarket/listings`, which returns available fixture codes directly.

Needed:

- use listings as the first market-availability filter
- only score Sportmonks fixtures that have a listed Polymarket market
- call normalized market endpoint directly for market count and prices
- keep old mapping/Gamma path as fallback/audit

### 8. Gamma Parsing Is Too Loose

`build_moneyline_from_gamma()` extracts all nested markets and assumes the first token is YES. This worked for the current winner markets, but it should validate:

- event is the intended fixture
- market question/outcome maps to MEX/ZAF/draw
- market is active/open
- `clobTokenIds` has exactly YES/NO shape
- condition IDs are present

The normalized Stair market endpoint is safer for the core arena order path.

### 9. No Market Movement Features

The Polymarket Market Agent currently sees one snapshot. It cannot know:

- whether price moved sharply
- whether Sportmonks/bookmaker odds disagree only because Polymarket moved
- whether the price is stale
- whether a big drift happened after team-news or lineup release

Needed:

- CLOB price history or repeated local snapshots
- last-trade price
- time-series feature: opening/mid/current delta
- drift versus Sportmonks bookmaker consensus

### 10. No Arbitrage/Normalization Checks

For three mutually exclusive outcomes, market prices should be treated as a set. Current code stores `sum_implied_probability`, but strategy does not deeply use it.

Needed:

- check sum of YES mids
- normalize market-implied probabilities when sum differs materially from 1
- distinguish raw midpoint edge from normalized-market edge
- flag inconsistent/stale outcome set

## Recommended Implementation Plan

### Phase 1: Deterministic Polymarket Feature Layer

Add:

```text
python-backend/polymarket_features.py
```

Responsibilities:

- normalize Stair market endpoint shape
- normalize Gamma fallback shape
- build outcome map `{MEX, draw, ZAF}`
- derive:
  - raw mid probabilities
  - normalized implied probabilities
  - sum of mids
  - condition IDs
  - YES token IDs
  - market availability flags
  - stale/missing pricing flags

This should reduce pressure on the LLM to parse raw market arrays.

### Phase 2: Use Stair Normalized Market Endpoint First

Update `build_polymarket_context()`:

1. Call `GET /data/polymarket/markets/{fixture_code}` first.
2. Use the normalized `outcomes` array as the main execution source.
3. Keep mapping + Gamma + CLOB midpoint as fallback/audit.
4. Include both raw and decoded features in context.

### Phase 3: Exposure-Aware Strategy

Before the Strategy Agent:

1. Call `GET /arena/exposure?fixture_code=...`.
2. Add exposure to `strategy_context`.
3. Prompt the Strategy Agent to:
   - avoid duplicate exposure
   - size down when already exposed
   - consider no-trade when exposure is already aligned
   - consider close/hedge if existing position conflicts with updated thesis

Do not hard-code hidden overrides. Make exposure deterministic and visible to the agent.

### Phase 4: Execution Lifecycle

After order submission:

1. Capture `order_id`.
2. Poll `GET /arena/orders/{order_id}` until filled/unfilled/expired or timeout.
3. Record:
   - requested limit
   - filled price
   - filled size
   - unfilled amount
   - final status
4. Write an Acting/ToolCalling ledger entry with execution result.

### Phase 5: Settlement Monitor

Add a post-match command/job:

```text
python pipeline.py --settlement-check --fixture-code 19609127
```

It should fetch:

- settlement endpoint
- exposure/orders if available
- final prediction record
- final PnL/result summary

### Phase 6: Order Book/Spread If Proxy Allows It

Use the Stair proxy to Polymarket CLOB:

- `/book`
- `/midpoint`
- `/spread`
- `/last_trade_price`
- `/prices-history`
- `/tick-size`

If Stair does not allow these exact proxy paths, request they expose them or add fallback through official SDK only for local analysis, not arena-authenticated trading.

### Phase 7: Better Strategy Prompt

Add instructions:

- use executable ask/liquidity when available, not midpoint alone
- if only midpoint is available, lower confidence
- do not place a trade when spread is wide or price is stale unless the edge is much larger than execution uncertainty
- compare edge against:
  - spread
  - fees
  - tick rounding
  - existing exposure
  - ML/factual confidence

## Highest-Impact Next Code Changes

Implemented:

1. Added `python-backend/polymarket_features.py`.
2. Prefer Stair normalized market endpoint in `build_polymarket_context()`.
3. Added `get_polymarket_listings()` to `ArenaDataToolkit` and use it in scout.
4. Added exposure fetch before strategy and pass it into `build_strategy_context()`.
5. Added post-submit order-status polling in `python-backend/order_execution.py`.
6. Updated Polymarket digest schema and deterministic normalization to include `market_quality`, `normalized_implied_probabilities`, `raw_mid_sum`, `execution_handles`, and `data_gaps`.

Still pending:

1. Add order-book/spread/depth/tick-size fetching if Stair proxy exposes those CLOB paths.
2. Add settlement monitor command.
3. Add close-position strategy when existing exposure conflicts with updated thesis.

## Bottom Line

The current Polymarket integration is enough to find a fixture, read mid prices, and place a simple buy-YES arena order. It is not yet strong enough for high-quality trading decisions because it treats midpoint as executable truth and ignores exposure, spread, liquidity, tick size, order status, and settlement lifecycle.

The next improvement should mirror what we did for Sportmonks and Supabase: create a deterministic Polymarket feature layer, reduce LLM parsing, and give the Strategy Agent a factual market-quality context before it decides.
