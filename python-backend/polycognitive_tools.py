from __future__ import annotations

import re
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
        return {key: output.get(key) for key in ["session_id", "fixture_count", "selected", "fixture", "fixture_id", "fixture_code", "event_slug", "submitted", "dry_run", "error"] if key in output}
    return output


class FixtureSelectionToolkit(Toolkit):
    def __init__(self, data: ArenaDataToolkit, ledger: LedgerSink, event_sink: EventSink | None = None, max_candidates: int = 12) -> None:
        self.data = data
        self.ledger = ledger
        self.event_sink = event_sink
        self.max_candidates = max_candidates
        self.last_candidates: dict[str, Any] | None = None
        super().__init__(name="fixture_selection", tools=[self.get_worldcup_fixture_candidates])

    def get_worldcup_fixture_candidates(self, session_id: str, season_id: int = SPORTMONKS_SEASON_ID) -> dict[str, Any]:
        """Return ranked WC2026 fixture candidates with market and data coverage."""
        _emit(self.event_sink, "tool_call_started", "fixture_selector", {"tool_name": "get_worldcup_fixture_candidates", "input": {"session_id": session_id, "season_id": season_id}})
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
            candidate = score_candidate(
                fixture,
                mapping_count=mapping_count,
                market_count=market_count,
                midpoint_count=midpoint_count,
                odds_count=odds_count,
            )
            if venue:
                candidate["venue"] = venue
            if weather:
                candidate["weather"] = weather
            candidates.append(_prune_agent_payload(candidate))

        selected = choose_best_candidate(candidates)
        result = {
            "session_id": session_id,
            "season_id": season_id,
            "fixture_count": len(fixtures),
            "selected": selected,
            "candidates": candidates,
        }
        self.last_candidates = result
        selected_name = selected.get("name", "unknown") if selected else "none"
        self.ledger.tool_calling(
            tool_name="get_worldcup_fixture_candidates",
            description=f"sportmonks: List WC2026 season schedule to discover fixtures. Found {len(fixtures)} total, ranked {len(candidates)} named candidates. Selected: {selected_name}.",
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
                    "total_fixtures": len(fixtures),
                    "selection_criteria": "Highest composite score based on Polymarket mapping, market count, midpoint availability, and Sportmonks odds coverage.",
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
                self.get_match_context,
                self.get_polymarket_context,
                self.get_current_exposure,
                self.submit_prediction_to_stair,
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
        if match_window.get("current_window"):
            return True, None
        return False, "No Stair AI prediction window is currently open for this fixture."

    def _max_order_size_from_wallet(self) -> Decimal:
        wallet = (self.last_agent_profile or {}).get("wallet") or {}
        balance_raw = wallet.get("available_balance_usdc")
        try:
            balance = Decimal(str(balance_raw))
        except (InvalidOperation, TypeError, ValueError):
            return Decimal("5")
        if balance <= Decimal("0.05"):
            return Decimal("0")
        return min(Decimal("5"), (balance - Decimal("0.05")).quantize(Decimal("0.01")))

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
        event_slug_desc = polymarket_context.get("event_slug") if isinstance(polymarket_context, dict) else event_slug
        self._record_tool("get_polymarket_context", f"polymarket: Fetched market mapping, Gamma event data, and CLOB midpoint prices for event {event_slug or 'unknown'}. Three-outcome market (home/draw/away).", {"fixture_id": fixture_id}, result, True, "polymarket_context")
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
        """Place a guarded buy-YES arena order with a maximum size of 5 USDC."""
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
            return f"usd_size must be no more than {max_order_size:.2f} USDC based on the $5 cap and available wallet balance."
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
