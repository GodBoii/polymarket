import argparse
import json
import time
from typing import Any, Callable

from agents import polycognitive_team
from config import DEFAULT_FIXTURE_ID, build_db, load_env
from ledger import LedgerSink, build_model_invocation
from polycognitive_tools import FixtureSelectionToolkit, PolycognitiveToolkit
from scout import clamp_probability, edge_pp, probability_to_percent
from toolkits import ArenaDataToolkit, ArenaTradingToolkit
from utils import run_content


EventSink = Callable[[str, str, dict[str, Any]], None]


def emit(event_sink: EventSink | None, event_type: str, stage: str, payload: dict[str, Any]) -> None:
    if event_sink:
        event_sink(event_type, stage, payload)


def chat(event_sink: EventSink | None, stage: str, role: str, content: str, **fields: Any) -> None:
    emit(event_sink, "chat_message", stage, {"role": role, "content": content, **fields})


def emit_chunks(event_sink: EventSink | None, stage: str, text: str) -> None:
    if not event_sink:
        return
    for index in range(0, len(text), 160):
        emit(event_sink, "token", stage, {"text": text[index : index + 160]})


def _build_summary(
    *,
    final_text: str,
    match_context: dict[str, Any],
    selected: dict[str, Any],
    prediction_submission: dict[str, Any],
    polymarket_context: dict[str, Any],
    order_result: dict[str, Any],
) -> dict[str, Any]:
    fixture = match_context.get("fixture") or {}
    if not fixture and selected:
        fixture = {key: selected.get(key) for key in ["fixture_id", "name", "starting_at"]}

    prediction_record = prediction_submission.get("record") or {}
    prediction_params = prediction_record.get("parameters") or {}
    polymarket_features = polymarket_context.get("features") or {}
    should_trade = bool(order_result.get("submitted") or (order_result.get("order") and not order_result.get("error")))

    summary = {
        "selected_fixture": fixture,
        "prediction_outcome": prediction_params.get("outcome"),
        "prediction_probability": prediction_params.get("probability"),
        "prediction_probability_display": probability_to_percent(prediction_params.get("probability")),
        "market_probability": None,
        "market_probability_display": "n/a",
        "edge_pp": None,
        "should_trade": should_trade,
        "trade": order_result,
        "rationale": final_text,
        "execution": order_result,
    }

    implied = polymarket_features.get("raw_mid_probabilities") or polymarket_features.get("normalized_implied_probabilities")
    if isinstance(implied, dict) and prediction_params.get("outcome"):
        market_probability = implied.get(prediction_params.get("outcome"))
        summary["market_probability"] = clamp_probability(market_probability)
        summary["market_probability_display"] = probability_to_percent(market_probability)
        summary["edge_pp"] = edge_pp(prediction_params.get("probability"), market_probability)
    return summary


