import asyncio
import json
import os
import uuid
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

from config import DEFAULT_FIXTURE_ID, load_env
from http_logging import setup_backend_logging
from pipeline import run_pipeline
from store import SupabaseRunStore


load_env()
setup_backend_logging()

app = FastAPI(title="Polymarket Arena Agent Backend")
allowed_origins = [
    "http://localhost:3000",
    "https://polymarket-six-eta.vercel.app",
]
extra_origin = os.environ.get("FRONTEND_ORIGIN")
if extra_origin:
    allowed_origins.append(extra_origin.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    mode: str = "auto"
    fixture_id: int | None = None
    dry_run: bool = True


def live_orders_enabled() -> bool:
    return os.environ.get("ALLOW_LIVE_ORDERS", "").strip().lower() in {"1", "true", "yes", "on"}


def require_live_order_permission(dry_run: bool) -> None:
    if not dry_run and not live_orders_enabled():
        raise HTTPException(
            status_code=403,
            detail="Live Stair AI orders are disabled on this backend. Set ALLOW_LIVE_ORDERS=true only for an intentional production launch.",
        )


def store() -> SupabaseRunStore:
    return SupabaseRunStore()


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "live_orders_enabled": live_orders_enabled(),
    }


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
    require_live_order_permission(request.dry_run)
    run_id = str(uuid.uuid4())
    s = store()
    initial_fixture_id = request.fixture_id or 0
    s.create_run(run_id, initial_fixture_id, mode=request.mode)
    result = run_pipeline(request.fixture_id, dry_run=request.dry_run, mode=request.mode, event_sink=lambda *_args, **_kwargs: None)
    s.update_run(run_id, status="completed", fixture=result.get("fixture"), result=result)
    return {"id": run_id, "status": "completed", "result": result}


@app.websocket("/ws/runs")
async def websocket_run(websocket: WebSocket) -> None:
    await websocket.accept()
    s = store()
    try:
        message = await websocket.receive_json()
        mode = str(message.get("mode") or ("manual" if message.get("fixture_id") else "auto"))
        fixture_id = int(message["fixture_id"]) if message.get("fixture_id") else None
        dry_run = bool(message.get("dry_run", True))
        require_live_order_permission(dry_run)
        run_id = str(uuid.uuid4())
        s.create_run(run_id, fixture_id or 0, mode=mode)
        await websocket.send_json({"type": "run_started", "run_id": run_id, "fixture_id": fixture_id, "mode": mode})

        def emit(event_type: str, stage: str, payload: dict[str, Any]) -> None:
            s.add_event(run_id, event_type, stage, payload)
            # Called from the worker thread; schedule the WebSocket send on the event loop.
            asyncio.run_coroutine_threadsafe(
                websocket.send_json({"type": event_type, "run_id": run_id, "stage": stage, "payload": payload}),
                loop,
            )

        loop = asyncio.get_running_loop()
        result = await asyncio.to_thread(run_pipeline, fixture_id, dry_run, emit, mode)
        selected_fixture_id = (result.get("fixture") or {}).get("fixture_id") or fixture_id or 0
        s.update_run(run_id, status="completed", fixture_id=selected_fixture_id, fixture=result.get("fixture"), result=result)
        await websocket.send_json({"type": "run_completed", "run_id": run_id, "result": result})
    except WebSocketDisconnect:
        return
    except Exception as exc:
        try:
            await websocket.send_json({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
        except Exception:
            pass
