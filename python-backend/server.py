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

from config import ARENA_BASE_URL, arena_headers, load_env
from http_logging import setup_backend_logging
from pipeline import run_daily_pipeline, run_match_pipeline
from store import LocalRunStore, SupabaseRunStore


load_env()
setup_backend_logging()

app = FastAPI(title="Polymarket Arena Agent Backend")
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "https://polymarket-six-eta.vercel.app",
]
extra_origin = os.environ.get("FRONTEND_ORIGIN")
if extra_origin:
    allowed_origins.append(extra_origin.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RunRequest(BaseModel):
    mode: str = "daily"
    fixture_id: int | None = None
    dry_run: bool = True
    target_date: str | None = None
    concurrency: int = 2


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


def arena_get(path: str, **params: Any) -> dict[str, Any]:
    url = f"{ARENA_BASE_URL}/api{path}"
    response = requests.get(url, headers=arena_headers(), params={k: v for k, v in params.items() if v is not None}, timeout=30)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, dict) else {"data": data}


def compact_run_history(limit: int = 20) -> list[dict[str, Any]]:
    try:
        rows = store().list_runs(limit)
    except Exception:
        rows = LocalRunStore().list_runs(limit)

    history: list[dict[str, Any]] = []
    for row in rows:
        result = row.get("result") if isinstance(row.get("result"), dict) else {}
        fixture = result.get("fixture") if isinstance(result.get("fixture"), dict) else row.get("fixture") or {}
        prediction = result.get("prediction") if isinstance(result.get("prediction"), dict) else {}
        strategy = result.get("strategy") if isinstance(result.get("strategy"), dict) else {}
        execution = result.get("execution") if isinstance(result.get("execution"), dict) else {}
        history.append(
            {
                "id": row.get("id"),
                "mode": row.get("mode"),
                "status": row.get("status"),
                "created_at": row.get("created_at"),
                "completed_at": row.get("completed_at"),
                "fixture": {
                    "fixture_id": fixture.get("fixture_id") or row.get("fixture_id"),
                    "name": fixture.get("name"),
                    "starting_at": fixture.get("starting_at"),
                },
                "prediction": {
                    "outcome": prediction.get("outcome"),
                    "probability": prediction.get("probability"),
                    "confidence_level": prediction.get("confidence_level"),
                },
                "bet": {
                    "team_code": strategy.get("team_code") or strategy.get("outcome"),
                    "size_usdc": strategy.get("size_usdc"),
                    "limit_price": strategy.get("limit_price"),
                    "edge_pp": strategy.get("edge_pp"),
                    "should_trade": strategy.get("should_trade"),
                    "submitted": execution.get("submitted"),
                    "order_id": (execution.get("response") or {}).get("order_id") if isinstance(execution.get("response"), dict) else None,
                },
            }
        )
    return history


def order_outcome(order: dict[str, Any]) -> str | None:
    status = str(order.get("status") or "").lower()
    pnl = order.get("realized_pnl_usdc")
    settlement = order.get("settlement") if isinstance(order.get("settlement"), dict) else {}
    settled_outcome = settlement.get("outcome")
    team_code = order.get("team_code")
    if status == "rejected":
        return "rejected"
    if status in {"completed", "filled", "closing"}:
        return "open"
    if status in {"settled", "settled_won", "settled_lost", "settled_void"}:
        if settled_outcome and team_code:
            return "won" if str(settled_outcome).lower() == str(team_code).lower() else "lost"
        try:
            return "won" if float(pnl or 0) > 0 else "lost"
        except (TypeError, ValueError):
            return "settled"
    return status or None


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "live_orders_enabled": live_orders_enabled(),
    }


