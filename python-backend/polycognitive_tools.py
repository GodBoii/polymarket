from __future__ import annotations

import re
import time
import uuid
from decimal import Decimal, InvalidOperation
from typing import Any, Callable

from agno.tools import Toolkit

from config import SPORTMONKS_SEASON_ID
from ledger import LedgerSink
from polymarket_features import build_polymarket_features
from scout import choose_best_candidate, clamp_probability, flatten_schedule, score_candidate
from sportmonks_features import build_sportmonks_features
from supabase_context import build_supabase_context
from toolkits import ArenaDataToolkit, ArenaTradingToolkit, build_moneyline_from_gamma, normalize_fixture
from weather_forecasts import weather_context_from_fixture


EventSink = Callable[[str, str, dict[str, Any]], None]

SPORTMONKS_EVIDENCE_INCLUDE = "participants;league;odds;xGFixture;venue;metadata;lineups.player;formations;sidelined.sideline;coaches;referees;stage;round"
SPORTMONKS_BASIC_INCLUDE = "participants;league;odds;xGFixture;venue;metadata;lineups;coaches;referees;stage;round"


def _emit(event_sink: EventSink | None, event_type: str, stage: str, payload: dict[str, Any]) -> None:
    if event_sink:
        event_sink(event_type, stage, payload)


def _prune_agent_payload(value: Any) -> Any:
    blocked = {
        "predictions",
        "prediction_rows",
        "prediction_type_count",
        "prediction_types_seen",
        "fulltime_result_probability",
        "typed_prediction_rows",
        "model_quality",
        "ml_prediction_risk",
        "data_boundary",
        "data_quality",
        "available",
        "error",
    }
    if isinstance(value, dict):
        pruned = {}
        for key, child in value.items():
            if key in blocked:
                continue
            cleaned = _prune_agent_payload(child)
            if cleaned in (None, "", [], {}):
                continue
            if cleaned is False:
                continue
            pruned[key] = cleaned
        return pruned
    if isinstance(value, list):
        return [cleaned for child in value if (cleaned := _prune_agent_payload(child)) not in (None, "", [], {}) and cleaned is not False]
    return value


def _tool_summary(output: Any) -> Any:
    if isinstance(output, dict):
        return {
            key: output.get(key)
            for key in [
                "session_id",
                "fixture_count",
                "selected",
                "fixture",
                "fixture_id",
                "fixture_code",
                "event_slug",
                "team_code",
                "size_usdc",
                "limit_price",
                "best_ask",
                "spread",
                "order_id",
                "order_status",
                "submitted",
                "dry_run",
                "error",
            ]
            if key in output
        }
    return output


