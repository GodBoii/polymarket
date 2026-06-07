import argparse
import json
import time
from typing import Any, Callable

from agents import (
    fixture_selector_agent,
    polymarket_agent,
    prediction_agent,
    prompt_for_fixture_selection,
    prompt_for_polymarket_digest,
    prompt_for_prediction,
    prompt_for_sportmonks_digest,
    prompt_for_strategy,
    prompt_for_supabase_digest,
    sportmonks_agent,
    strategy_agent,
    supabase_agent,
)
from config import DEFAULT_FIXTURE_ID, build_db, load_env
from ledger import LedgerSink
from scout import choose_best_candidate, clamp_probability, edge_pp, flatten_schedule, probability_to_percent, score_candidate
from sportmonks_features import build_sportmonks_features
from strategy_features import build_strategy_context, probability_for_market_outcome
from supabase_context import build_supabase_context
from toolkits import ArenaDataToolkit, ArenaTradingToolkit, build_moneyline_from_gamma, normalize_fixture
from utils import compact_json, extract_json_object, run_content


EventSink = Callable[[str, str, dict[str, Any]], None]


def emit(event_sink: EventSink | None, event_type: str, stage: str, payload: dict[str, Any]) -> None:
    if event_sink:
        event_sink(event_type, stage, payload)


def chat(event_sink: EventSink | None, stage: str, role: str, content: str, **fields: Any) -> None:
    emit(event_sink, "chat_message", stage, {"role": role, "content": content, **fields})


def tool_started(event_sink: EventSink | None, stage: str, tool_name: str, summary: str, input_payload: Any = None) -> None:
    emit(event_sink, "tool_call_started", stage, {"tool_name": tool_name, "summary": summary, "input": input_payload})


def tool_completed(event_sink: EventSink | None, stage: str, tool_name: str, summary: str, output_payload: Any = None, success: bool = True) -> None:
    emit(event_sink, "tool_call_completed", stage, {"tool_name": tool_name, "summary": summary, "output": output_payload, "success": success})


def emit_chunks(event_sink: EventSink | None, stage: str, text: str) -> None:
    if not event_sink:
        return
    for index in range(0, len(text), 160):
        emit(event_sink, "token", stage, {"text": text[index : index + 160]})


def run_agent_json(agent, prompt: str, stage: str = "agent", event_sink: EventSink | None = None) -> dict[str, Any]:
    emit(event_sink, "stage_started", stage, {"prompt_chars": len(prompt)})
    chat(event_sink, stage, "assistant", f"{agent.name} is reviewing the available evidence.")
    response = agent.run(prompt)
    content = run_content(response)
    emit_chunks(event_sink, stage, content)
    emit(
        event_sink,
        "stage_completed",
        stage,
        {
            "content": content,
            "reasoning_summary": getattr(response, "reasoning_content", None) or getattr(response, "reasoning", None),
            "metrics": str(getattr(response, "metrics", "")),
        },
    )
    return extract_json_object(content)


def normalize_probability(value: Any) -> Any:
    if not isinstance(value, (int, float)):
        return value
    return round(value / 100, 4) if value > 1 else value


def normalize_sportmonks_digest(digest: dict[str, Any]) -> dict[str, Any]:
    home_code = digest.get("home_code")
    away_code = digest.get("away_code")
    probabilities = digest.get("probabilities")
    if isinstance(probabilities, dict):
        normalized = {}
        for key, value in probabilities.items():
            fixed_key = key
            if key in {"HOME_CODE", "HOME_TEAM_CODE"} and home_code:
                fixed_key = home_code
            elif key in {"AWAY_CODE", "AWAY_TEAM_CODE"} and away_code:
                fixed_key = away_code
            normalized[fixed_key] = normalize_probability(value)
        digest["probabilities"] = normalized
    return digest


def normalize_prediction(prediction: dict[str, Any]) -> dict[str, Any]:
    if "probability" in prediction:
        prediction["probability"] = normalize_probability(prediction["probability"])
    probabilities = prediction.get("probabilities")
    if isinstance(probabilities, dict):
        prediction["probabilities"] = {key: normalize_probability(value) for key, value in probabilities.items()}
    return prediction


def normalize_strategy(strategy: dict[str, Any], strategy_context: dict[str, Any] | None = None) -> dict[str, Any]:
    if not strategy.get("should_trade"):
        strategy["should_trade"] = False
        strategy["team_code"] = None
        strategy["direction"] = "none"
        strategy["size_usdc"] = "0"
        strategy["limit_price"] = None
    return strategy