@app.get("/agent-profile")
def agent_profile() -> dict[str, Any]:
    try:
        agent = arena_get("/v1/arena/agents/me")
        exposure = arena_get("/v1/arena/exposure")
        orders_response = arena_get("/v1/arena/orders", limit=50)
        slug = agent.get("slug")

        public_profile: dict[str, Any] | None = None
        confidence_series: dict[str, Any] | None = None
        recent_predictions: dict[str, Any] | None = None
        if slug:
            try:
                public_profile = arena_get(f"/v1/web/agents/{slug}")
            except requests.HTTPError:
                public_profile = None
            try:
                confidence_series = arena_get(f"/v1/web/agents/{slug}/confidence-series", buckets=40)
            except requests.HTTPError:
                confidence_series = None
            try:
                recent_predictions = arena_get(f"/v1/web/agents/{slug}/recent-predictions", limit=50)
            except requests.HTTPError:
                recent_predictions = None

        order_summaries = orders_response.get("orders")
        if not isinstance(order_summaries, list):
            order_summaries = []

        enriched_orders: list[dict[str, Any]] = []
        for order in order_summaries[:25]:
            if not isinstance(order, dict):
                continue
            detail = {}
            order_id = order.get("order_id")
            if order_id:
                try:
                    detail = arena_get(f"/v1/arena/orders/{order_id}")
                except requests.HTTPError:
                    detail = {}
            merged = {**order, **detail}
            merged["outcome_result"] = order_outcome(merged)
            enriched_orders.append(merged)

        trace: dict[str, Any] | None = None
        try:
            trace = arena_get("/v1/arena/ledger/traces", limit=40)
        except requests.HTTPError:
            trace = None

        return {
            "agent": agent,
            "public_profile": public_profile,
            "wallet": agent.get("wallet") or {},
            "exposure": exposure,
            "orders": enriched_orders,
            "recent_predictions": recent_predictions,
            "confidence_series": confidence_series,
            "ledger_trace": trace,
            "local_runs": compact_run_history(),
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        detail = exc.response.text[:500] if exc.response is not None else str(exc)
        raise HTTPException(status_code=status_code, detail=f"Stair AI upstream error: {detail}") from exc


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
    if request.mode in {"daily", "auto"} and request.fixture_id is None:
        result = run_daily_pipeline(
            target_date=request.target_date,
            dry_run=request.dry_run,
            concurrency=request.concurrency,
            event_sink=lambda *_args, **_kwargs: None,
        )
    else:
        result = run_match_pipeline(request.fixture_id, dry_run=request.dry_run, mode=request.mode, event_sink=lambda *_args, **_kwargs: None)
    s.update_run(run_id, status="completed", fixture=result.get("fixture") or {}, result=result)
    return {"id": run_id, "status": "completed", "result": result}


@app.websocket("/ws/runs")
async def websocket_run(websocket: WebSocket) -> None:
    await websocket.accept()
    s = store()
    try:
        message = await websocket.receive_json()
        mode = str(message.get("mode") or ("manual" if message.get("fixture_id") else "daily"))
        fixture_id = int(message["fixture_id"]) if message.get("fixture_id") else None
        dry_run = bool(message.get("dry_run", True))
        target_date = message.get("target_date")
        concurrency = int(message.get("concurrency") or 2)
        require_live_order_permission(dry_run)
        run_id = str(uuid.uuid4())
        s.create_run(run_id, fixture_id or 0, mode=mode)
        await websocket.send_json({"type": "run_started", "run_id": run_id, "fixture_id": fixture_id, "mode": mode, "target_date": target_date})

        def emit(event_type: str, stage: str, payload: dict[str, Any]) -> None:
            s.add_event(run_id, event_type, stage, payload)
            # Called from the worker thread; schedule the WebSocket send on the event loop.
            asyncio.run_coroutine_threadsafe(
                websocket.send_json({"type": event_type, "run_id": run_id, "stage": stage, "payload": payload}),
                loop,
            )

        loop = asyncio.get_running_loop()
        if mode in {"daily", "auto"} and fixture_id is None:
            result = await asyncio.to_thread(run_daily_pipeline, target_date, dry_run, emit, concurrency)
        else:
            result = await asyncio.to_thread(run_match_pipeline, fixture_id, dry_run, emit, mode)
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
