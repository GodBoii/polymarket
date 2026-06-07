# Strategy Agent Execution Notes

This document captures the strategy issue found in the `docker_logs.txt` run from June 7, 2026.

## Observed Run

Run details:

- Session: `prematch:19609127:20260607T065653Z`
- Fixture: Mexico vs South Africa
- Model: `deepseek/deepseek-v4-flash`

The prediction agent produced:

```json
{
  "probabilities": {
    "home": 0.41,
    "draw": 0.28,
    "away": 0.31
  }
}
```

The Polymarket digest produced:

```json
{
  "implied_probabilities": {
    "MEX": 0.685,
    "draw": 0.205,
    "ZAF": 0.105
  }
}
```

The old strategy prompt only compared the chosen prediction outcome, Mexico home win, against its market price:

```text
MEX edge = 0.41 - 0.685 = -27.5 percentage points
```

It then concluded "short MEX, but shorts are not allowed, so no trade."

## Why That Was Incomplete

The strategy should evaluate every executable outcome, not only the most likely predicted outcome.

For this run, the full edge table is:

| Outcome | Prediction | Market | Edge |
| --- | ---: | ---: | ---: |
| MEX | 0.410 | 0.685 | -27.5 pp |
| draw | 0.280 | 0.205 | +7.5 pp |
| ZAF | 0.310 | 0.105 | +20.5 pp |

So the agent's view is not merely "short Mexico." It also implies that South Africa YES and draw YES are underpriced relative to the agent's probabilities.

Because Stair's current arena order payload is buy-YES oriented, the executable expression of the fade should be:

- buy YES on the best positive-edge alternative, or
- skip if confidence/data quality is too low.

In this example, the best positive-edge executable candidate is:

```json
{
  "team_code": "ZAF",
  "edge_pp": 20.5
}
```

The agent may still choose no trade because of low confidence or missing data, but it should not skip solely because Mexico is overvalued.

## Implemented Change

Added:

```text
python-backend/strategy_features.py
```

This module builds a deterministic strategy context with:

- `outcome_mapping`
- `edge_table`
- `best_buy_yes`
- `order_capability`

The strategy prompt now receives this context and is instructed to:

- evaluate all outcomes
- buy YES only on positive-edge outcomes
- express fades through underpriced alternatives when possible
- discuss short/fade logic in rationale, but submit executable orders as `direction="long"` with a valid `team_code`

## Tests

Added:

```text
tests/test_strategy_features.py
```

The tests cover the exact Mexico vs South Africa situation:

- MEX YES has negative edge.
- draw YES has positive edge.
- ZAF YES has the largest positive edge.
- model `home/draw/away` probabilities map correctly to market `MEX/draw/ZAF`.

Verification:

```text
python -m pytest tests/test_strategy_features.py tests/test_sportmonks_features.py tests/test_scout_logic.py tests/test_country_resolution.py tests/test_ledger_sink.py
```

Current result:

```text
11 passed
```

## Future Extension

If Stair adds explicit side/NO-token support to the arena order API, ORACLE should extend the execution layer to support:

- buy YES
- buy NO
- sell/close
- true short/fade execution

Until then, the safest executable behavior is to buy YES on the underpriced outcome with the best positive edge.
