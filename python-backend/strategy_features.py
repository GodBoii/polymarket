from typing import Any

from scout import clamp_probability, edge_pp


def describe_ml_prediction_risk(prediction: dict[str, Any]) -> dict[str, Any]:
    text_parts = [
        str(prediction.get("rationale") or ""),
        " ".join(str(item) for item in prediction.get("key_factors") or []),
        " ".join(str(item) for item in prediction.get("data_gaps") or []),
    ]
    text = " ".join(text_parts).lower()
    data_gaps = [str(item).lower() for item in prediction.get("data_gaps") or []]

    ml_terms = ["sportmonks model", "model probability", "ml", "fulltime result probability", "prediction model"]
    core_gap_terms = ["expected", "xg", "head-to-head", "h2h", "standings", "historical", "lineup", "weather", "form"]
    sportmonks_ml_dependent = any(term in text for term in ml_terms)
    missing_core_context = sum(1 for gap in data_gaps if any(term in gap for term in core_gap_terms))

    if sportmonks_ml_dependent and missing_core_context >= 3:
        return {
            "level": "weak_ml_primary",
            "advisory": "Prediction appears primarily driven by Sportmonks ML probabilities while core non-ML context is missing. Treat the edge as unreliable unless the agent can cite stronger factual evidence.",
        }
    if sportmonks_ml_dependent:
        return {
            "level": "ml_present",
            "advisory": "Sportmonks ML probabilities are present. They are public, easy to overfit to, and should be used only as weak calibration beside factual football evidence.",
        }
    return {
        "level": "not_ml_primary",
        "advisory": "Prediction is not primarily described as Sportmonks-ML driven.",
    }


def build_strategy_context(prediction: dict[str, Any], polymarket_digest: dict[str, Any]) -> dict[str, Any]:
    implied = polymarket_digest.get("implied_probabilities") if isinstance(polymarket_digest, dict) else None
    prediction_probs = prediction.get("probabilities") if isinstance(prediction, dict) else None
    handles = polymarket_digest.get("execution_handles") if isinstance(polymarket_digest, dict) else None
    if not isinstance(implied, dict) or not isinstance(prediction_probs, dict):
        return {"prediction": prediction, "polymarket_digest": polymarket_digest, "edge_table": []}

    market_codes = [key for key in implied.keys() if key != "draw"]
    home_code = market_codes[0] if market_codes else "home"
    away_code = market_codes[-1] if len(market_codes) > 1 else "away"
    outcome_map = {"home": home_code, "draw": "draw", "away": away_code}

    handle_by_outcome = {}
    if isinstance(handles, list):
        handle_by_outcome = {row.get("outcome"): row for row in handles if isinstance(row, dict)}

    edge_table = []
    for model_key, market_key in outcome_map.items():
        pred_prob = clamp_probability(prediction_probs.get(model_key))
        market_prob = clamp_probability(implied.get(market_key))
        edge = edge_pp(pred_prob, market_prob)
        handle = handle_by_outcome.get(market_key, {})
        edge_table.append(
            {
                "model_key": model_key,
                "outcome": market_key,
                "team_code": market_key,
                "prediction_probability": pred_prob,
                "market_probability": market_prob,
                "edge_pp": edge,
                "yes_token_id": handle.get("yes_token_id") if isinstance(handle, dict) else None,
                "mid": handle.get("mid") if isinstance(handle, dict) else market_prob,
            }
        )

    positive_edges = [row for row in edge_table if row.get("edge_pp") is not None and row["edge_pp"] >= 5]
    best_buy_yes = max(positive_edges, key=lambda row: row["edge_pp"], default=None)
    ml_prediction_risk = describe_ml_prediction_risk(prediction)

    return {
        "prediction": prediction,
        "polymarket_digest": polymarket_digest,
        "outcome_mapping": outcome_map,
        "edge_table": edge_table,
        "best_buy_yes": best_buy_yes,
        "ml_prediction_risk": ml_prediction_risk,
        "order_capability": "Stair arena orders submit buy-YES by fixture_code/team_code. To fade an overpriced outcome, buy YES on the underpriced alternative with the best positive edge.",
    }


def probability_for_market_outcome(prediction: dict[str, Any], market_outcome: str | None, implied: dict[str, Any] | None = None) -> float | None:
    if not market_outcome:
        return None
    probabilities = prediction.get("probabilities")
    if not isinstance(probabilities, dict):
        return clamp_probability(prediction.get("probability"))

    if market_outcome == "draw":
        return clamp_probability(probabilities.get("draw"))

    implied = implied if isinstance(implied, dict) else {}
    market_codes = [key for key in implied.keys() if key != "draw"]
    if market_codes and market_outcome == market_codes[0]:
        return clamp_probability(probabilities.get("home"))
    if len(market_codes) > 1 and market_outcome == market_codes[-1]:
        return clamp_probability(probabilities.get("away"))
    return clamp_probability(prediction.get("probability"))