def run_pipeline(fixture_id: int | None = None, dry_run: bool = True, event_sink: EventSink | None = None, mode: str = "manual") -> dict[str, Any]:
    load_env()
    db = build_db()
    data = ArenaDataToolkit()
    trading = ArenaTradingToolkit(dry_run=dry_run)
    profile_sync: dict[str, Any] | None = None
    try:
        profile_sync = trading.sync_agent_profile()
        emit(event_sink, "stage_completed", "agent_profile", {"synced": True, "profile": profile_sync})
    except Exception as exc:
        profile_sync = {"synced": False, "error": f"{type(exc).__name__}: {exc}"}
        emit(event_sink, "stage_completed", "agent_profile", profile_sync)
    requested_fixture_id = fixture_id
    mode = mode if mode in {"auto", "manual"} else "auto"
    session_seed = fixture_id or DEFAULT_FIXTURE_ID
    session_id = f"polycognitive:{session_seed}:{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}"
    ledger = LedgerSink(session_id)

    # --- FIX: use schema-valid trigger_type enum values ---
    trigger_type_value = "cron_trigger" if mode == "auto" else "signal_trigger"

    observing = ledger.observing(
        trigger_source="python-backend",
        trigger_type=trigger_type_value,
        trigger_description=f"POLYCOGNITIVE team run for the World Cup Arena ({mode} mode).",
        trigger_payload_summary=json.dumps({"mode": mode, "requested_fixture_id": requested_fixture_id, "dry_run": dry_run}, ensure_ascii=True),
    )
    emit(event_sink, "ledger_record", "ledger", observing)

    # --- Planning record: show the agent's analysis strategy ---
    plan = ledger.planning(
        goal=f"Analyze World Cup fixture and place optimal prediction-market bet (mode={mode}, dry_run={dry_run}).",
        description="Pre-match analysis and trading plan for the World Cup Arena.",
        steps=[
            {"index": 0, "description": "Select the best available World Cup fixture with Polymarket coverage and Sportmonks data."},
            {"index": 1, "description": "Gather match context: Sportmonks fixture data, lineups, odds, xG, venue, weather, and Supabase historical priors.", "depends_on": [0]},
            {"index": 2, "description": "Fetch Polymarket context: event mapping, Gamma markets, CLOB midpoint prices for all three outcomes.", "depends_on": [0]},
            {"index": 3, "description": "Synthesize evidence into independent probability estimates for home/draw/away. Compare to market prices to find edge.", "depends_on": [1, 2]},
            {"index": 4, "description": "Submit prediction to Stair AI and place guarded buy-YES order on the best positive-edge outcome.", "depends_on": [3]},
        ],
        contingencies=[
            "Skip order if no positive edge exceeds the minimum threshold.",
            "Skip order if wallet balance is below the $1 minimum.",
            "Fall back to basic Sportmonks include if enriched include fails.",
        ],
    )
    emit(event_sink, "ledger_record", "ledger", plan)
    emit(event_sink, "stage_started", "polycognitive", {"session_id": session_id, "mode": mode, "fixture_id": fixture_id})

    fixture_tools = FixtureSelectionToolkit(data, ledger, trading=trading, event_sink=event_sink)
    arena_tools = PolycognitiveToolkit(data, trading, ledger, dry_run=dry_run, event_sink=event_sink)
    arena_tools.last_agent_profile = profile_sync if isinstance(profile_sync, dict) else None
    team = polycognitive_team(db, session_id, fixture_tools, arena_tools)

    prompt = f"""
Start a World Cup Arena run.

Session id: {session_id}
Mode: {mode}
Requested fixture id: {fixture_id if fixture_id is not None else "auto-select"}
Dry run: {dry_run}

Workflow:
1. Delegate fixture selection to fixture_agent. If a requested fixture id is provided, fixture_agent may use it only if it is still a sensible World Cup fixture; otherwise select the best available candidate.
2. Call get_account_status so the team sees wallet balance, open positions, and any prior bets already tied to the slate.
3. Use the selected fixture_id to gather match context, historical evidence, Polymarket context, and current exposure.
4. Submit a Stair AI prediction before any bet.
5. Place a guarded buy-YES bet on the best available outcome. Minimum order size is 1 USDC.
6. Respond naturally in Markdown with the chosen fixture, evidence, market view, prediction, bet, confidence, and main factors.
"""

    final_text = ""
    metrics: Any = None
    response: Any = None
    try:
        response = team.run(prompt, stream=False, stream_intermediate_steps=True, stream_member_events=True)
        final_text = run_content(response)
        metrics = getattr(response, "metrics", None)
    except TypeError:
        response = team.run(prompt)
        final_text = run_content(response)
        metrics = getattr(response, "metrics", None)

    emit_chunks(event_sink, "polycognitive", final_text)

    # --- Intermediate Thinking: match context digest ---
    match_context = arena_tools.last_match_context or {}
    if match_context:
        fixture_info = match_context.get("fixture") or {}
        teams = match_context.get("teams") or {}
        sportmonks = match_context.get("sportmonks") or {}
        historical = match_context.get("historical") or {}
        features = sportmonks.get("features") or {}
        weather = sportmonks.get("weather") or {}

        match_digest = {
            "fixture": fixture_info,
            "teams": teams,
            "odds_summary": features.get("odds") or features.get("bookmaker_consensus"),
            "venue": sportmonks.get("venue"),
            "weather": weather if weather else None,
            "historical_h2h_count": (historical.get("features") or {}).get("h2h", {}).get("row_count"),
            "stage_record": (historical.get("features") or {}).get("stage_record"),
        }
        ledger.thinking(
            prompt="Digest Sportmonks fixture data, historical priors, and weather context into a match evidence summary.",
            description=f"Match context digest for {fixture_info.get('name', 'unknown fixture')}.",
            output_payload=match_digest,
        )
        emit(event_sink, "ledger_record", "ledger_thinking", {"stage": "match_context_digest"})

    # --- Intermediate Thinking: polymarket context digest ---
    polymarket_context = arena_tools.last_polymarket_context or {}
    if polymarket_context:
        poly_features = polymarket_context.get("features") or {}
        raw_probs = poly_features.get("raw_mid_probabilities") or {}
        normalized_probs = poly_features.get("normalized_implied_probabilities") or {}

        poly_digest = {
            "fixture_id": polymarket_context.get("fixture_id"),
            "event_slug": polymarket_context.get("event_slug"),
            "raw_mid_probabilities": raw_probs,
            "normalized_implied_probabilities": normalized_probs,
            "pricing_available": poly_features.get("pricing_available"),
            "market_quality": poly_features.get("market_quality"),
            "data_gaps": poly_features.get("data_gaps"),
        }
        ledger.thinking(
            prompt="Analyze Polymarket prices and compare implied probabilities across all three outcomes (home/draw/away).",
            description="Polymarket context digest with implied probabilities and market quality assessment.",
            output_payload=poly_digest,
        )
        emit(event_sink, "ledger_record", "ledger_thinking", {"stage": "polymarket_digest"})

    # --- Intermediate Thinking: probability & edge analysis ---
    selected = (fixture_tools.last_candidates or {}).get("selected") or {}
    prediction_submission = arena_tools.last_prediction_submission or {}
    prediction_params = (prediction_submission.get("record") or {}).get("parameters") or {}
    order_result = arena_tools.last_order or {"submitted": False, "dry_run": dry_run, "skipped": True}

    if prediction_params:
        summary_data = _build_summary(
            final_text=final_text,
            match_context=match_context,
            selected=selected,
            prediction_submission=prediction_submission,
            polymarket_context=polymarket_context,
            order_result=order_result,
        )
        probability_digest = {
            "predicted_outcome": prediction_params.get("outcome"),
            "predicted_probability": prediction_params.get("probability"),
            "predicted_probability_display": probability_to_percent(prediction_params.get("probability")),
            "market_probability": summary_data.get("market_probability"),
            "market_probability_display": summary_data.get("market_probability_display"),
            "edge_pp": summary_data.get("edge_pp"),
            "should_trade": summary_data.get("should_trade"),
        }
        ledger.thinking(
            prompt="Compare independent probability estimate to Polymarket implied probability. Calculate edge in percentage points and decide whether to trade.",
            description="Probability estimation and edge calculation.",
            output_payload=probability_digest,
        )
        emit(event_sink, "ledger_record", "ledger_thinking", {"stage": "probability_edge"})

    # --- Final Thinking: full LLM synthesis with model invocation ---
    model_inv = build_model_invocation(metrics=metrics, response=response)
    thinking = ledger.thinking(
        prompt="POLYCOGNITIVE final response",
        description="Final natural-language team synthesis with full model invocation and internal reasoning.",
        output_payload=final_text,
        model_invocation=model_inv,
    )
    emit(event_sink, "ledger_record", "ledger", thinking)

    # Rebuild summary with final data
    summary = _build_summary(
        final_text=final_text,
        match_context=match_context,
        selected=selected,
        prediction_submission=prediction_submission,
        polymarket_context=polymarket_context,
        order_result=order_result,
    )

    emit(event_sink, "decision", "decision", summary)
    chat(event_sink, "decision", "assistant", final_text, summary=summary)

    # --- Reflecting record: post-decision quality summary ---
    reflecting_inputs = []
    if prediction_params:
        reflecting_inputs.append({"input_payload": json.dumps({"prediction": prediction_params}, ensure_ascii=True, default=str)})
    if order_result and order_result.get("submitted"):
        reflecting_inputs.append({"input_payload": json.dumps({"order": {"submitted": True, "dry_run": order_result.get("dry_run")}}, ensure_ascii=True, default=str)})

    edge_pp_value = summary.get("edge_pp")
    reflecting_output = {
        "fixture": summary.get("selected_fixture", {}).get("name", "unknown"),
        "outcome": summary.get("prediction_outcome"),
        "probability": summary.get("prediction_probability"),
        "market_probability": summary.get("market_probability"),
        "edge_pp": edge_pp_value,
        "traded": summary.get("should_trade", False),
        "confidence": "high" if edge_pp_value and abs(edge_pp_value) > 5 else "moderate" if edge_pp_value and abs(edge_pp_value) > 2 else "low",
        "data_quality": "good" if match_context and polymarket_context else "partial",
    }
    ledger.reflecting(
        inputs=reflecting_inputs,
        output_payload=json.dumps(reflecting_output, ensure_ascii=True, default=str),
        description="Post-decision quality assessment: edge confidence, data coverage, and trade rationale.",
    )
    emit(event_sink, "ledger_record", "ledger", {"stage": "reflecting"})

    selected_fixture_id = (summary.get("selected_fixture") or {}).get("fixture_id")
    ledger_binding = None
    ledger_validation = None
    if selected_fixture_id is not None and not dry_run:
        ledger_binding = ledger.bind_session_to_fixture(selected_fixture_id, dry_run=False)
        ledger_validation = ledger.validate(fixture_id=selected_fixture_id, dry_run=False)
    ledger_result = ledger.submit(dry_run=dry_run, fixture_id=selected_fixture_id)
    emit(event_sink, "stage_completed", "ledger_writer", {"record_count": len(ledger.records), "dry_run": dry_run, "submitted": not dry_run})

    return {
        "session_id": session_id,
        "mode": mode,
        "dry_run": dry_run,
        "scout": fixture_tools.last_candidates,
        "fixture": summary.get("selected_fixture") or {},
        "fixture_selection": {"selected": selected, "natural_response": None},
        "match_context": match_context,
        "polymarket_context": polymarket_context,
        "exposure": arena_tools.last_exposure,
        "agent_profile_sync": profile_sync,
        "prediction_submission": prediction_submission,
        "execution": order_result,
        "agent_response": final_text,
        "summary": summary,
        "ledger": ledger_result,
        "ledger_binding": ledger_binding,
        "ledger_validation": ledger_validation,
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