def build_sportmonks_context(fixture_envelope: dict[str, Any]) -> dict[str, Any]:
    fixture = fixture_envelope.get("body", {}).get("data", {})
    participants = fixture.get("participants") or []
    home = next((p for p in participants if p.get("meta", {}).get("location") == "home"), {})
    away = next((p for p in participants if p.get("meta", {}).get("location") == "away"), {})
    odds = fixture.get("odds") or []
    features = build_sportmonks_features(fixture)
    return {
        "fixture": fixture.get("name"),
        "fixture_id": fixture.get("id"),
        "starting_at": fixture.get("starting_at"),
        "home": {"name": home.get("name"), "short_code": home.get("short_code"), "id": home.get("id"), "country_id": home.get("country_id")},
        "away": {"name": away.get("name"), "short_code": away.get("short_code"), "id": away.get("id"), "country_id": away.get("country_id")},
        "features": features,
        "prediction_rows": fixture.get("predictions") or [],
        "match_result_odds_rows": features.get("odds", {}).get("match_result_rows") or [],
        "odds_sample": odds[:80],
        "odds_total_rows": len(odds),
        "xg_rows": fixture.get("xgfixture") or [],
        "venue": fixture.get("venue"),
        "weather": fixture.get("weatherreport") or fixture.get("weather_report"),
        "lineups": fixture.get("lineups") or [],
        "sidelined": fixture.get("sidelined") or [],
        "coaches": fixture.get("coaches") or [],
        "referees": fixture.get("referees") or [],
        "stage": fixture.get("stage"),
        "round": fixture.get("round"),
    }


def _sportmonks_enrichment(data: ArenaDataToolkit, fixture: dict[str, Any]) -> dict[str, Any]:
    raw = fixture.get("raw") or {}
    home = fixture.get("home") or {}
    away = fixture.get("away") or {}
    enrichment: dict[str, Any] = {}

    if home.get("id") and away.get("id"):
        try:
            h2h = data.get_sportmonks_head_to_head(int(home["id"]), int(away["id"]))
            h2h_rows = h2h.get("body", {}).get("data", h2h.get("data", []))
            enrichment["head_to_head"] = {
                "available": True,
                "fixture_count": len(h2h_rows or []),
                "fixtures": (h2h_rows or [])[:10],
            }
        except Exception as exc:
            enrichment["head_to_head"] = {"available": False, "error": f"{type(exc).__name__}: {exc}"}

    league = raw.get("league") or {}
    league_id = league.get("id") or raw.get("league_id")
    if league_id:
        try:
            standings = data.get_sportmonks_live_standings(int(league_id))
            standings_rows = standings.get("body", {}).get("data", standings.get("data", []))
            enrichment["live_standings"] = {
                "available": True,
                "league_id": league_id,
                "row_count": len(standings_rows or []),
                "rows": (standings_rows or [])[:30],
            }
        except Exception as exc:
            enrichment["live_standings"] = {"available": False, "league_id": league_id, "error": f"{type(exc).__name__}: {exc}"}

    return enrichment


def build_polymarket_context(data: ArenaDataToolkit, fixture_id: int, fixture_code: str) -> dict[str, Any]:
    mapping = data.get_polymarket_mapping(fixture_id)
    mappings = mapping.get("mappings") or []
    event_slug = mappings[0].get("polymarket_event_slug") if mappings else None

    gamma = data.get_polymarket_event(event_slug) if event_slug else {}
    moneyline = build_moneyline_from_gamma(gamma) if gamma else {"event": None, "markets": []}

    enriched_markets = []
    for market in moneyline.get("markets", []):
        yes_token_id = market.get("yes_token_id")
        midpoint = None
        if yes_token_id:
            midpoint_payload = data.get_polymarket_midpoint(yes_token_id)
            midpoint_body = midpoint_payload.get("body", midpoint_payload)
            midpoint = midpoint_body.get("mid") if isinstance(midpoint_body, dict) else None
        enriched_market = dict(market)
        enriched_market["mid"] = midpoint
        enriched_markets.append(enriched_market)

    arena_market = None
    arena_market_error = None
    try:
        arena_market = data.get_arena_polymarket_market(fixture_code)
    except Exception as exc:
        arena_market_error = f"{type(exc).__name__}: {exc}"

    return {
        "mapping": mapping,
        "event_slug": event_slug,
        "event": moneyline.get("event"),
        "markets": enriched_markets,
        "arena_market": arena_market,
        "arena_market_error": arena_market_error,
    }