class FixtureSelectionToolkit(Toolkit):
    def __init__(
        self,
        data: ArenaDataToolkit,
        ledger: LedgerSink,
        trading: ArenaTradingToolkit | None = None,
        event_sink: EventSink | None = None,
        max_candidates: int = 12,
    ) -> None:
        self.data = data
        self.ledger = ledger
        self.trading = trading
        self.event_sink = event_sink
        self.max_candidates = max_candidates
        self.last_candidates: dict[str, Any] | None = None
        super().__init__(name="fixture_selection", tools=[self.get_worldcup_match_slate, self.get_worldcup_fixture_candidates])

    def _current_exposure_by_fixture(self) -> dict[str, dict[str, Any]]:
        summary: dict[str, dict[str, Any]] = {}
        if not self.trading:
            return summary
        try:
            payload = self.trading.get_exposure()
        except Exception:
            return summary
        positions = payload.get("positions") or payload.get("data") or []
        if not isinstance(positions, list):
            return summary
        for position in positions:
            if not isinstance(position, dict):
                continue
            fixture_id = str(position.get("fixture_id") or position.get("fixture_code") or "")
            if not fixture_id:
                continue
            bucket = summary.setdefault(fixture_id, {"position_count": 0, "total_cost_usdc": 0.0, "team_codes": []})
            bucket["position_count"] += 1
            cost = Decimal("0")
            avg_cost = position.get("avg_cost_usdc")
            qty = position.get("quantity")
            value = position.get("value_usdc")
            try:
                if avg_cost is not None and qty is not None:
                    cost = Decimal(str(avg_cost)) * Decimal(str(qty))
                elif value is not None:
                    cost = Decimal(str(value))
            except (InvalidOperation, TypeError, ValueError):
                cost = Decimal("0")
            bucket["total_cost_usdc"] = round(float(bucket["total_cost_usdc"] + float(cost)), 2)
            team_code = position.get("team_code") or position.get("outcome")
            if team_code and team_code not in bucket["team_codes"]:
                bucket["team_codes"].append(str(team_code))
        return summary

    def _listed_fixtures(self, season_id: int) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
        schedule = self.data.get_sportmonks_schedule(season_id)
        fixtures = flatten_schedule(schedule)
        listed_fixture_ids: set[str] = set()
        try:
            listings = self.data.get_polymarket_listings()
            listed_fixture_ids = {
                str(row.get("fixture_id") or row.get("fixture_code"))
                for row in listings.get("fixtures") or []
                if row.get("fixture_id") is not None or row.get("fixture_code") is not None
            }
        except Exception:
            listed_fixture_ids = set()
        named_fixtures = [row for row in fixtures if row.get("has_named_participants")]
        if listed_fixture_ids:
            named_fixtures = [row for row in named_fixtures if str(row.get("fixture_id")) in listed_fixture_ids]
        exposure_by_fixture = self._current_exposure_by_fixture()
        return named_fixtures, exposure_by_fixture

    def get_worldcup_match_slate(self, session_id: str, season_id: int = SPORTMONKS_SEASON_ID) -> dict[str, Any]:
        """Return the full World Cup Polymarket slate with dates and any existing open exposure."""
        _emit(self.event_sink, "tool_call_started", "fixture_selector", {"tool_name": "get_worldcup_match_slate", "input": {"session_id": session_id, "season_id": season_id}})
        fixtures, exposure_by_fixture = self._listed_fixtures(season_id)
        slate = []
        for fixture in fixtures:
            exposure = exposure_by_fixture.get(str(fixture.get("fixture_id"))) or {}
            slate.append(
                {
                    key: fixture.get(key)
                    for key in ["fixture_id", "fixture_code", "name", "starting_at", "stage", "round", "has_named_participants"]
                }
                | {
                    "open_exposure_count": exposure.get("position_count", 0),
                    "open_exposure_cost_usdc": exposure.get("total_cost_usdc", 0.0),
                    "open_exposure_team_codes": exposure.get("team_codes", []),
                }
            )
        result = {"session_id": session_id, "season_id": season_id, "fixture_count": len(slate), "fixtures": slate}
        self.ledger.tool_calling(
            tool_name="get_worldcup_match_slate",
            description=f"sportmonks/polymarket: Built the full listed World Cup slate with {len(slate)} fixtures and current account exposure annotations.",
            input_payload={"session_id": session_id, "season_id": season_id},
            output_payload=_tool_summary(result),
            success=True,
        )
        _emit(self.event_sink, "tool_call_completed", "fixture_selector", {"tool_name": "get_worldcup_match_slate", "output": _tool_summary(result), "success": True})
        return result

    def get_worldcup_fixture_candidates(self, session_id: str, season_id: int = SPORTMONKS_SEASON_ID) -> dict[str, Any]:
        """Return ranked WC2026 fixture candidates with market and data coverage."""
        _emit(self.event_sink, "tool_call_started", "fixture_selector", {"tool_name": "get_worldcup_fixture_candidates", "input": {"session_id": session_id, "season_id": season_id}})
        named_fixtures, exposure_by_fixture = self._listed_fixtures(season_id)

        candidates = []
        for fixture in named_fixtures[: self.max_candidates]:
            fixture_id = int(fixture["fixture_id"])
            mapping_count = market_count = midpoint_count = odds_count = 0
            venue = None
            weather = None
            try:
                arena_market = self.data.get_arena_polymarket_market(str(fixture["fixture_id"]))
                outcomes = arena_market.get("outcomes") or []
                mapping_count = 1 if arena_market.get("polymarket_event_slug") else 0
                market_count = len(outcomes)
                midpoint_count = len([row for row in outcomes if row.get("mid_price") is not None])
            except Exception:
                pass
            try:
                fixture_envelope = self.data.get_sportmonks_fixture(fixture_id, include="participants;odds;xGFixture;venue")
                fixture_body = fixture_envelope.get("body", {}).get("data", {})
                odds_count = len(fixture_body.get("odds") or [])
                venue = fixture_body.get("venue")
                weather = weather_context_from_fixture(fixture_body)
            except Exception:
                pass
            exposure = exposure_by_fixture.get(str(fixture["fixture_id"])) or {}
            candidate = score_candidate(
                fixture,
                mapping_count=mapping_count,
                market_count=market_count,
                midpoint_count=midpoint_count,
                odds_count=odds_count,
                open_exposure_count=int(exposure.get("position_count", 0)),
                open_exposure_cost=float(exposure.get("total_cost_usdc", 0.0)),
            )
            if venue:
                candidate["venue"] = venue
            if weather:
                candidate["weather"] = weather
            if exposure:
                candidate["open_exposure_team_codes"] = exposure.get("team_codes", [])
            candidates.append(_prune_agent_payload(candidate))

        selected = choose_best_candidate(candidates)
        result = {
            "session_id": session_id,
            "season_id": season_id,
            "fixture_count": len(named_fixtures),
            "selected": selected,
            "candidates": candidates,
        }
        self.last_candidates = result
        selected_name = selected.get("name", "unknown") if selected else "none"
        self.ledger.tool_calling(
            tool_name="get_worldcup_fixture_candidates",
            description=f"sportmonks: List WC2026 season schedule to discover fixtures. Found {len(named_fixtures)} listed named fixtures, ranked {len(candidates)} candidates. Selected: {selected_name}.",
            input_payload={"session_id": session_id, "season_id": season_id},
            output_payload=_tool_summary(result),
            success=True,
        )
        # Thinking: fixture selection reasoning
        if selected:
            self.ledger.thinking(
                prompt="Evaluate World Cup fixture candidates by data coverage, market availability, and kickoff timing to select the best analysis target.",
                description=f"Fixture selection reasoning — chose {selected_name}.",
                output_payload={
                    "selected_fixture": selected_name,
                    "fixture_id": selected.get("fixture_id"),
                    "score": selected.get("score"),
                    "candidate_count": len(candidates),
                    "total_fixtures": len(named_fixtures),
                    "selection_criteria": "Highest composite score based on Polymarket mapping, market count, midpoint availability, Sportmonks odds coverage, and a penalty for existing exposure on that fixture.",
                },
            )
        _emit(self.event_sink, "tool_call_completed", "fixture_selector", {"tool_name": "get_worldcup_fixture_candidates", "output": _tool_summary(result), "success": True})
        return result


