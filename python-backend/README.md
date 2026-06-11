# Python Backend

This backend runs the recommended World Cup Arena architecture:

1. Fixture Selector
2. Sportmonks Research Agent
3. Polymarket Market Agent
4. Supabase Historical Agent
5. Prediction Agent
6. Strategy Agent
7. Executor
8. Ledger Writer

The executor and ledger writer default to dry-run mode.

## Local

```powershell
..\poly\Scripts\python.exe pipeline.py
```

## Docker

Build:

```powershell
docker build -t polymarket-python-backend .
```

Run from this folder:

```powershell
docker run --rm --env-file ..\.env -v ${PWD}\storage:/app/storage polymarket-python-backend
```

Live orders are disabled unless you pass:

```powershell
docker run --rm --env-file ..\.env -v ${PWD}\storage:/app/storage polymarket-python-backend python pipeline.py --live-order
```

## HTTP API Logs

Outbound API calls now log to stdout/stderr, so Docker Desktop shows the full request flow for Stair AI, Sportmonks proxy, Polymarket proxy, Supabase, and ledger endpoints.

Useful env vars:

- `BACKEND_HTTP_LOGS=true` to keep HTTP logs enabled. Set `false` to mute them.
- `BACKEND_LOG_LEVEL=INFO` to control log verbosity.
- `BACKEND_HTTP_PREVIEW_CHARS=700` to control how much of each response body preview is printed.

Example:

```powershell
docker run --rm --env-file ..\.env -e BACKEND_HTTP_LOGS=true -e BACKEND_LOG_LEVEL=INFO -v ${PWD}\storage:/app/storage polymarket-python-backend
```
