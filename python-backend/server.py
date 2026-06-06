import asyncio
import json
import uuid
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

from config import DEFAULT_FIXTURE_ID, load_env
from pipeline import run_pipeline
from store import SupabaseRunStore


load_env()

app = FastAPI(title="Polymarket Arena Agent Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    fixture_id: int = DEFAULT_FIXTURE_ID
    dry_run: bool = True


def store() -> SupabaseRunStore:
    return SupabaseRunStore()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/runs")
def list_runs() -> list[dict[str, Any]]:
    try:
        return store().list_runs()
    except requests.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Supabase run tables are not ready. Run supabase_schema.sql once. Upstream: {exc.response.text[:500]}",
        ) from exc


@app.get("/runs/{run_id}")
def get_run(run_id: str) -> dict[str, Any]:
    s = store()
    try:
        run = s.get_run(run_id)
        run["events"] = s.get_events(run_id)
        return run
    except requests.HTTPError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Supabase run tables are not ready. Run supabase_schema.sql once. Upstream: {exc.response.text[:500]}",
        ) from exc


@app.post("/runs")
def create_run(request: RunRequest) -> dict[str, Any]:
    run_id = str(uuid.uuid4())
    s = store()
    s.create_run(run_id, request.fixture_id)
    result = run_pipeline(request.fixture_id, dry_run=request.dry_run, event_sink=lambda *_args, **_kwargs: None)
    s.update_run(run_id, status="completed", fixture=result.get("fixture"), result=result)
    return {"id": run_id, "status": "completed", "result": result}


@app.websocket("/ws/runs")
async def websocket_run(websocket: WebSocket) -> None:
    await websocket.accept()
    s = store()
    try:
        message = await websocket.receive_json()
        fixture_id = int(message.get("fixture_id") or DEFAULT_FIXTURE_ID)
        dry_run = bool(message.get("dry_run", True))
        run_id = str(uuid.uuid4())
        s.create_run(run_id, fixture_id)
        await websocket.send_json({"type": "run_started", "run_id": run_id, "fixture_id": fixture_id})

        def emit(event_type: str, stage: str, payload: dict[str, Any]) -> None:
            s.add_event(run_id, event_type, stage, payload)
            # Called from the worker thread; schedule the WebSocket send on the event loop.
            asyncio.run_coroutine_threadsafe(
                websocket.send_json({"type": event_type, "run_id": run_id, "stage": stage, "payload": payload}),
                loop,
            )

        loop = asyncio.get_running_loop()
        result = await asyncio.to_thread(run_pipeline, fixture_id, dry_run, emit)
        s.update_run(run_id, status="completed", fixture=result.get("fixture"), result=result)
        await websocket.send_json({"type": "run_completed", "run_id": run_id, "result": result})
    except WebSocketDisconnect:
        return
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
        except Exception:
            pass
