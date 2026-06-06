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
