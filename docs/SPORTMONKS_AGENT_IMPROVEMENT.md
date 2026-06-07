# Sportmonks Agent Improvement Notes

This document tracks the Sportmonks-focused improvement path for ORACLE.

## Starting Point

Before this improvement pass, Sportmonks entered the prediction pipeline in two places:

- `ArenaDataToolkit.get_sportmonks_schedule()`
- `ArenaDataToolkit.get_sportmonks_fixture()`

The backend fetched fixture details with this preferred include string:

```text
participants;predictions;odds;xGFixture;venue;weatherReport;lineups;sidelined;coaches;referees;stage;round
```

If that failed, it fell back to:

```text
participants;predictions;odds;xGFixture
```

That gave the agent a large raw payload, but the prediction model had to infer too much from Sportmonks typed rows. The main risk was misreading `type_id` values. For example:

- `237` = `FULLTIME_RESULT_PROBABILITY`
- `233` = `FIRST_HALF_WINNER_PROBABILITY`
- `238` = `TEAM_TO_SCORE_FIRST_PROBABILITY`

Only `237` should drive the full-time 1X2 prediction. The others are useful supporting signals, but they must not be treated as full-time win/draw/loss.

## Implemented Change

Added:

```text
python-backend/sportmonks_features.py
```

The new feature layer converts raw Sportmonks fixture rows into stable model-facing fields.

### Prediction Features

The feature layer maps key prediction `type_id`s from the Sportmonks type dictionary into named concepts.

It currently extracts:

- `fulltime_result_probability`
- `btts_probability`
- `over_under_2_5_probability`
- `double_chance_probability`
- `team_to_score_first_probability`
- `correct_score_top`
- `model_quality`
- `prediction_types_seen`
- `typed_prediction_rows`

The most important output is:

```json
{
  "fulltime_result_probability": {
    "HOME_CODE": 0.4084,
    "draw": 0.2778,
    "AWAY_CODE": 0.3138
  }
}
```

This field is derived only from `FULLTIME_RESULT_PROBABILITY`, not from first-half or team-to-score-first rows.

### Odds Features

The feature layer now filters odds down to match-result markets before building consensus.

It extracts:

- `match_result_rows`
- `match_result_row_count`
- `match_result_bookmaker_count`
- `match_result_vig_free_consensus`
- `bookmaker_probabilities`

The consensus calculation:

1. Keeps only match-result/1X2 rows.
2. Maps labels to outcomes:
   - `1` = home team code
   - `X` = draw
   - `2` = away team code
3. Parses Sportmonks `probability` or decimal `value`.
4. Normalizes each bookmaker's outcome probabilities to remove bookmaker margin.
5. Averages normalized bookmaker probabilities into a consensus.

This is safer than passing `odds[:120]` to the LLM, because early odds rows can include player props, fouls, shots, scorer markets, and other non-1X2 markets.

### Expected Goals

The feature layer maps `xGFixture` rows by `participant_id`, returning team-code keyed xG:

```json
{
  "MEX": 1.62,
  "ZAF": 0.84
}
```

### Data Quality

The feature layer reports availability for:

- participants
- full-time result probability
- match-result odds
- expected goals
- lineups
- sidelined players
- weather

This helps the agent say what it actually knows instead of silently assuming that broad includes returned useful data.

## Pipeline Integration

`build_sportmonks_context()` now adds:

```json
{
  "features": { ... },
  "match_result_odds_rows": [...]
}
```

Raw `prediction_rows`, `odds_sample`, `xg_rows`, lineups, weather, and other fields are still preserved for auditability.

The Sportmonks digest prompt now tells the LLM:

- Prefer `features`.
- Use `features.predictions.fulltime_result_probability` for full-time outcome probabilities.
- Do not confuse first-half winner or team-to-score-first with full-time result.
- Use `features.odds.match_result_vig_free_consensus` for bookmaker consensus.
- Use raw rows only as audit/detail context.

The Sportmonks digest schema now includes:

- `bookmaker_consensus_probabilities`
- `expected_goals`

## Tests

Added:

```text
tests/test_sportmonks_features.py
```

Coverage:

- Full-time result probability uses type `237`, not type `233`.
- Match-result odds filtering excludes player prop rows.
- Bookmaker consensus removes vig before averaging.
- xG rows map participant IDs to team codes.

Also added:

```text
tests/conftest.py
```

This makes `python-backend` importable during direct pytest runs.

Focused verification command:

```text
python -m pytest tests/test_sportmonks_features.py tests/test_scout_logic.py
```

Current result:

```text
6 passed
```

## Why This Matters

The prediction system previously relied heavily on the LLM to interpret Sportmonks rows. That is brittle because Sportmonks uses numeric `type_id`s, and several probability rows have similar shapes but different meanings.

The new layer gives the model a clean distinction between:

- full-time result probability
- first-half result probability
- team-to-score-first probability
- totals
- BTTS
- correct score
- bookmaker consensus
- expected goals

That should reduce hallucinated or incorrectly weighted signals.

## Next Sportmonks Improvements

Recommended order:

1. Add Sportmonks H2H fetching:
   - `/fixtures/head-to-head/{team1_id}/{team2_id}`
   - last 5 or last 10 direct meetings

2. Add recent form by team:
   - recent fixtures for each team
   - goals for/against
   - xG for/against when available
   - clean sheets
   - quality of opposition if available

3. Add standings/group context:
   - group position
   - points
   - goal difference
   - qualification incentive
   - matchday pressure

4. Add lineup and availability modeling:
   - expected/confirmed lineups
   - sidelined players
   - player position
   - approximate starter loss count

5. Add referee and weather features:
   - referee card/penalty tendency if historical rows are available
   - temperature/wind/rain adjustments

6. Add live/HT mode:
   - `/livescores/latest`
   - `/livescores/inplay`
   - events
   - periods
   - in-play statistics
   - Supabase `d_*` checkpoint snapshots

7. Add richer odds handling:
   - compare Sportmonks bookmaker consensus to Polymarket midpoint
   - track stale odds through `latest_bookmaker_update`
   - separate market families: 1X2, double chance, totals, BTTS, handicap

## Caution

Sportmonks data availability depends on subscription/proxy support and fixture timing. Broad includes may return empty arrays before lineups are published or may fail under the proxy and trigger the fallback include set.

The agent should treat missing data as signal quality information, not as zero-valued football evidence.
