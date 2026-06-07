# Data Gathering Improvements

This document tracks the second data-gathering improvement pass after reviewing `docker_logs.txt`.

## Problem Observed

The logged run for Mexico vs South Africa showed:

```text
Sportmonks home country_id: 458
Sportmonks away country_id: 146
Supabase ads_a_* rows: empty
```

Earlier successful Supabase contexts used:

```text
Mexico country_id: 147
South Africa country_id: 211
```

So the failure was not that Supabase had no historical data. It was that Sportmonks participant `country_id` values were being used as if they were the same ID space as the arena/Supabase historical tables.

## Supabase Fix

Updated:

```text
python-backend/supabase_context.py
```

The resolver now:

1. Resolves team name/short code to arena country IDs first.
2. Preserves Sportmonks `country_id` as metadata.
3. Falls back to `dim_match` exact and fuzzy lookups.
4. Uses Sportmonks `country_id` only as a last-resort fallback.
5. Queries direct H2H in both country orderings.
6. Adds best-effort `sm_match_meta`, `sm_statistics_snapshot`, and `dim_match_lookup` rows.

For Mexico vs South Africa, the expected context now uses:

```json
{
  "home_country": {
    "country_id": 147,
    "resolution": {
      "source": "config_alias",
      "sportmonks_country_id": 458
    }
  },
  "away_country": {
    "country_id": 211,
    "resolution": {
      "source": "config_alias",
      "sportmonks_country_id": 146
    }
  }
}
```

This should restore the historical signals from:

- `ads_a_country_style`
- `ads_a_country_struct`
- `ads_a_ko_pattern`
- `ads_a_special_match`
- `ads_a_stage_record`
- `ads_a_h2h_country`

## Supabase Feature Extraction

Added:

```text
python-backend/supabase_features.py
```

The Supabase context now includes a deterministic `features` object alongside raw table rows.

Extracted fields include:

- resolved arena country IDs and original Sportmonks country IDs
- set-piece conversion rate
- group-stage goals conceded per game
- knockout-stage goals conceded per game
- group-stage win rate
- group-stage match count
- first knockout match loss rate
- modal exit stage
- extra-time win rate
- penalty shootout win rate
- direct H2H row count and rows
- data-quality row counts

This reduces pressure on the LLM to infer historical signals from raw table arrays.

## Sportmonks Enrichment

Updated:

```text
python-backend/toolkits.py
python-backend/pipeline.py
python-backend/agents.py
python-backend/supabase_features.py
```

New Sportmonks proxy methods:

- `get_sportmonks_head_to_head(home_team_id, away_team_id)`
- `get_sportmonks_live_standings(league_id)`

The fixture include now requests `league` and `metadata` as well:

```text
participants;league;predictions;odds;xGFixture;venue;metadata;lineups;sidelined;coaches;referees;stage;round
```

`metadata` is important because Sportmonks v3 weather can arrive through fixture metadata rather than a `weatherReport` include. The parser still accepts older `weatherreport` and `weather_report` keys for compatibility with cached runs.

The decoded Sportmonks feature layer now includes:

```json
{
  "factual_context": {
    "kickoff": "2026-06-11 19:00:00",
    "venue": {},
    "weather": {},
    "lineups_available": false,
    "sidelined_available": false,
    "coaches": [],
    "referees": [],
    "stage": {},
    "round": {}
  }
}
```

These fields are prioritized because they are factual match context: time, place, weather, team news, coaches, officials, formation/lineup availability, and sidelined players.

The pipeline adds a best-effort `enrichment` block to the Sportmonks context:

```json
{
  "enrichment": {
    "head_to_head": {
      "available": true,
      "fixture_count": 5,
      "fixtures": []
    },
    "live_standings": {
      "available": true,
      "league_id": 732,
      "row_count": 48,
      "rows": []
    }
  }
}
```

If a proxy endpoint fails or the plan does not expose the data, the context records:

```json
{
  "available": false,
  "error": "HTTPError: ..."
}
```

The agent can then distinguish missing data from zero-valued evidence.

## Prompt Update

The Sportmonks digest prompt now explicitly instructs the agent to use:

- decoded `features`
- `features.factual_context`
- `enrichment.head_to_head`
- `enrichment.live_standings`

and to report:

- `head_to_head_summary`
- `standings_summary`

## StatsBomb Open-Data Fallback

Added:

```text
python-backend/statsbomb_context.py
```

The Supabase context now attaches `statsbomb_open_data` as an optional historical fallback. It reads a local StatsBomb open-data checkout from:

```text
data/statsbomb-open-data/data
```

or from:

```text
STATSBOMB_OPEN_DATA_DIR
```

If no checkout exists, the run does not fail. The context returns a setup note telling the operator where to clone the repository.

Important mapping rule:

- StatsBomb open data is joined by explicit team-name aliases such as `Mexico`/`MEX` and `South Africa`/`ZAF`/`RSA`.
- It is never joined by numeric `country_id`.
- Sportmonks IDs, Supabase arena country IDs, and StatsBomb team/match IDs are separate ID spaces.

## Tests

Updated:

```text
tests/test_country_resolution.py
tests/test_supabase_features.py
```

The tests now verify that Mexico/South Africa resolve to arena/Supabase IDs `147/211`, while keeping Sportmonks IDs `458/146` in metadata, and that core historical priors are extracted into deterministic features.

Verification:

```text
python -m pytest tests/test_supabase_features.py tests/test_country_resolution.py tests/test_sportmonks_features.py tests/test_strategy_features.py tests/test_scout_logic.py tests/test_ledger_sink.py
```

Current result:

```text
12 passed
```

## Next Step

The next useful improvement is to broaden Sportmonks recent-form collection and combine it with Supabase `d_*` checkpoint snapshots once live or halftime windows are active.
