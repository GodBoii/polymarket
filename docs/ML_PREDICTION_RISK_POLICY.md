# ML Prediction Risk Policy

This note was added after reviewing the run:

```text
prematch:19609127:20260607T074553Z
```

In that run, the agent correctly evaluated all outcomes and found a large positive edge on South Africa YES. The problem was not the all-outcome strategy logic. The problem was that the edge came mostly from disagreement between:

- Sportmonks full-time result ML probability
- Polymarket midpoint probability

That is not enough evidence by itself.

## Policy

Sportmonks ML predictions are treated as weak baseline/calibration only.

They must not become the primary reason for:

- a high-confidence prediction
- a max-size trade
- a trade when core non-ML context is missing

Core non-ML context includes:

- expected goals
- recent form
- lineups/team news
- injuries and sidelined players
- venue, kickoff time, weather, and travel/rest context
- H2H
- standings/group context
- Supabase historical priors
- trustworthy event/statistical snapshots

If those are missing and the prediction mostly cites Sportmonks ML probabilities, the agent should mark the run low-confidence and explain that the edge is not trade-grade unless it can cite independent factual support.

## Implemented Advisory

Added to:

```text
python-backend/strategy_features.py
```

The strategy context now includes an advisory object:

```json
{
  "ml_prediction_risk": {
    "level": "weak_ml_primary",
    "advisory": "Prediction appears primarily driven by Sportmonks ML probabilities while core non-ML context is missing. Treat the edge as unreliable unless the agent can cite stronger factual evidence."
  }
}
```

This is intentionally not a hard-coded override. The pipeline does not force `should_trade=false`, cap size, or remove `best_buy_yes` because of this advisory. The Strategy Agent receives the warning and must decide in its own rationale whether the factual evidence is good enough.

## Prompt Changes

The prediction prompt says:

- do not rely on Sportmonks ML as the primary basis
- treat Sportmonks ML as weak baseline/calibration
- if expected goals, form, lineups, H2H, standings, and historical priors are missing, confidence must be low
- do not create high-conviction probabilities from ML alone

The strategy prompt says:

- read `ml_prediction_risk` carefully
- Sportmonks ML probabilities are public and can manipulate humans or AI agents into overconfident analysis
- do not let an ML-only edge override missing factual evidence
- if a trade is still recommended, the rationale must cite factual, non-ML evidence

## StatsBomb Open Data Note

StatsBomb's open-data repository provides public football JSON data for research. Its README describes data organized into:

- `competitions.json`
- matches by competition/season
- events
- lineups
- selected 360 data
- documentation in the `doc` directory

Source: [StatsBomb open-data README](https://github.com/statsbomb/open-data/blob/master/README.md)

Important caution:

- StatsBomb, Sportmonks, and Stair/Supabase do not share country/team IDs.
- The integration in `python-backend/statsbomb_context.py` joins by explicit team-name aliases only.
- StatsBomb open data is a historical research source, not a replacement for live Sportmonks or Stair Supabase IDs.
- If insights are published or shared from StatsBomb data, credit StatsBomb per their README.

## Tests

Updated:

```text
tests/test_strategy_features.py
tests/test_statsbomb_context.py
```

Coverage:

- all-outcome edge selection still works
- ML-primary predictions with missing xG/H2H/standings/weather produce an advisory
- the advisory does not block `best_buy_yes` or cap size in code
- StatsBomb fallback joins Mexico/South Africa by aliases, not numeric IDs
