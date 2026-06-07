# StatsBomb Open-Data Integration

## Purpose

Supabase `ads_a_*` tables are the preferred Stair-provided historical source. When those rows are missing or sparse for a matchup, the agent can use StatsBomb open data as an optional factual fallback for:

- historical match results
- competitions and seasons
- stage context
- stadium and referee when present
- manager names when present
- recent lineup/player lists when present
- direct H2H matches when available in open data

## Local Data

The reader looks for data at:

```text
data/statsbomb-open-data/data
```

or at:

```text
STATSBOMB_OPEN_DATA_DIR
```

Recommended setup:

```text
git clone --depth 1 https://github.com/statsbomb/open-data.git data/statsbomb-open-data
```

The agent does not require this checkout. If it is missing, `statsbomb_open_data.available=false` and the run continues.

## Mapping Rule

Do not join StatsBomb to Sportmonks or Supabase by numeric IDs.

The implementation in `python-backend/statsbomb_context.py` uses explicit team-name aliases only:

- Mexico: `Mexico`, `MEX`
- South Africa: `South Africa`, `ZAF`, `RSA`

Sportmonks participant IDs, Sportmonks country IDs, Supabase arena country IDs, and StatsBomb match/team IDs are separate ID spaces.

## Pipeline Location

`build_supabase_context()` attaches:

```json
{
  "statsbomb_open_data": {
    "available": true,
    "recent_matches": {},
    "head_to_head_matches": [],
    "lineups": {},
    "data_quality": {}
  }
}
```

The Supabase Historical Agent prompt tells the model to use this as an optional factual fallback when Supabase aggregates are missing, while preserving the ID warning.