def scout_fixture(data: ArenaDataToolkit, event_sink: EventSink | None = None, max_candidates: int = 12) -> tuple[int, dict[str, Any]]:
    chat(event_sink, "scout", "assistant", "I am scanning the World Cup schedule for tradable Polymarket match markets.")
    tool_started(event_sink, "scout", "SportMonks schedule", "Fetch WC2026 schedule", {"season_id": 26618})
    schedule = data.get_sportmonks_schedule()
    fixtures = flatten_schedule(schedule)
    tool_completed(event_sink, "scout", "SportMonks schedule", f"Found {len(fixtures)} fixtures", {"fixture_count": len(fixtures)})

    candidates = []
    for fixture in [row for row in fixtures if row.get("has_named_participants")][:max_candidates]:
        fixture_id = int(fixture["fixture_id"])
        mapping_count = market_count = midpoint_count = prediction_count = odds_count = 0
        try:
            mapping = data.get_polymarket_mapping(fixture_id)
            mappings = mapping.get("mappings") or []
            mapping_count = len(mappings)
            slug = mappings[0].get("polymarket_event_slug") if mappings else None
            if slug:
                moneyline = build_moneyline_from_gamma(data.get_polymarket_event(slug))
                market_count = len(moneyline.get("markets") or [])
                for market in (moneyline.get("markets") or [])[:3]:
                    token_id = market.get("yes_token_id")
                    if token_id:
                        midpoint_body = data.get_polymarket_midpoint(token_id).get("body", {})
                        if isinstance(midpoint_body, dict) and midpoint_body.get("mid") is not None:
                            midpoint_count += 1
        except Exception:
            pass
        try:
            fixture_envelope = data.get_sportmonks_fixture(fixture_id, include="participants;predictions;odds;xGFixture")
            fixture_body = fixture_envelope.get("body", {}).get("data", {})
            prediction_count = len(fixture_body.get("predictions") or [])
            odds_count = len(fixture_body.get("odds") or [])
        except Exception:
            pass
        ranked = score_candidate(
            fixture,
            mapping_count=mapping_count,
            market_count=market_count,
            midpoint_count=midpoint_count,
            prediction_count=prediction_count,
            odds_count=odds_count,
        )
        candidates.append(ranked)
        emit(event_sink, "candidate_ranked", "scout", ranked)

    selected = choose_best_candidate(candidates)
    if not selected:
        named = [row for row in fixtures if row.get("has_named_participants")]
        if not named:
            raise RuntimeError("No named World Cup fixtures were available in the SportMonks schedule.")
        selected = named[0]

    emit(event_sink, "fixture_selected", "scout", selected)
    chat(event_sink, "scout", "assistant", f"I selected {selected.get('name')} because it currently has the strongest mix of timing, data coverage, and market availability.")
    return int(selected["fixture_id"]), {"schedule_count": len(fixtures), "candidates": candidates, "selected": selected}


def execute_strategy(strategy: dict[str, Any], fixture_code: str, trading: ArenaTradingToolkit) -> dict[str, Any]:
    if not strategy.get("should_trade"):
        return {"skipped": True, "reason": strategy.get("rationale"), "strategy": strategy}
    team_code = strategy.get("team_code") or strategy.get("outcome")
    limit_price = strategy.get("limit_price")
    size_usdc = strategy.get("size_usdc") or "0"
    if not team_code or limit_price is None:
        return {"skipped": True, "reason": "Strategy missing team_code or limit_price.", "strategy": strategy}
    return trading.submit_order(fixture_code=fixture_code, team_code=team_code, usd_size=str(size_usdc), limit_price=float(limit_price))


def summarize_final(fixture: dict[str, Any], prediction: dict[str, Any], polymarket_digest: dict[str, Any], strategy: dict[str, Any], execution: dict[str, Any]) -> dict[str, Any]:
    outcome = strategy.get("outcome") or prediction.get("outcome")
    team_code = strategy.get("team_code") or outcome
    market_probability = None
    implied = polymarket_digest.get("implied_probabilities")
    if isinstance(implied, dict) and team_code:
        market_probability = implied.get(team_code)
    if market_probability is None:
        for handle in polymarket_digest.get("execution_handles") or []:
            if handle.get("outcome") == team_code:
                market_probability = handle.get("mid")
                break
    selected_prediction_probability = probability_for_market_outcome(prediction, team_code, implied)
    return {
        "selected_fixture": fixture,
        "prediction_outcome": outcome,
        "prediction_probability": selected_prediction_probability,
        "prediction_probability_display": probability_to_percent(selected_prediction_probability),
        "market_probability": clamp_probability(market_probability),
        "market_probability_display": probability_to_percent(market_probability),
        "edge_pp": strategy.get("edge_pp") if strategy.get("edge_pp") is not None else edge_pp(selected_prediction_probability, market_probability),
        "should_trade": bool(strategy.get("should_trade")),
        "trade": {
            "team_code": strategy.get("team_code"),
            "direction": strategy.get("direction"),
            "size_usdc": strategy.get("size_usdc"),
            "limit_price": strategy.get("limit_price"),
        },
        "rationale": strategy.get("rationale") or prediction.get("rationale"),
        "execution": execution,
    }


