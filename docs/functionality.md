# Functionality

## What ORACLE Does

ORACLE is a World Cup prediction-market research console. Its main action is the **Polycognitive agent**: an AI-driven dry-run agent that searches upcoming World Cup football fixtures, finds the most useful Polymarket match market, gathers evidence, predicts the result, and decides whether a trade would be justified.

The product is not a sportsbook UI. It is an intelligence workspace for understanding what the market believes, what the football data suggests, and whether those two views disagree enough to matter.

## Main User Flow

1. The user opens `/dashboard`.
2. The user clicks **Polycognitive agent**.
3. The backend starts in `auto` mode by default.
4. The agent scans World Cup fixtures from SportMonks.
5. It checks which fixtures map to Polymarket markets.
6. It ranks candidate matches by timing, market availability, price availability, SportMonks predictions, and odds coverage.
7. It selects one fixture and performs deeper research.
8. The dashboard shows the run as a chat transcript:
   - assistant status messages,
   - tool-call cards,
   - candidate ranking cards,
   - ledger cards,
   - final prediction and trade/no-trade decision.
9. Raw JSON remains available only inside **Debug payload**.

## Manual Fixture Override

The dashboard includes an advanced manual override. When enabled, the frontend sends:

```json
{"mode":"manual","fixture_id":19609127,"dry_run":true}
```

Manual mode is useful for reproducible tests, demos, and debugging a known SportMonks fixture.

## Core Terms

**Fixture** means a scheduled football match. SportMonks uses fixture IDs as the stable match identity.

**SportMonks** is the football data provider. ORACLE uses it for schedules, teams, kickoff time, predictions, odds, and match context.

**Polymarket Gamma** is Polymarket's metadata/discovery API. ORACLE uses it to find event titles, markets, condition IDs, and token IDs.

**Polymarket CLOB** is the order book/pricing API. ORACLE uses midpoint prices as market-implied probabilities.

**Midpoint** is the price halfway between buy and sell quotes. A midpoint of `0.685` means the market roughly prices the outcome at `68.5%`.

**Supabase priors** are the arena-provided historical World Cup/tournament aggregate tables. ORACLE uses them for team style, stage records, knockout patterns, special-match history, and head-to-head context.

**Edge** is the agent's estimated probability minus the market-implied probability. A positive edge means the agent thinks the market may be underpricing an outcome.

**Dry-run** means ORACLE builds predictions, ledger records, and order payloads without submitting real trades or ledger writes.

**Reasoning Ledger** is the arena audit trail. ORACLE builds records for observing, tool calls, thinking summaries, predictions, and order decisions.
