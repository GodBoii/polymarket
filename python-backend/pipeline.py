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
from config import COUNTRY_IDS, DEFAULT_FIXTURE_ID, build_db, load_env
from toolkits import (
    ArenaDataToolkit,
    ArenaLedgerToolkit,
    ArenaTradingToolkit,
    build_moneyline_from_gamma,
    new_ledger_record,
    normalize_fixture,
)
from utils import compact_json, extract_json_object, run_content


EventSink = Callable[[str, str, dict[str, Any]], None]


def emit_chunks(event_sink: EventSink | None, stage: str, text: str) -> None:
    if not event_sink:
        return
    for index in range(0, len(text), 80):
        event_sink("token", stage, {"text": text[index : index + 80]})


def run_agent_json(agent, prompt: str, stage: str = "agent", event_sink: EventSink | None = None) -> dict[str, Any]:
    if event_sink:
        event_sink("stage_started", stage, {"prompt_chars": len(prompt)})
    response = agent.run(prompt)
    content = run_content(response)
    emit_chunks(event_sink, stage, content)
    if event_sink:
        event_sink(
            "stage_completed",
            stage,
            {
                "content": content,
                "thinking": getattr(response, "reasoning_content", None) or getattr(response, "reasoning", None),
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
            if key == "HOME_CODE" and home_code:
                fixed_key = home_code
            elif key == "AWAY_CODE" and away_code:
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


def normalize_strategy(strategy: dict[str, Any]) -> dict[str, Any]:
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
    return {
        "fixture": fixture.get("name"),
        "fixture_id": fixture.get("id"),
        "starting_at": fixture.get("starting_at"),
        "home": {"name": home.get("name"), "short_code": home.get("short_code"), "id": home.get("id")},
        "away": {"name": away.get("name"), "short_code": away.get("short_code"), "id": away.get("id")},
        "prediction_rows": fixture.get("predictions") or [],
        "odds_sample": odds[:120],
        "odds_total_rows": len(odds),
        "xg_rows": fixture.get("xgfixture") or [],
    }


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


def build_supabase_context(data: ArenaDataToolkit, fixture: dict[str, Any]) -> dict[str, Any]:
    home = fixture.get("home") or {}
    away = fixture.get("away") or {}
    home_code = home.get("short_code")
    away_code = away.get("short_code")
    home_name = home.get("name")
    away_name = away.get("name")
    home_country_id = COUNTRY_IDS.get(home_code) or COUNTRY_IDS.get(home_name)
    away_country_id = COUNTRY_IDS.get(away_code) or COUNTRY_IDS.get(away_name)
    country_filter = f"in.({home_country_id},{away_country_id})"

    catalog = data.get_supabase_catalog()
    tables = {row.get("table_name") for row in catalog}
    context: dict[str, Any] = {
        "home_country": {"name": home_name, "code": home_code, "country_id": home_country_id},
        "away_country": {"name": away_name, "code": away_code, "country_id": away_country_id},
        "catalog_tables": catalog,
        "tables": {},
    }

    for table_name in [
        "ads_a_country_style",
        "ads_a_country_struct",
        "ads_a_ko_pattern",
        "ads_a_special_match",
        "ads_a_stage_record",
    ]:
        if table_name in tables:
            context["tables"][table_name] = data.get_supabase_rows(
                table_name,
                filters={"country_id": country_filter},
                limit=20,
            )

    if "ads_a_h2h_country" in tables and home_country_id and away_country_id:
        context["tables"]["ads_a_h2h_country"] = data.get_supabase_rows(
            "ads_a_h2h_country",
            filters={"country_id_a": f"eq.{home_country_id}", "country_id_b": f"eq.{away_country_id}"},
            limit=10,
        )

    return context


def execute_strategy(
    strategy: dict[str, Any],
    fixture_code: str,
    trading: ArenaTradingToolkit,
) -> dict[str, Any]:
    if not strategy.get("should_trade"):
        return {"skipped": True, "reason": strategy.get("rationale"), "strategy": strategy}

    team_code = strategy.get("team_code") or strategy.get("outcome")
    limit_price = strategy.get("limit_price")
    size_usdc = strategy.get("size_usdc") or "0"
    if not team_code or limit_price is None:
        return {"skipped": True, "reason": "Strategy missing team_code or limit_price.", "strategy": strategy}

    return trading.submit_order(
        fixture_code=fixture_code,
        team_code=team_code,
        usd_size=str(size_usdc),
        limit_price=float(limit_price),
    )


def run_pipeline(fixture_id: int, dry_run: bool = True, event_sink: EventSink | None = None) -> dict[str, Any]:
    load_env()
    db = build_db()
    data = ArenaDataToolkit()
    trading = ArenaTradingToolkit(dry_run=dry_run)
    ledger = ArenaLedgerToolkit(dry_run=dry_run)
    session_id = f"prematch:{fixture_id}:{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}"

    records = [
        new_ledger_record(
            session_id,
            "Observing",
            trigger_source="python-backend",
            trigger_type="manual_run",
            trigger_description=f"Prematch architecture run for fixture {fixture_id}",
        )
    ]
    if event_sink:
        event_sink("stage_started", "fixture_selector", {"fixture_id": fixture_id})

    schedule = data.get_sportmonks_schedule()
    schedule_summary = {
        "entries": len(schedule.get("body", {}).get("data", [])),
        "request_id": schedule.get("requestId"),
    }
    selection = run_agent_json(
        fixture_selector_agent(db, session_id),
        prompt_for_fixture_selection(fixture_id, schedule_summary),
        "fixture_selector",
        event_sink,
    )
    records.append(
        new_ledger_record(
            session_id,
            "Thinking",
            description="Fixture selector selected target fixture identity.",
            output_payload=selection,
        )
    )

    fixture_envelope = data.get_sportmonks_fixture(fixture_id)
    fixture = normalize_fixture(fixture_envelope)
    records.append(
        new_ledger_record(
            session_id,
            "ToolCalling",
            description="Fetched Sportmonks fixture details.",
            tool_meta={"name": "get_sportmonks_fixture"},
            input_payload={"fixture_id": fixture_id},
            output_payload={"fixture": fixture.get("name")},
            success=True,
        )
    )
    if event_sink:
        event_sink("tool_result", "sportmonks_fetch", {"fixture": fixture.get("name"), "fixture_id": fixture_id})

    sportmonks_context = build_sportmonks_context(fixture_envelope)
    sportmonks_digest = run_agent_json(
        sportmonks_agent(db, session_id),
        prompt_for_sportmonks_digest(compact_json(sportmonks_context, limit=26000)),
        "sportmonks_agent",
        event_sink,
    )
    sportmonks_digest = normalize_sportmonks_digest(sportmonks_digest)
    records.append(new_ledger_record(session_id, "Thinking", description="Sportmonks digest.", output_payload=sportmonks_digest))

    polymarket_context = build_polymarket_context(data, fixture_id, fixture["fixture_code"])
    if event_sink:
        event_sink("tool_result", "polymarket_fetch", {"event_slug": polymarket_context.get("event_slug")})
    polymarket_digest = run_agent_json(
        polymarket_agent(db, session_id),
        prompt_for_polymarket_digest(compact_json(polymarket_context, limit=26000)),
        "polymarket_agent",
        event_sink,
    )
    records.append(new_ledger_record(session_id, "Thinking", description="Polymarket digest.", output_payload=polymarket_digest))

    supabase_context = build_supabase_context(data, fixture)
    if event_sink:
        event_sink("tool_result", "supabase_fetch", {"tables": list((supabase_context.get("tables") or {}).keys())})
    supabase_digest = run_agent_json(
        supabase_agent(db, session_id),
        prompt_for_supabase_digest(compact_json(supabase_context, limit=26000)),
        "supabase_agent",
        event_sink,
    )
    records.append(new_ledger_record(session_id, "Thinking", description="Supabase digest.", output_payload=supabase_digest))

    prediction = run_agent_json(
        prediction_agent(db, session_id),
        prompt_for_prediction(sportmonks_digest, supabase_digest),
        "prediction_agent",
        event_sink,
    )
    prediction = normalize_prediction(prediction)
    records.append(
        new_ledger_record(
            session_id,
            "Acting",
            action_type="prediction",
            parameters={
                "fixture_code": fixture["fixture_code"],
                "outcome": prediction.get("outcome"),
                "probability": prediction.get("probability"),
            },
            notes=prediction.get("rationale"),
        )
    )

    strategy = run_agent_json(
        strategy_agent(db, session_id),
        prompt_for_strategy(prediction, polymarket_digest),
        "strategy_agent",
        event_sink,
    )
    strategy = normalize_strategy(strategy)
    records.append(new_ledger_record(session_id, "Thinking", description="Strategy decision.", output_payload=strategy))

    execution = execute_strategy(strategy, fixture["fixture_code"], trading)
    if event_sink:
        event_sink("stage_completed", "executor", execution)
    records.append(
        new_ledger_record(
            session_id,
            "Acting",
            action_type="order" if not execution.get("skipped") else "skip_order",
            parameters=execution,
        )
    )

    ledger_result = ledger.submit_ledger_batch(records)
    if event_sink:
        event_sink("stage_completed", "ledger_writer", {"record_count": len(records), "dry_run": dry_run})

    return {
        "session_id": session_id,
        "dry_run": dry_run,
        "fixture": {key: fixture.get(key) for key in ["fixture_id", "fixture_code", "name", "starting_at"]},
        "fixture_selection": selection,
        "sportmonks_digest": sportmonks_digest,
        "polymarket_digest": polymarket_digest,
        "supabase_digest": supabase_digest,
        "prediction": prediction,
        "strategy": strategy,
        "execution": execution,
        "ledger": ledger_result,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the World Cup Arena multi-agent architecture.")
    parser.add_argument("--fixture-id", type=int, default=DEFAULT_FIXTURE_ID)
    parser.add_argument("--live-order", action="store_true", help="Actually submit orders and ledger records.")
    args = parser.parse_args()

    result = run_pipeline(fixture_id=args.fixture_id, dry_run=not args.live_order)
    print(json.dumps(result, indent=2, ensure_ascii=True, default=str))


if __name__ == "__main__":
    main()
