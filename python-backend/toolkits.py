import json
import time
import uuid
from decimal import Decimal, ROUND_DOWN
from typing import Any

import requests
from agno.tools import Toolkit

from config import ARENA_BASE_URL, SPORTMONKS_SEASON_ID, SUPABASE_URL, arena_headers, supabase_key
from http_logging import request as logged_request
from utils import parse_token_ids

PRICE_TICK = Decimal("0.001")
USD_TICK = Decimal("0.01")


class ArenaDataToolkit(Toolkit):
    def __init__(self) -> None:
        super().__init__(
            name="arena_data",
            tools=[
                self.get_sportmonks_schedule,
                self.get_sportmonks_fixture,
                self.get_sportmonks_head_to_head,
                self.get_sportmonks_live_standings,
                self.get_polymarket_mapping,
                self.get_polymarket_event,
                self.get_polymarket_midpoint,
                self.get_polymarket_book,
                self.get_polymarket_spread,
                self.get_polymarket_price,
                self.get_polymarket_last_trade_price,
                self.get_polymarket_tick_size,
                self.get_polymarket_price_history,
                self.get_polymarket_listings,
                self.get_arena_polymarket_market,
                self.get_arena_polymarket_settlement,
                self.get_supabase_catalog,
                self.get_supabase_rows,
            ],
        )

    def get_sportmonks_schedule(self, season_id: int = SPORTMONKS_SEASON_ID) -> dict[str, Any]:
        """Fetch the World Cup schedule from Sportmonks through the Stair AI proxy."""
        url = f"{ARENA_BASE_URL}/api/v1/data/proxy/sportmonks/v3/football/schedules/seasons/{season_id}"
        response = logged_request("GET", url, headers=arena_headers(), timeout=30)
        response.raise_for_status()
        return response.json()

    def get_sportmonks_fixture(self, fixture_id: int, include: str | None = None) -> dict[str, Any]:
        """Fetch fixture evidence from Sportmonks through the Stair AI proxy."""
        url = f"{ARENA_BASE_URL}/api/v1/data/proxy/sportmonks/v3/football/fixtures/{fixture_id}"
        response = logged_request(
            "GET",
            url,
            params={"include": include or "participants;league;odds;xGFixture;venue;metadata;lineups;sidelined;coaches;referees;stage;round"},
            headers=arena_headers(),
            timeout=60,
        )
        if response.status_code >= 400 and include is None:
            response = logged_request(
                "GET",
                url,
                params={"include": "participants;odds;xGFixture"},
                headers=arena_headers(),
                timeout=60,
            )
        response.raise_for_status()
        return response.json()

    def get_sportmonks_head_to_head(self, home_team_id: int, away_team_id: int, limit: int = 10) -> dict[str, Any]:
        """Fetch recent direct meetings between two Sportmonks teams."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/proxy/sportmonks/v3/football/fixtures/head-to-head/{home_team_id}/{away_team_id}",
            params={"include": "participants;scores;league;state", "per_page": str(limit), "order": "desc"},
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_sportmonks_live_standings(self, league_id: int) -> dict[str, Any]:
        """Fetch live standings for a Sportmonks league when available."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/proxy/sportmonks/v3/football/standings/live/leagues/{league_id}",
            params={"include": "participant;details"},
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_polymarket_mapping(self, fixture_id: int) -> dict[str, Any]:
        """Fetch the curated Sportmonks fixture to Polymarket event mapping."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/web/mapping",
            params={"fixture_id": fixture_id},
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_polymarket_event(self, event_slug: str) -> dict[str, Any]:
        """Fetch a Polymarket Gamma event by slug through the Stair AI proxy."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/proxy/polymarket-gamma/events",
            params={"slug": event_slug},
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_polymarket_midpoint(self, token_id: str) -> dict[str, Any]:
        """Fetch a Polymarket CLOB midpoint for a YES/NO token through the Stair AI proxy."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/proxy/polymarket-clob/midpoint",
            params={"token_id": token_id},
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_polymarket_book(self, token_id: str) -> dict[str, Any]:
        """Fetch the Polymarket CLOB order book for one outcome token."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/proxy/polymarket-clob/book",
            params={"token_id": token_id},
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_polymarket_spread(self, token_id: str) -> dict[str, Any]:
        """Fetch the current CLOB spread for one outcome token."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/proxy/polymarket-clob/spread",
            params={"token_id": token_id},
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_polymarket_price(self, token_id: str, side: str) -> dict[str, Any]:
        """Fetch the best CLOB price for BUY or SELL side for one outcome token."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/proxy/polymarket-clob/price",
            params={"token_id": token_id, "side": str(side).upper()},
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_polymarket_last_trade_price(self, token_id: str) -> dict[str, Any]:
        """Fetch the last traded price for one outcome token."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/proxy/polymarket-clob/last-trade-price",
            params={"token_id": token_id},
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_polymarket_tick_size(self, token_id: str) -> dict[str, Any]:
        """Fetch the minimum valid price increment for one outcome token."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/proxy/polymarket-clob/tick-size",
            params={"token_id": token_id},
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_polymarket_price_history(self, token_id: str, interval: str = "1d") -> dict[str, Any]:
        """Fetch recent CLOB price history for one outcome token."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/proxy/polymarket-clob/prices-history",
            params={"market": token_id, "interval": interval},
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_arena_polymarket_market(self, fixture_code: str) -> dict[str, Any]:
        """Fetch arena-normalized Polymarket market data for a fixture id."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/polymarket/markets/{fixture_code}",
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_arena_polymarket_settlement(self, fixture_code: str) -> dict[str, Any]:
        """Fetch arena-normalized settlement data for a fixture id."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/polymarket/markets/{fixture_code}/settlement",
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_polymarket_listings(self) -> dict[str, Any]:
        """Fetch fixture ids with arena-normalized Polymarket markets."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/data/polymarket/listings",
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_supabase_catalog(self) -> list[dict[str, Any]]:
        """Fetch the Supabase catalog describing available World Cup Arena tables."""
        response = logged_request(
            "GET",
            f"{SUPABASE_URL}/rest/v1/catalog_tables",
            params={"select": "table_name,description,row_count", "order": "table_name.asc"},
            headers={"apikey": supabase_key()},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_supabase_rows(
        self,
        table_name: str,
        select: str = "*",
        filters: dict[str, str] | None = None,
        limit: int = 20,
        arena_schema: bool = True,
    ) -> list[dict[str, Any]]:
        """Fetch rows from a Supabase table, using PostgREST filter expressions."""
        headers = {"apikey": supabase_key()}
        if arena_schema:
            headers["Accept-Profile"] = "world_cup_arena"

        params: dict[str, str] = {"select": select, "limit": str(limit)}
        if filters:
            params.update(filters)

        response = logged_request(
            "GET",
            f"{SUPABASE_URL}/rest/v1/{table_name}",
            params=params,
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()


class ArenaTradingToolkit(Toolkit):
    def __init__(self, dry_run: bool = True) -> None:
        self.dry_run = dry_run
        super().__init__(
            name="arena_trading",
            tools=[
                self.get_agent_profile,
                self.sync_agent_profile,
                self.get_match,
                self.get_exposure,
                self.submit_order,
                self.submit_fok_order,
                self.get_order_status,
                self.close_order,
            ],
        )

    def get_agent_profile(self) -> dict[str, Any]:
        """Fetch authenticated arena agent and wallet details."""
        response = logged_request("GET", f"{ARENA_BASE_URL}/api/v1/arena/agents/me", headers=arena_headers(), timeout=30)
        response.raise_for_status()
        return response.json()

    def sync_agent_profile(
        self,
        display_name: str = "POLYCOGNITIVE (POLY-09)",
        bio: str = "World Cup Arena prediction-market agent combining Sportmonks context, historical priors, Polymarket prices, exposure checks, and a full Reasoning Ledger trace before acting.",
        avatar_url: str | None = None,
        site: str | None = None,
        twitter: str | None = None,
    ) -> dict[str, Any]:
        """Update the authenticated Stair AI agent profile resolved from the API key."""
        payload: dict[str, Any] = {"display_name": display_name, "bio": bio}
        if avatar_url:
            payload["avatar_url"] = avatar_url
        social = {key: value for key, value in {"site": site, "twitter": twitter}.items() if value}
        if social:
            payload["social"] = social
        response = logged_request(
            "PATCH",
            f"{ARENA_BASE_URL}/api/v1/arena/agents/me",
            headers=arena_headers(),
            json_body=payload,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_exposure(self, fixture_id: str | None = None) -> dict[str, Any]:
        """Fetch open exposure, optionally filtered by fixture id."""
        params = {"fixture_id": fixture_id} if fixture_id else None
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/arena/exposure",
            params=params,
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_match(self, fixture_id: str | int) -> dict[str, Any]:
        """Fetch arena match timing and currently open prediction window."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/arena/matches/{fixture_id}",
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def submit_order(
        self,
        fixture_code: str,
        team_code: str,
        usd_size: str,
        limit_price: float,
        time_in_force_seconds: int = 30,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Submit a buy-YES arena order, or return the payload when dry_run is enabled."""
        normalized_tif = max(1, min(int(time_in_force_seconds), 3600))
        payload = {
            "fixture_id": fixture_code,
            "team_code": team_code,
            "usd_size": normalize_usd_size(usd_size),
            "limit_price": normalize_limit_price(limit_price),
            "time_in_force_seconds": normalized_tif,
            "idempotency_key": idempotency_key or str(uuid.uuid4()),
        }
        if self.dry_run:
            return {"dry_run": True, "submitted": False, "payload": payload}

        response = logged_request(
            "POST",
            f"{ARENA_BASE_URL}/api/v1/arena/orders",
            headers=arena_headers(),
            json_body=payload,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()

    def submit_fok_order(
        self,
        fixture_code: str,
        team_code: str,
        usd_size: str,
        worst_price: float,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Submit an all-or-nothing buy-YES arena order, or return the payload when dry_run is enabled."""
        payload = {
            "fixture_id": fixture_code,
            "team_code": team_code,
            "usd_size": normalize_usd_size(usd_size),
            "worst_price": normalize_limit_price(worst_price),
            "idempotency_key": idempotency_key or str(uuid.uuid4()),
        }
        if self.dry_run:
            return {"dry_run": True, "submitted": False, "payload": payload, "order_type": "fok"}

        response = logged_request(
            "POST",
            f"{ARENA_BASE_URL}/api/v1/arena/orders_fok",
            headers=arena_headers(),
            json_body=payload,
            timeout=60,
        )
        response.raise_for_status()
        result = response.json()
        if isinstance(result, dict):
            result.setdefault("order_type", "fok")
        return result

    def get_order_status(self, order_id: str) -> dict[str, Any]:
        """Fetch arena order status by order ID."""
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/arena/orders/{order_id}",
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def close_order(self, order_id: str, limit_price: float, idempotency_key: str | None = None) -> dict[str, Any]:
        """Submit a close order, or return the payload when dry_run is enabled."""
        payload = {"limit_price": normalize_limit_price(limit_price), "idempotency_key": idempotency_key or str(uuid.uuid4())}
        if self.dry_run:
            return {"dry_run": True, "submitted": False, "order_id": order_id, "payload": payload}

        response = logged_request(
            "POST",
            f"{ARENA_BASE_URL}/api/v1/arena/orders/{order_id}/close",
            headers=arena_headers(),
            json_body=payload,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()


class ArenaLedgerToolkit(Toolkit):
    def __init__(self, dry_run: bool = True) -> None:
        self.dry_run = dry_run
        super().__init__(name="arena_ledger", tools=[self.submit_ledger_batch, self.get_ledger_trace])

    def submit_ledger_batch(self, records: list[dict[str, Any]]) -> dict[str, Any]:
        """Submit up to 50 reasoning ledger records, or return them when dry_run is enabled."""
        payload = {"records": records}
        if self.dry_run:
            return {"dry_run": True, "submitted": False, "record_count": len(records), "payload": payload}

        response = logged_request(
            "POST",
            f"{ARENA_BASE_URL}/api/v1/arena/ledger/records/batch",
            headers=arena_headers(),
            json_body=payload,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()

    def get_ledger_trace(self, before: str | None = None, limit: int = 50) -> dict[str, Any]:
        """Fetch recent ledger records for the authenticated agent for diagnostics."""
        params: dict[str, Any] = {"limit": max(1, min(int(limit), 500))}
        if before:
            params["before"] = before
        response = logged_request(
            "GET",
            f"{ARENA_BASE_URL}/api/v1/arena/ledger/traces",
            params=params,
            headers=arena_headers(),
            timeout=30,
        )
        response.raise_for_status()
        return response.json()


def normalize_fixture(raw_fixture_envelope: dict[str, Any]) -> dict[str, Any]:
    fixture = raw_fixture_envelope.get("body", {}).get("data", raw_fixture_envelope)
    participants = fixture.get("participants") or []
    home = next((p for p in participants if p.get("meta", {}).get("location") == "home"), None)
    away = next((p for p in participants if p.get("meta", {}).get("location") == "away"), None)
    return {
        "fixture_id": fixture.get("id"),
        "fixture_code": str(fixture.get("id")),
        "name": fixture.get("name"),
        "starting_at": fixture.get("starting_at"),
        "home": home,
        "away": away,
        "raw": fixture,
    }


def build_moneyline_from_gamma(gamma_payload: dict[str, Any]) -> dict[str, Any]:
    events = gamma_payload.get("body", gamma_payload)
    if isinstance(events, dict):
        events = events.get("data") or events.get("events") or [events]
    if not isinstance(events, list) or not events:
        return {"event": None, "markets": []}

    event = events[0]
    markets = []
    for market in event.get("markets") or []:
        token_ids = parse_token_ids(market.get("clobTokenIds"))
        markets.append(
            {
                "question": market.get("question") or market.get("title"),
                "condition_id": market.get("conditionId"),
                "clob_token_ids": token_ids,
                "yes_token_id": token_ids[0] if token_ids else None,
                "no_token_id": token_ids[1] if len(token_ids) > 1 else None,
            }
        )
    return {
        "event": {
            "title": event.get("title") or event.get("question"),
            "slug": event.get("slug"),
        },
        "markets": markets,
    }


def normalize_limit_price(value: Any) -> float:
    price = Decimal(str(value)).quantize(PRICE_TICK, rounding=ROUND_DOWN)
    if price <= 0:
        price = PRICE_TICK
    if price >= 1:
        price = Decimal("0.999")
    return float(price)


def normalize_usd_size(value: Any) -> str:
    amount = Decimal(str(value)).quantize(USD_TICK, rounding=ROUND_DOWN)
    return f"{amount:.2f}"


def new_ledger_record(session_id: str, behavior: str, **fields: Any) -> dict[str, Any]:
    record = {
        "schema_version": "0.3",
        "session_id": session_id,
        "record_id": str(uuid.uuid4()),
        "behavior": behavior,
        "client_ts_utc": int(time.time() * 1000),
    }
    record.update({key: value for key, value in fields.items() if value is not None})
    return record