class PolycognitiveToolkit(Toolkit):
    def __init__(self, data: ArenaDataToolkit, trading: ArenaTradingToolkit, ledger: LedgerSink, dry_run: bool = True, event_sink: EventSink | None = None) -> None:
        self.data = data
        self.trading = trading
        self.ledger = ledger
        self.dry_run = dry_run
        self.event_sink = event_sink
        self.last_match_context: dict[str, Any] | None = None
        self.last_polymarket_context: dict[str, Any] | None = None
        self.last_exposure: dict[str, Any] | None = None
        self.last_prediction_submission: dict[str, Any] | None = None
        self.last_order: dict[str, Any] | None = None
        self.last_agent_profile: dict[str, Any] | None = None
        self.last_match_window: dict[str, Any] | None = None
        super().__init__(
            name="polycognitive_arena",
            tools=[
                self.get_account_status,
                self.get_match_context,
                self.get_polymarket_context,
                self.get_executable_market_snapshot,
                self.get_current_exposure,
                self.record_ledger_checkpoint,
                self.submit_prediction_to_stair,
                self.place_guarded_bet,
                self.place_bet,
            ],
        )

    def _record_tool(self, name: str, description: str, input_payload: Any, output_payload: Any, success: bool = True, stage: str = "polycognitive") -> None:
        self.ledger.tool_calling(tool_name=name, description=description, input_payload=input_payload, output_payload=_tool_summary(output_payload), success=success)
        _emit(self.event_sink, "tool_call_completed", stage, {"tool_name": name, "output": _tool_summary(output_payload), "success": success})

    def _match_window(self, fixture_id: str | int) -> dict[str, Any]:
        result = self.trading.get_match(str(fixture_id))
        self.last_match_window = result
        return result

    def _window_is_open(self, fixture_id: str | int) -> tuple[bool, str | None]:
        try:
            match_window = self._match_window(fixture_id)
        except Exception as exc:
            return False, f"Unable to verify arena match window: {type(exc).__name__}: {exc}"
        if str(match_window.get("current_window") or "").upper() == "PRE_MATCH":
            return True, None
        return False, "No Stair AI pre-match prediction window is currently open for this fixture."

    def _max_order_size_from_wallet(self) -> Decimal:
        wallet = (self.last_agent_profile or {}).get("wallet") or {}
        balance_raw = wallet.get("available_balance_usdc")
        try:
            balance = Decimal(str(balance_raw))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal("15")
        if balance <= Decimal("0.05"):
            return Decimal("0")
        return min(Decimal("15"), (balance - Decimal("0.05")).quantize(Decimal("0.01")))

    def _decimal_or_none(self, value: Any) -> Decimal | None:
        try:
            if value is None:
                return None
            return Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return None

    def _proxy_body(self, payload: dict[str, Any] | None) -> dict[str, Any]:
        if not isinstance(payload, dict):
            return {}
        body = payload.get("body", payload)
        return body if isinstance(body, dict) else {}

    def _price_levels(self, rows: Any, *, reverse: bool = False) -> list[dict[str, Any]]:
        levels = []
        for row in rows if isinstance(rows, list) else []:
            if not isinstance(row, dict):
                continue
            price = self._decimal_or_none(row.get("price"))
            size = self._decimal_or_none(row.get("size"))
            if price is None or size is None:
                continue
            levels.append({"price": price, "size": size})
        levels.sort(key=lambda item: item["price"], reverse=reverse)
        return levels

    def _depth_for_usd(self, asks: list[dict[str, Any]], target_usd: Decimal) -> dict[str, Any]:
        remaining = target_usd
        shares = Decimal("0")
        used_levels = []
        for ask in asks:
            if remaining <= 0:
                break
            level_usd = ask["price"] * ask["size"]
            take_usd = min(remaining, level_usd)
            take_shares = take_usd / ask["price"] if ask["price"] > 0 else Decimal("0")
            shares += take_shares
            remaining -= take_usd
            used_levels.append(
                {
                    "price": float(ask["price"]),
                    "available_shares": float(ask["size"]),
                    "take_usd": f"{take_usd.quantize(Decimal('0.0001'))}",
                    "take_shares": f"{take_shares.quantize(Decimal('0.0001'))}",
                }
            )
        return {
            "target_usd": f"{target_usd.quantize(Decimal('0.01'))}",
            "fillable": remaining <= 0,
            "unfilled_usd": f"{max(Decimal('0'), remaining).quantize(Decimal('0.0001'))}",
            "estimated_shares": f"{shares.quantize(Decimal('0.0001'))}",
            "worst_price_for_target": used_levels[-1]["price"] if used_levels else None,
            "depth_levels_used": len(used_levels),
            "levels_used": used_levels[:5],
        }

    def get_account_status(self) -> dict[str, Any]:
        """Return wallet balance, current open positions, and the source-of-truth profile links."""
        _emit(self.event_sink, "tool_call_started", "account_status", {"tool_name": "get_account_status", "input": {}})
        profile = self.trading.get_agent_profile()
        exposure = self.trading.get_exposure()
        self.last_agent_profile = profile
        self.last_exposure = exposure
        wallet = profile.get("wallet") if isinstance(profile, dict) else {}
        positions = exposure.get("positions") or exposure.get("data") or []
        fixture_lookup: dict[str, dict[str, Any]] = {}
        try:
            schedule = self.data.get_sportmonks_schedule(SPORTMONKS_SEASON_ID)
            fixtures = flatten_schedule(schedule)
            fixture_lookup = {str(row.get("fixture_id")): row for row in fixtures if row.get("fixture_id") is not None}
        except Exception:
            fixture_lookup = {}

        open_positions = []
        total_position_cost = Decimal("0")
        total_mark_value = Decimal("0")
        for position in positions if isinstance(positions, list) else []:
            if not isinstance(position, dict):
                continue
            fixture_id = str(position.get("fixture_id") or position.get("fixture_code") or "")
            fixture = fixture_lookup.get(fixture_id, {})
            cost = Decimal("0")
            mark_value = Decimal("0")
            try:
                if position.get("avg_cost_usdc") is not None and position.get("quantity") is not None:
                    cost = Decimal(str(position["avg_cost_usdc"])) * Decimal(str(position["quantity"]))
            except (InvalidOperation, TypeError, ValueError):
                cost = Decimal("0")
            try:
                if position.get("value_usdc") is not None:
                    mark_value = Decimal(str(position["value_usdc"]))
            except (InvalidOperation, TypeError, ValueError):
                mark_value = Decimal("0")
            total_position_cost += cost
            total_mark_value += mark_value
            open_positions.append(
                {
                    "fixture_id": fixture_id,
                    "match": fixture.get("name"),
                    "starting_at": fixture.get("starting_at"),
                    "stage": fixture.get("stage"),
                    "round": fixture.get("round"),
                    "team_code": position.get("team_code"),
                    "quantity": position.get("quantity"),
                    "avg_cost_usdc": position.get("avg_cost_usdc"),
                    "estimated_cost_usdc": f"{cost:.2f}",
                    "mark_price": position.get("mark_price"),
                    "value_usdc": position.get("value_usdc"),
                    "unrealized_pnl_usdc": position.get("unrealized_pnl_usdc"),
                    "outcome_token_id": position.get("outcome_token_id"),
                }
            )

        result = {
            "agent": {
                "agent_id": profile.get("agent_id"),
                "display_name": profile.get("display_name"),
                "slug": profile.get("slug"),
                "lifecycle_phase": profile.get("lifecycle_phase"),
            },
            "wallet": {
                "available_balance_usdc": wallet.get("available_balance_usdc"),
                "locked_balance_usdc": wallet.get("locked_balance_usdc"),
                "wallet_address": wallet.get("address"),
                "polymarket_profile_url": wallet.get("polymarket_profile_url"),
                "polyscan_url": wallet.get("polyscan_url"),
            },
            "positions_summary": {
                "open_position_count": len(open_positions),
                "estimated_total_cost_usdc": f"{total_position_cost:.2f}",
                "estimated_total_mark_value_usdc": f"{total_mark_value:.2f}",
            },
            "open_positions": open_positions,
            "notes": [
                "Use polymarket_profile_url as the external ground-truth view when Stair exposure/order state looks inconsistent.",
                "Estimated position cost is derived from avg_cost_usdc * quantity when available.",
            ],
        }
        self._record_tool(
            "get_account_status",
            f"arena: Fetched account status with wallet balance and {len(open_positions)} open positions.",
            {},
            result,
            True,
            "account_status",
        )
        return result

    def get_match_context(self, fixture_id: int) -> dict[str, Any]:
        """Return a complete football, weather, and historical evidence bundle for one fixture."""
        _emit(self.event_sink, "tool_call_started", "match_context", {"tool_name": "get_match_context", "input": {"fixture_id": fixture_id}})
        try:
            fixture_envelope = self.data.get_sportmonks_fixture(int(fixture_id), include=SPORTMONKS_EVIDENCE_INCLUDE)
        except Exception:
            fixture_envelope = self.data.get_sportmonks_fixture(int(fixture_id), include=SPORTMONKS_BASIC_INCLUDE)
        fixture = normalize_fixture(fixture_envelope)
        raw_fixture = fixture.get("raw") or {}
        sportmonks_features = build_sportmonks_features(raw_fixture)
        enrichment = self._sportmonks_enrichment(fixture)
        supabase_context = build_supabase_context(self.data, fixture)
        weather = weather_context_from_fixture(raw_fixture)
        sportmonks_payload: dict[str, Any] = {
            "features": sportmonks_features,
            "enrichment": enrichment,
            "venue": raw_fixture.get("venue"),
            "lineups": raw_fixture.get("lineups") or [],
            "sidelined": raw_fixture.get("sidelined") or [],
            "coaches": raw_fixture.get("coaches") or [],
            "referees": raw_fixture.get("referees") or [],
            "stage": raw_fixture.get("stage"),
            "round": raw_fixture.get("round"),
        }
        if weather:
            sportmonks_payload["weather"] = weather
        result = _prune_agent_payload(
            {
                "fixture": {key: fixture.get(key) for key in ["fixture_id", "fixture_code", "name", "starting_at"]},
                "teams": {"home": fixture.get("home"), "away": fixture.get("away")},
                "sportmonks": sportmonks_payload,
                "historical": supabase_context,
            }
        )
        self.last_match_context = result
        fixture_name = fixture.get("name", "unknown")
        self._record_tool("get_match_context", f"sportmonks: Fetched complete match evidence for {fixture_name} — lineups, odds, xG, venue, weather, head-to-head, and Supabase historical priors.", {"fixture_id": fixture_id}, result, True, "match_context")
        return result

    def _sportmonks_enrichment(self, fixture: dict[str, Any]) -> dict[str, Any]:
        raw = fixture.get("raw") or {}
        home = fixture.get("home") or {}
        away = fixture.get("away") or {}
        enrichment: dict[str, Any] = {}
        if home.get("id") and away.get("id"):
            try:
                h2h = self.data.get_sportmonks_head_to_head(int(home["id"]), int(away["id"]))
                h2h_rows = h2h.get("body", {}).get("data", h2h.get("data", []))
                enrichment["head_to_head"] = {"available": True, "fixture_count": len(h2h_rows or []), "fixtures": (h2h_rows or [])[:10]}
            except Exception as exc:
                enrichment["head_to_head"] = {"available": False, "error": f"{type(exc).__name__}: {exc}"}
        league = raw.get("league") or {}
        league_id = league.get("id") or raw.get("league_id")
        if league_id:
            try:
                standings = self.data.get_sportmonks_live_standings(int(league_id))
                standings_rows = standings.get("body", {}).get("data", standings.get("data", []))
                enrichment["live_standings"] = {"available": True, "league_id": league_id, "row_count": len(standings_rows or []), "rows": (standings_rows or [])[:30]}
            except Exception as exc:
                enrichment["live_standings"] = {"available": False, "league_id": league_id, "error": f"{type(exc).__name__}: {exc}"}
        return enrichment

    def get_polymarket_context(self, fixture_id: int, fixture_code: str | None = None) -> dict[str, Any]:
        """Return market mapping, prices, probabilities, execution handles, and quality gaps."""
        _emit(self.event_sink, "tool_call_started", "polymarket_context", {"tool_name": "get_polymarket_context", "input": {"fixture_id": fixture_id}})
        arena_market = None
        arena_market_error = None
        try:
            arena_market = self.data.get_arena_polymarket_market(str(fixture_id))
        except Exception as exc:
            arena_market_error = f"{type(exc).__name__}: {exc}"
        mapping = self.data.get_polymarket_mapping(int(fixture_id))
        mappings = mapping.get("mappings") or []
        event_slug = (arena_market or {}).get("polymarket_event_slug") if isinstance(arena_market, dict) else None
        if not event_slug:
            event_slug = mappings[0].get("polymarket_event_slug") if mappings else None
        gamma = self.data.get_polymarket_event(event_slug) if event_slug else {}
        moneyline = build_moneyline_from_gamma(gamma) if gamma else {"event": None, "markets": []}
        enriched_markets = []
        for market in moneyline.get("markets", []):
            yes_token_id = market.get("yes_token_id")
            midpoint = None
            if yes_token_id:
                midpoint_payload = self.data.get_polymarket_midpoint(yes_token_id)
                midpoint_body = midpoint_payload.get("body", midpoint_payload)
                midpoint = midpoint_body.get("mid") if isinstance(midpoint_body, dict) else None
            enriched_markets.append({**market, "mid": midpoint})
        result = {
            "fixture_id": fixture_id,
            "mapping": mapping,
            "event_slug": event_slug,
            "event": moneyline.get("event"),
            "markets": enriched_markets,
            "arena_market": arena_market,
            "arena_market_error": arena_market_error,
        }
        result["features"] = build_polymarket_features(result)
        self.last_polymarket_context = result
        self._record_tool("get_polymarket_context", f"polymarket: Fetched market mapping, Gamma event data, and CLOB midpoint prices for event {event_slug or 'unknown'}. Three-outcome market (home/draw/away).", {"fixture_id": fixture_id}, result, True, "polymarket_context")
        return result

    def get_executable_market_snapshot(self, fixture_id: int, target_usd: str = "15.00") -> dict[str, Any]:
        """Return executable CLOB bid/ask, spread, tick, last trade, and depth for each outcome."""
        _emit(
            self.event_sink,
            "tool_call_started",
            "execution_market",
            {"tool_name": "get_executable_market_snapshot", "input": {"fixture_id": fixture_id, "target_usd": target_usd}},
        )
        target = self._decimal_or_none(target_usd)
        if target is None or target <= 0:
            result = {"fixture_id": fixture_id, "target_usd": target_usd, "error": "target_usd must be a positive decimal string."}
            self._record_tool("get_executable_market_snapshot", "polymarket-clob: Invalid target USD for executable market snapshot.", {"fixture_id": fixture_id, "target_usd": target_usd}, result, False, "execution_market")
            return result

        context = self.last_polymarket_context if self.last_polymarket_context and str(self.last_polymarket_context.get("fixture_id")) == str(fixture_id) else self.get_polymarket_context(fixture_id)
        features = context.get("features") or {}
        outcomes = features.get("outcomes") or []
        snapshots = []
        for outcome in outcomes:
            if not isinstance(outcome, dict):
                continue
            token_id = outcome.get("yes_token_id")
            team_code = outcome.get("team_code") or outcome.get("outcome")
            if not token_id:
                snapshots.append({"team_code": team_code, "outcome": outcome.get("outcome"), "error": "Missing YES token id."})
                continue

            book_body = spread_body = buy_body = sell_body = last_body = tick_body = history_body = {}
            errors: list[str] = []
            for label, getter in [
                ("book", lambda: self.data.get_polymarket_book(str(token_id))),
                ("spread", lambda: self.data.get_polymarket_spread(str(token_id))),
                ("buy_price", lambda: self.data.get_polymarket_price(str(token_id), "BUY")),
                ("sell_price", lambda: self.data.get_polymarket_price(str(token_id), "SELL")),
                ("last_trade", lambda: self.data.get_polymarket_last_trade_price(str(token_id))),
                ("tick_size", lambda: self.data.get_polymarket_tick_size(str(token_id))),
                ("price_history", lambda: self.data.get_polymarket_price_history(str(token_id))),
            ]:
                try:
                    body = self._proxy_body(getter())
                except Exception as exc:
                    body = {}
                    errors.append(f"{label}: {type(exc).__name__}: {exc}")
                if label == "book":
                    book_body = body
                elif label == "spread":
                    spread_body = body
                elif label == "buy_price":
                    buy_body = body
                elif label == "sell_price":
                    sell_body = body
                elif label == "last_trade":
                    last_body = body
                elif label == "tick_size":
                    tick_body = body
                elif label == "price_history":
                    history_body = body

            bids = self._price_levels(book_body.get("bids"), reverse=True)
            asks = self._price_levels(book_body.get("asks"), reverse=False)
            depth = self._depth_for_usd(asks, target)
            history = history_body.get("history") if isinstance(history_body.get("history"), list) else []
            best_bid = bids[0]["price"] if bids else self._decimal_or_none(buy_body.get("price"))
            best_ask = asks[0]["price"] if asks else self._decimal_or_none(sell_body.get("price"))
            spread = self._decimal_or_none(spread_body.get("spread"))
            tick = self._decimal_or_none(tick_body.get("minimum_tick_size") or book_body.get("tick_size"))
            last_trade = self._decimal_or_none(last_body.get("price") or book_body.get("last_trade_price"))
            min_order_size = self._decimal_or_none(book_body.get("min_order_size"))
            price_quality = "good" if depth["fillable"] and best_bid is not None and best_ask is not None and (spread is None or spread <= Decimal("0.02")) else "partial"

            snapshots.append(
                {
                    "team_code": team_code,
                    "outcome": outcome.get("outcome"),
                    "yes_token_id": token_id,
                    "mid": outcome.get("mid"),
                    "best_bid": float(best_bid) if best_bid is not None else None,
                    "best_ask": float(best_ask) if best_ask is not None else None,
                    "spread": float(spread) if spread is not None else None,
                    "tick_size": float(tick) if tick is not None else None,
                    "last_trade_price": float(last_trade) if last_trade is not None else None,
                    "min_order_size_usdc": float(min_order_size) if min_order_size is not None else None,
                    "history_points": len(history),
                    "depth_for_target": depth,
                    "top_bids": [{"price": float(row["price"]), "size": float(row["size"])} for row in bids[:5]],
                    "top_asks": [{"price": float(row["price"]), "size": float(row["size"])} for row in asks[:5]],
                    "price_quality": price_quality,
                    "data_errors": errors,
                }
            )

        result = {
            "fixture_id": fixture_id,
            "event_slug": features.get("event_slug") or context.get("event_slug"),
            "target_usd": f"{target.quantize(Decimal('0.01'))}",
            "outcomes": snapshots,
            "notes": [
                "For buy-YES orders, use best_ask or depth_for_target.worst_price_for_target as the executable price reference, not midpoint.",
                "Bet size must be at least $1 and no more than $15; choose size based on confidence, spread, liquidity, and remaining edge after executable ask.",
            ],
        }
        self._record_tool(
            "get_executable_market_snapshot",
            f"polymarket-clob: Fetched executable bid/ask, spread, tick, last trade, and ${target:.2f} depth for fixture {fixture_id}.",
            {"fixture_id": fixture_id, "target_usd": target_usd},
            result,
            True,
            "execution_market",
        )
        return result

    def get_current_exposure(self, fixture_id: str) -> dict[str, Any]:
        """Return open/closing arena exposure for one fixture id."""
        _emit(self.event_sink, "tool_call_started", "exposure", {"tool_name": "get_current_exposure", "input": {"fixture_id": fixture_id}})
        try:
            result = self.trading.get_exposure(str(fixture_id))
            success = True
        except Exception as exc:
            result = {"positions": [], "error": f"{type(exc).__name__}: {exc}"}
            success = False
        self.last_exposure = result
        positions = result.get("positions") or []
        self._record_tool("get_current_exposure", f"arena: Fetched current exposure for fixture {fixture_id}. Open positions: {len(positions)}.", {"fixture_id": fixture_id}, result, success, "exposure")
        return result

    def record_ledger_checkpoint(
        self,
        stage: str,
        summary: str,
        evidence: dict[str, Any] | None = None,
        data_quality: str = "partial",
        missing_data: list[str] | None = None,
    ) -> dict[str, Any]:
        """Add a schema-safe Thinking checkpoint to the Reasoning Ledger trace."""
        stage_value = str(stage or "checkpoint")[:80]
        summary_value = str(summary or "No summary provided.").strip()
        payload = {
            "stage": stage_value,
            "summary": summary_value,
            "evidence": evidence or {},
            "data_quality": data_quality,
            "missing_data": missing_data or [],
        }
        record = self.ledger.thinking(
            prompt=f"Ledger checkpoint: {stage_value}",
            description=f"Agent-authored ledger checkpoint for {stage_value}.",
            output_payload=payload,
        )
        result = {"recorded": True, "stage": stage_value, "record_id": record["record_id"]}
        _emit(self.event_sink, "ledger_record", "ledger_thinking", {"stage": stage_value, "record_id": record["record_id"]})
        return result

    def submit_prediction_to_stair(self, fixture_id: str, outcome: str, probability: float) -> dict[str, Any]:
        """Submit the required single prediction Acting record to Stair AI and return the response."""
        probability_value = clamp_probability(probability)
        if probability_value is None:
            result = {"submitted": False, "error": "probability must be numeric"}
            self.last_prediction_submission = result
            return result
        window_open, window_error = self._window_is_open(fixture_id)
        if not window_open:
            result = {"submitted": False, "dry_run": self.dry_run, "error": window_error, "fixture_id": str(fixture_id)}
            self.last_prediction_submission = result
            self.ledger.acting(action_type="skip_prediction", target_system="arena", action_summary=window_error or "Prediction skipped.", parameters=result, dry_run=self.dry_run)
            return result
        record = self.ledger.acting(
            action_type="prediction",
            target_system="arena",
            action_summary=f"Predict {outcome} @ {probability_value:.0%} for {fixture_id}",
            parameters={"fixture_id": str(fixture_id), "outcome": str(outcome), "probability": probability_value},
            dry_run=self.dry_run,
        )
        response = self.ledger.submit_record(record, dry_run=self.dry_run)
        result = {"submitted": not self.dry_run, "dry_run": self.dry_run, "record": record, "response": response}
        self.last_prediction_submission = result
        _emit(self.event_sink, "tool_call_completed", "prediction_submission", {"tool_name": "submit_prediction_to_stair", "output": _tool_summary(result), "success": True})
        return result

    def place_bet(self, fixture_code: str, team_code: str, usd_size: str, limit_price: float) -> dict[str, Any]:
        """Place a guarded buy-YES arena order between 1 and 15 USDC."""
        return self.place_guarded_bet(fixture_code, team_code, usd_size, limit_price)
        fixture_id = str(fixture_code)
        _emit(self.event_sink, "tool_call_started", "bet", {"tool_name": "place_bet", "input": {"fixture_id": fixture_id, "team_code": team_code, "usd_size": usd_size, "limit_price": limit_price}})
        validation_error = self._validate_order(fixture_code, team_code, usd_size, limit_price)
        if validation_error:
            result = {"submitted": False, "dry_run": self.dry_run, "error": validation_error}
            self.last_order = result
            self.ledger.acting(action_type="skip_order", target_system="arena", action_summary=validation_error, parameters=result, dry_run=self.dry_run)
            _emit(self.event_sink, "tool_call_completed", "bet", {"tool_name": "place_bet", "output": _tool_summary(result), "success": False})
            return result
        window_open, window_error = self._window_is_open(fixture_id)
        if not window_open:
            result = {"submitted": False, "dry_run": self.dry_run, "error": window_error, "fixture_id": fixture_id}
            self.last_order = result
            self.ledger.acting(action_type="skip_order", target_system="arena", action_summary=window_error or "Order skipped.", parameters=result, dry_run=self.dry_run)
            return result
        exposure = self.last_exposure or self.get_current_exposure(fixture_id)
        if self._has_duplicate_exposure(exposure, fixture_id, str(team_code)):
            result = {"submitted": False, "dry_run": self.dry_run, "error": "Existing exposure on this fixture/outcome blocks duplicate bet."}
            self.last_order = result
            self.ledger.acting(action_type="skip_order", target_system="arena", action_summary=result["error"], parameters=result, dry_run=self.dry_run)
            return result
        order = self.trading.submit_order(
            fixture_code=fixture_id,
            team_code=str(team_code),
            usd_size=str(usd_size),
            limit_price=float(limit_price),
            idempotency_key=str(uuid.uuid4()),
        )
        result = {"submitted": not self.dry_run, "dry_run": self.dry_run, "order": order}
        self.last_order = result
        self.ledger.acting(action_type="open_order", target_system="arena", action_summary=f"open_order on arena: Open ${usd_size} YES on {team_code} @ ≤{limit_price} [{'confirmed' if not self.dry_run else 'simulated'}]", parameters=result, dry_run=self.dry_run, execution_status="pending" if not self.dry_run else "confirmed")
        _emit(self.event_sink, "tool_call_completed", "bet", {"tool_name": "place_bet", "output": _tool_summary(result), "success": True})
        return result

    def place_guarded_bet(self, fixture_code: str, team_code: str, usd_size: str, limit_price: float) -> dict[str, Any]:
        """Place a buy-YES order only after refreshing executable CLOB price/depth guards."""
        fixture_id = str(fixture_code)
        _emit(self.event_sink, "tool_call_started", "bet", {"tool_name": "place_guarded_bet", "input": {"fixture_id": fixture_id, "team_code": team_code, "usd_size": usd_size, "limit_price": limit_price}})
        validation_error = self._validate_order(fixture_code, team_code, usd_size, limit_price)
        if validation_error:
            result = {"submitted": False, "dry_run": self.dry_run, "fixture_id": fixture_id, "team_code": str(team_code), "size_usdc": str(usd_size), "limit_price": limit_price, "error": validation_error}
            self.last_order = result
            self.ledger.acting(action_type="skip_order", target_system="arena", action_summary=validation_error, parameters=result, dry_run=self.dry_run)
            _emit(self.event_sink, "tool_call_completed", "bet", {"tool_name": "place_guarded_bet", "output": _tool_summary(result), "success": False})
            return result
        window_open, window_error = self._window_is_open(fixture_id)
        if not window_open:
            result = {"submitted": False, "dry_run": self.dry_run, "error": window_error, "fixture_id": fixture_id, "team_code": str(team_code), "size_usdc": str(usd_size), "limit_price": limit_price}
            self.last_order = result
            self.ledger.acting(action_type="skip_order", target_system="arena", action_summary=window_error or "Order skipped.", parameters=result, dry_run=self.dry_run)
            return result
        market_error, market_details = self._validate_executable_market(fixture_id, str(team_code), str(usd_size), limit_price)
        if market_error:
            result = {"submitted": False, "dry_run": self.dry_run, "fixture_id": fixture_id, "team_code": str(team_code), "size_usdc": str(usd_size), "limit_price": limit_price, **market_details, "error": market_error}
            self.last_order = result
            self.ledger.acting(action_type="skip_order", target_system="arena", action_summary=market_error, parameters=result, dry_run=self.dry_run)
            _emit(self.event_sink, "tool_call_completed", "bet", {"tool_name": "place_guarded_bet", "output": _tool_summary(result), "success": False})
            return result
        exposure = self.last_exposure or self.get_current_exposure(fixture_id)
        if self._has_duplicate_exposure(exposure, fixture_id, str(team_code)):
            result = {"submitted": False, "dry_run": self.dry_run, "fixture_id": fixture_id, "team_code": str(team_code), "size_usdc": str(usd_size), "limit_price": limit_price, **market_details, "error": "Existing exposure on this fixture/outcome blocks duplicate bet."}
            self.last_order = result
            self.ledger.acting(action_type="skip_order", target_system="arena", action_summary=result["error"], parameters=result, dry_run=self.dry_run)
            return result
        try:
            order = self.trading.submit_fok_order(
                fixture_code=fixture_id,
                team_code=str(team_code),
                usd_size=str(usd_size),
                worst_price=float(limit_price),
                idempotency_key=str(uuid.uuid4()),
            )
        except AttributeError:
            order = self.trading.submit_order(
                fixture_code=fixture_id,
                team_code=str(team_code),
                usd_size=str(usd_size),
                limit_price=float(limit_price),
                idempotency_key=str(uuid.uuid4()),
            )
        final_status = self._poll_order_status(order)
        result = {
            "submitted": not self.dry_run,
            "dry_run": self.dry_run,
            "direction": "buy_yes",
            "fixture_id": fixture_id,
            "team_code": str(team_code),
            "size_usdc": str(usd_size),
            "limit_price": limit_price,
            **market_details,
            "order": order,
            "order_id": self._order_id_from(order),
            "order_status": final_status.get("status") if final_status else order.get("status") if isinstance(order, dict) else None,
            "rejection_reason": final_status.get("rejection_reason") if final_status else None,
            "final_order_status": final_status,
        }
        self.last_order = result
        self.ledger.acting(action_type="open_order", target_system="arena", action_summary=f"open_order on arena: Open ${usd_size} YES on {team_code} @ <= {limit_price} [{'confirmed' if not self.dry_run else 'simulated'}]", parameters=result, dry_run=self.dry_run, execution_status="pending" if not self.dry_run else "confirmed")
        _emit(self.event_sink, "tool_call_completed", "bet", {"tool_name": "place_guarded_bet", "output": _tool_summary(result), "success": True})
        return result

    def _validate_executable_market(self, fixture_id: str, team_code: str, usd_size: str, limit_price: float) -> tuple[str | None, dict[str, Any]]:
        snapshot = self.get_executable_market_snapshot(int(fixture_id), usd_size)
        outcome = next(
            (
                row
                for row in snapshot.get("outcomes") or []
                if str(row.get("team_code") or row.get("outcome") or "").lower() == str(team_code).lower()
            ),
            None,
        )
        if not outcome:
            return f"No executable market snapshot found for outcome {team_code}.", {"market_snapshot": snapshot}
        best_ask = self._decimal_or_none(outcome.get("best_ask"))
        tick = self._decimal_or_none(outcome.get("tick_size")) or Decimal("0.001")
        price = self._decimal_or_none(limit_price)
        details = {
            "best_ask": float(best_ask) if best_ask is not None else None,
            "spread": outcome.get("spread"),
            "tick_size": float(tick),
            "depth_for_target": outcome.get("depth_for_target"),
        }
        if price is None:
            return "limit_price must be numeric.", details
        quotient = price / tick
        if quotient != quotient.to_integral_value():
            return f"limit_price must align with tick size {tick}.", details
        if best_ask is None:
            return "Cannot verify executable ask price for selected outcome.", details
        if price < best_ask:
            return f"limit_price {price} is below current best ask {best_ask}; buy-YES order would likely reject or remain unfilled.", details
        depth = outcome.get("depth_for_target") if isinstance(outcome.get("depth_for_target"), dict) else {}
        if depth.get("fillable") is False:
            return f"Not enough ask-side liquidity to fill ${usd_size} at current book depth.", details
        worst_price = self._decimal_or_none(depth.get("worst_price_for_target"))
        if worst_price is not None and price < worst_price:
            return f"limit_price {price} is below depth-derived worst price {worst_price} for ${usd_size}.", details
        return None, details

    def _order_id_from(self, order: dict[str, Any] | None) -> str | None:
        if not isinstance(order, dict):
            return None
        value = order.get("order_id") or order.get("id")
        nested = order.get("order")
        if not value and isinstance(nested, dict):
            value = nested.get("order_id") or nested.get("id")
        return str(value) if value else None

    def _poll_order_status(self, order: dict[str, Any] | None, attempts: int = 5) -> dict[str, Any]:
        order_id = self._order_id_from(order)
        if self.dry_run or not order_id:
            return {}
        status: dict[str, Any] = {}
        for _ in range(max(1, attempts)):
            try:
                status = self.trading.get_order_status(order_id)
            except Exception:
                time.sleep(1)
                continue
            if str(status.get("status") or "").lower() not in {"pending", "unfilled", "open"}:
                return status
            time.sleep(1)
        return status

    def _validate_order(self, fixture_code: str, team_code: str, usd_size: str, limit_price: float) -> str | None:
        if not fixture_code or not team_code:
            return "fixture_id and team_code are required."
        if str(team_code).lower() == "no":
            return "Only buy-YES orders are supported."
        if not re.fullmatch(r"\d+(\.\d+)?", str(usd_size)):
            return "usd_size must be a positive decimal string."
        try:
            usd_decimal = Decimal(str(usd_size))
        except InvalidOperation:
            return "usd_size must be a positive decimal string."
        max_order_size = self._max_order_size_from_wallet()
        if usd_decimal < Decimal("1"):
            return "usd_size must be at least 1 USDC."
        if max_order_size < Decimal("1"):
            return "Available wallet balance is too low to place the minimum $1 order after Stair's safety buffer."
        if usd_decimal > max_order_size:
            return f"usd_size must be no more than {max_order_size:.2f} USDC based on the $15 cap and available wallet balance."
        try:
            price = Decimal(str(limit_price))
        except InvalidOperation:
            return "limit_price must be numeric."
        if price <= 0 or price >= 1:
            return "limit_price must be greater than 0 and less than 1."
        return None

    def _has_duplicate_exposure(self, exposure: dict[str, Any], fixture_code: str, team_code: str) -> bool:
        positions = exposure.get("positions") or exposure.get("data") or []
        if not isinstance(positions, list):
            return False
        for position in positions:
            if not isinstance(position, dict):
                continue
            position_fixture = position.get("fixture_id") or position.get("fixture_code") or fixture_code
            if str(position_fixture) == fixture_code and str(position.get("team_code") or position.get("outcome") or "") == team_code:
                return True
        return False