def run_pipeline(fixture_id: int | None = None, dry_run: bool = True, event_sink: EventSink | None = None, mode: str = "manual") -> dict[str, Any]:
    load_env()
    db = build_db()
    data = ArenaDataToolkit()
    trading = ArenaTradingToolkit(dry_run=dry_run)
    requested_fixture_id = fixture_id
    scout_report = None

    if mode == "auto" or fixture_id is None:
        mode = "auto"
        fixture_id, scout_report = scout_fixture(data, event_sink)
    else:
        mode = "manual"
    fixture_id = int(fixture_id or DEFAULT_FIXTURE_ID)
    session_id = f"prematch:{fixture_id}:{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}"
    ledger = LedgerSink(session_id)

    ledger.observing(
        trigger_source="python-backend",
        trigger_type=f"{mode}_dashboard_run",
        trigger_description=f"Polycognitive prematch run for fixture {fixture_id}",
        trigger_payload_summary=json.dumps({"mode": mode, "requested_fixture_id": requested_fixture_id, "selected_fixture_id": fixture_id}, ensure_ascii=True),
    )
    emit(event_sink, "ledger_record", "ledger", ledger.records[-1])
    emit(event_sink, "stage_started", "fixture_selector", {"fixture_id": fixture_id, "mode": mode})

    schedule_summary = {"mode": mode, "scout_selected": scout_report.get("selected") if scout_report else None}
    if mode == "manual":
        schedule = data.get_sportmonks_schedule()
        schedule_summary.update({"entries": len(schedule.get("body", {}).get("data", [])), "request_id": schedule.get("requestId")})

    selection = run_agent_json(fixture_selector_agent(db, session_id), prompt_for_fixture_selection(fixture_id, schedule_summary), "fixture_selector", event_sink)
    ledger.thinking(prompt="Fixture selection", description="Fixture selector selected target fixture identity.", output_payload=selection)
    emit(event_sink, "ledger_record", "ledger", ledger.records[-1])

    tool_started(event_sink, "sportmonks_fetch", "SportMonks fixture", "Fetch fixture details", {"fixture_id": fixture_id})
    fixture_envelope = data.get_sportmonks_fixture(fixture_id)
    fixture = normalize_fixture(fixture_envelope)
    ledger.tool_calling(tool_name="get_sportmonks_fixture", description="Fetched SportMonks fixture details.", input_payload={"fixture_id": fixture_id}, output_payload={"fixture": fixture.get("name")}, success=True)
    emit(event_sink, "ledger_record", "ledger", ledger.records[-1])
    tool_completed(event_sink, "sportmonks_fetch", "SportMonks fixture", f"Loaded {fixture.get('name')}", {"fixture": fixture.get("name"), "fixture_id": fixture_id})
    emit(event_sink, "tool_result", "sportmonks_fetch", {"fixture": fixture.get("name"), "fixture_id": fixture_id})

    sportmonks_context = build_sportmonks_context(fixture_envelope)
    sportmonks_context["enrichment"] = _sportmonks_enrichment(data, fixture)
    sportmonks_digest = run_agent_json(sportmonks_agent(db, session_id), prompt_for_sportmonks_digest(compact_json(sportmonks_context, limit=26000)), "sportmonks_agent", event_sink)
    sportmonks_digest = normalize_sportmonks_digest(sportmonks_digest)
    ledger.thinking(prompt="SportMonks digest", description="SportMonks digest.", output_payload=sportmonks_digest)
    emit(event_sink, "ledger_record", "ledger", ledger.records[-1])

    tool_started(event_sink, "polymarket_fetch", "Polymarket market", "Resolve event mapping, Gamma markets, and CLOB midpoints", {"fixture_id": fixture_id})
    polymarket_context = build_polymarket_context(data, fixture_id, fixture["fixture_code"])
    tool_completed(event_sink, "polymarket_fetch", "Polymarket market", "Loaded market context", {"event_slug": polymarket_context.get("event_slug"), "markets": len(polymarket_context.get("markets") or [])})
    emit(event_sink, "tool_result", "polymarket_fetch", {"event_slug": polymarket_context.get("event_slug")})
    polymarket_digest = run_agent_json(polymarket_agent(db, session_id), prompt_for_polymarket_digest(compact_json(polymarket_context, limit=26000)), "polymarket_agent", event_sink)
    ledger.thinking(prompt="Polymarket digest", description="Polymarket digest.", output_payload=polymarket_digest)
    emit(event_sink, "ledger_record", "ledger", ledger.records[-1])

    tool_started(event_sink, "supabase_fetch", "Supabase priors", "Fetch historical country and matchup priors", {"fixture": fixture.get("name")})
    supabase_context = build_supabase_context(data, fixture)
    tool_completed(event_sink, "supabase_fetch", "Supabase priors", "Loaded historical priors", {"tables": list((supabase_context.get("tables") or {}).keys())})
    emit(event_sink, "tool_result", "supabase_fetch", {"tables": list((supabase_context.get("tables") or {}).keys())})
    supabase_digest = run_agent_json(supabase_agent(db, session_id), prompt_for_supabase_digest(compact_json(supabase_context, limit=26000)), "supabase_agent", event_sink)
    ledger.thinking(prompt="Supabase digest", description="Supabase digest.", output_payload=supabase_digest)
    emit(event_sink, "ledger_record", "ledger", ledger.records[-1])

    prediction = run_agent_json(prediction_agent(db, session_id), prompt_for_prediction(sportmonks_digest, supabase_digest), "prediction_agent", event_sink)
    prediction = normalize_prediction(prediction)
    ledger.acting(
        action_type="prediction",
        target_system="arena",
        action_summary=f"Predict {prediction.get('outcome')} at {probability_to_percent(prediction.get('probability'))}",
        parameters={"fixture_code": fixture["fixture_code"], "outcome": prediction.get("outcome"), "probability": clamp_probability(prediction.get("probability"))},
        dry_run=dry_run,
    )
    emit(event_sink, "ledger_record", "ledger", ledger.records[-1])

    strategy_context = build_strategy_context(prediction, polymarket_digest)
    strategy = run_agent_json(strategy_agent(db, session_id), prompt_for_strategy(strategy_context), "strategy_agent", event_sink)
    strategy = normalize_strategy(strategy, strategy_context)
    ledger.thinking(prompt="Strategy decision", description="Strategy decision.", output_payload=strategy)
    emit(event_sink, "ledger_record", "ledger", ledger.records[-1])

    execution = execute_strategy(strategy, fixture["fixture_code"], trading)
    emit(event_sink, "stage_completed", "executor", execution)
    ledger.acting(
        action_type="open_order" if not execution.get("skipped") else "skip_order",
        target_system="arena",
        action_summary=strategy.get("rationale") or ("Skipped order" if execution.get("skipped") else "Submitted order"),
        parameters=execution,
        dry_run=dry_run,
        execution_status="pending" if not execution.get("skipped") else "confirmed",
    )
    emit(event_sink, "ledger_record", "ledger", ledger.records[-1])

    final_summary = summarize_final(fixture, prediction, polymarket_digest, strategy, execution)
    emit(event_sink, "decision", "decision", final_summary)
    chat(event_sink, "decision", "assistant", f"Final decision for {fixture.get('name')}: {'trade' if final_summary['should_trade'] else 'no trade'} on {final_summary.get('prediction_outcome')} with estimated edge {final_summary.get('edge_pp')}pp.", summary=final_summary)

    ledger_result = ledger.submit(dry_run=dry_run)
    emit(event_sink, "stage_completed", "ledger_writer", {"record_count": len(ledger.records), "dry_run": dry_run, "submitted": not dry_run})

    return {
        "session_id": session_id,
        "mode": mode,
        "dry_run": dry_run,
        "scout": scout_report,
        "fixture": {key: fixture.get(key) for key in ["fixture_id", "fixture_code", "name", "starting_at"]},
        "fixture_selection": selection,
        "sportmonks_digest": sportmonks_digest,
        "polymarket_digest": polymarket_digest,
        "supabase_digest": supabase_digest,
        "prediction": prediction,
        "strategy": strategy,
        "execution": execution,
        "summary": final_summary,
        "ledger": ledger_result,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the World Cup Arena polycognitive architecture.")
    parser.add_argument("--fixture-id", type=int, default=None)
    parser.add_argument("--mode", choices=["auto", "manual"], default="auto")
    parser.add_argument("--live-order", action="store_true", help="Actually submit orders and ledger records.")
    args = parser.parse_args()
    result = run_pipeline(fixture_id=args.fixture_id, dry_run=not args.live_order, mode=args.mode)
    print(json.dumps(result, indent=2, ensure_ascii=True, default=str))


if __name__ == "__main__":
    main()
