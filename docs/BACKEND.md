# Backend Guide

The backend is a FastAPI service that runs the Agno/MiMo multi-agent pipeline and streams live run events to the frontend over WebSocket.

## Run Locally

From the repository root:

```powershell
docker compose up --build
```

Backend health:

```text
http://localhost:8001/health
```

Expected response:

```json
{"status":"ok"}
```

## Environment

Backend secrets live in `.env`, which is ignored by git.

Required:

```text
ARENA_KEY
MIMO_API_KEY
SUPABASE_APP_URL
SUPABASE_APP_ANON_KEY
SUPABASE_APP_SERVICE_ROLE_KEY
```

Local frontend values:

```text
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_WS_URL=ws://localhost:8001
```

## API

`GET /health`

Returns backend health.

`GET /runs`

Returns past agent runs. Uses Supabase if available, otherwise local JSON fallback.

`GET /runs/{run_id}`

Returns a run and its events.

`POST /runs`

Runs the pipeline synchronously. This is useful for API testing but not ideal for the UI because it waits until the full pipeline finishes.

`WebSocket /ws/runs`

Starts a live run and streams stage events. Default auto-scout payload:

```json
{"mode":"auto","dry_run":true}
```

Manual fixture override:

```json
{"mode":"manual","fixture_id":19609127,"dry_run":true}
```

Legacy payloads with only `fixture_id` are treated as manual mode.

The first message is:

```json
{"type":"run_started","run_id":"...","fixture_id":19609127}
```

During execution the backend streams low-level and UI-friendly events:

- `stage_started`
- `tool_result`
- `token`
- `stage_completed`
- `chat_message`
- `tool_call_started`
- `tool_call_completed`
- `candidate_ranked`
- `fixture_selected`
- `decision`
- `ledger_record`
- `run_completed`
- `error`

See [Working](working.md) for the full Polycognitive agent flow.

## Storage

Primary storage:

```text
Supabase project: https://cpllxtdeskxeevmknwrc.supabase.co
```

Tables:

- `agent_runs`
- `agent_events`

Run `supabase_schema.sql` once in Supabase SQL editor to create them.

Fallback storage:

```text
python-backend/storage/app_runs.json
```

Agno session storage:

```text
python-backend/storage/json_db/agno_sessions.json
```

## Orders

The pipeline defaults to dry-run order execution. Real orders are only enabled when `dry_run=false` reaches `ArenaTradingToolkit`.

Do not enable live orders until:

- data digests are stable,
- strategy output is validated,
- bankroll rules are final,
- and ledger submission has been tested.

## Important Ports

The backend container exposes internal port `8000`, but Docker Compose maps it to host port `8001` because another local service was already using `8000`.

Use:

```text
http://localhost:8001
```
