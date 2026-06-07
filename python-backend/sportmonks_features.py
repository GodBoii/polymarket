from __future__ import annotations

from collections import defaultdict
from statistics import mean
from typing import Any


SPORTMONKS_PREDICTION_TYPES: dict[int, str] = {
    231: "BTTS_PROBABILITY",
    232: "HTFT_PROBABILITY",
    233: "FIRST_HALF_WINNER_PROBABILITY",
    234: "OVER_UNDER_1_5_PROBABILITY",
    235: "OVER_UNDER_2_5_PROBABILITY",
    236: "OVER_UNDER_3_5_PROBABILITY",
    237: "FULLTIME_RESULT_PROBABILITY",
    238: "TEAM_TO_SCORE_FIRST_PROBABILITY",
    239: "DOUBLE_CHANCE_PROBABILITY",
    240: "CORRECT_SCORE_PROBABILITY",
    241: "HISTORICAL_LOG_LOSS",
    242: "MODEL_HIT_RATIO",
    243: "MODEL_PREDICTABILITY",
    244: "MODEL_PREDICTIVE_POWER",
    245: "MODELS_LOG_LOSS",
    326: "HOME_OVER_UNDER_3_5_PROBABILITY",
    327: "AWAY_OVER_UNDER_3_5_PROBABILITY",
    328: "AWAY_OVER_UNDER_2_5_PROBABILITY",
    330: "HOME_OVER_UNDER_2_5_PROBABILITY",
    331: "HOME_OVER_UNDER_1_5_PROBABILITY",
    332: "AWAY_OVER_UNDER_1_5_PROBABILITY",
    333: "AWAY_OVER_UNDER_0_5_PROBABILITY",
    334: "HOME_OVER_UNDER_0_5_PROBABILITY",
    335: "OVER_UNDER_0_5_PROBABILITY",
    1585: "CORNERS_OVER_UNDER_10_5_PROBABILITY",
    1679: "OVER_UNDER_4_5_PROBABILITY",
    1683: "CORNERS_OVER_UNDER_5_PROBABILITY",
    1684: "CORNERS_OVER_UNDER_11_PROBABILITY",
    1685: "CORNERS_OVER_UNDER_6_PROBABILITY",
    1686: "CORNERS_OVER_UNDER_7_PROBABILITY",
    1687: "CORNERS_OVER_UNDER_9_PROBABILITY",
    1688: "CORNERS_OVER_UNDER_10_PROBABILITY",
    1689: "CORNERS_OVER_UNDER_8_PROBABILITY",
    1690: "CORNERS_OVER_UNDER_4_PROBABILITY",
}

MATCH_RESULT_MARKET_IDS = {1}
MATCH_RESULT_MARKET_NAMES = {
    "fulltime result",
    "full time result",
    "match winner",
    "3way result",
    "3-way result",
    "1x2",
}


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip().replace("%", "")
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _probability(value: Any) -> float | None:
    number = _as_float(value)
    if number is None:
        return None
    return round(number / 100, 4) if number > 1 else round(number, 4)


def _decimal_odds_to_probability(value: Any) -> float | None:
    odds = _as_float(value)
    if odds is None or odds <= 1:
        return None
    return round(1 / odds, 4)


def _vig_free(probabilities: dict[str, float | None]) -> dict[str, float | None] | None:
    available = {key: value for key, value in probabilities.items() if value is not None}
    total = sum(available.values())
    if not available or total <= 0:
        return None
    return {key: round(value / total, 4) for key, value in available.items()}


def _participant_by_location(participants: list[dict[str, Any]], location: str) -> dict[str, Any]:
    return next((p for p in participants if p.get("meta", {}).get("location") == location), {})


def _outcome_key(label: Any, home_code: str | None, away_code: str | None) -> str | None:
    normalized = str(label or "").strip().lower()
    if normalized in {"1", "home", "home team", str(home_code or "").lower()}:
        return home_code
    if normalized in {"x", "draw", "tie"}:
        return "draw"
    if normalized in {"2", "away", "away team", str(away_code or "").lower()}:
        return away_code
    return None


def prediction_type_name(type_id: Any) -> str | None:
    try:
        return SPORTMONKS_PREDICTION_TYPES.get(int(type_id))
    except (TypeError, ValueError):
        return None


def extract_prediction_features(
    prediction_rows: list[dict[str, Any]],
    home_code: str | None,
    away_code: str | None,
) -> dict[str, Any]:
    typed_rows = []
    by_type: dict[str, Any] = {}

    for row in prediction_rows:
        type_id = row.get("type_id")
        type_name = prediction_type_name(type_id) or f"UNKNOWN_{type_id}"
        predictions = row.get("predictions") or {}
        typed_rows.append({"type_id": type_id, "type": type_name, "predictions": predictions})
        by_type[type_name] = predictions

    fulltime_raw = by_type.get("FULLTIME_RESULT_PROBABILITY") or {}
    fulltime = None
    if home_code and away_code and fulltime_raw:
        fulltime = {
            home_code: _probability(fulltime_raw.get("home")),
            "draw": _probability(fulltime_raw.get("draw")),
            away_code: _probability(fulltime_raw.get("away")),
        }

    correct_score_raw = by_type.get("CORRECT_SCORE_PROBABILITY") or {}
    scores = correct_score_raw.get("scores") if isinstance(correct_score_raw, dict) else None
    top_scores = []
    if isinstance(scores, dict):
        for score, probability in scores.items():
            parsed = _probability(probability)
            if parsed is not None:
                top_scores.append({"score": str(score), "probability": parsed})
        top_scores = sorted(top_scores, key=lambda row: row["probability"], reverse=True)[:5]

    return {
        "prediction_type_count": len(typed_rows),
        "prediction_types_seen": sorted({row["type"] for row in typed_rows}),
        "fulltime_result_probability": fulltime,
        "btts_probability": _yes_no(by_type.get("BTTS_PROBABILITY")),
        "over_under_2_5_probability": _yes_no(by_type.get("OVER_UNDER_2_5_PROBABILITY")),
        "double_chance_probability": _probability_dict(by_type.get("DOUBLE_CHANCE_PROBABILITY")),
        "team_to_score_first_probability": _probability_dict(by_type.get("TEAM_TO_SCORE_FIRST_PROBABILITY")),
        "correct_score_top": top_scores,
        "model_quality": {
            "historical_log_loss": _as_float(by_type.get("HISTORICAL_LOG_LOSS")),
            "model_hit_ratio": _as_float(by_type.get("MODEL_HIT_RATIO")),
            "model_predictability": _as_float(by_type.get("MODEL_PREDICTABILITY")),
            "model_predictive_power": _as_float(by_type.get("MODEL_PREDICTIVE_POWER")),
            "models_log_loss": _as_float(by_type.get("MODELS_LOG_LOSS")),
        },
        "typed_prediction_rows": typed_rows,
    }


def _yes_no(value: Any) -> dict[str, float | None] | None:
    if not isinstance(value, dict):
        return None
    return {"yes": _probability(value.get("yes")), "no": _probability(value.get("no"))}


def _probability_dict(value: Any) -> dict[str, float | None] | None:
    if not isinstance(value, dict):
        return None
    return {str(key): _probability(probability) for key, probability in value.items()}


def extract_match_odds_features(
    odds_rows: list[dict[str, Any]],
    home_code: str | None,
    away_code: str | None,
) -> dict[str, Any]:
    grouped: dict[int, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    bookmaker_ids: set[int] = set()
    selected_rows = []

    for row in odds_rows:
        market_id = row.get("market_id")
        market_name = str(row.get("market_description") or "").strip().lower()
        is_match_result = market_id in MATCH_RESULT_MARKET_IDS or market_name in MATCH_RESULT_MARKET_NAMES
        if not is_match_result:
            continue

        outcome = _outcome_key(row.get("label"), home_code, away_code)
        if not outcome:
            continue

        bookmaker_id = row.get("bookmaker_id")
        try:
            bookmaker_key = int(bookmaker_id)
        except (TypeError, ValueError):
            bookmaker_key = -1
        bookmaker_ids.add(bookmaker_key)

        probability = _probability(row.get("probability"))
        if probability is None:
            probability = _decimal_odds_to_probability(row.get("value"))
        if probability is None:
            continue

        grouped[bookmaker_key][outcome].append(probability)
        selected_rows.append(
            {
                "bookmaker_id": bookmaker_id,
                "market_id": market_id,
                "label": row.get("label"),
                "value": row.get("value"),
                "probability": probability,
                "latest_bookmaker_update": row.get("latest_bookmaker_update"),
            }
        )

    bookmaker_probabilities = []
    for bookmaker_id, outcomes in grouped.items():
        averaged = {key: round(mean(values), 4) for key, values in outcomes.items() if values}
        normalized = _vig_free(averaged)
        if normalized:
            bookmaker_probabilities.append({"bookmaker_id": bookmaker_id, "probabilities": normalized})

    consensus = None
    if bookmaker_probabilities:
        outcome_values: dict[str, list[float]] = defaultdict(list)
        for row in bookmaker_probabilities:
            for outcome, probability in row["probabilities"].items():
                outcome_values[outcome].append(probability)
        consensus = {outcome: round(mean(values), 4) for outcome, values in outcome_values.items() if values}

    return {
        "match_result_rows": selected_rows[:60],
        "match_result_row_count": len(selected_rows),
        "match_result_bookmaker_count": len({row["bookmaker_id"] for row in bookmaker_probabilities}),
        "match_result_vig_free_consensus": consensus,
        "bookmaker_probabilities": bookmaker_probabilities[:20],
    }


def extract_xg_features(
    xg_rows: list[dict[str, Any]],
    home_id: Any,
    away_id: Any,
    home_code: str | None,
    away_code: str | None,
) -> dict[str, float | None] | None:
    if not home_code or not away_code:
        return None
    result = {home_code: None, away_code: None}
    for row in xg_rows:
        participant_id = row.get("participant_id")
        value = _as_float(row.get("value") if row.get("value") is not None else row.get("data", {}).get("value"))
        if participant_id == home_id:
            result[home_code] = value
        elif participant_id == away_id:
            result[away_code] = value
    return result if any(value is not None for value in result.values()) else None


def build_sportmonks_features(fixture: dict[str, Any]) -> dict[str, Any]:
    participants = fixture.get("participants") or []
    home = _participant_by_location(participants, "home")
    away = _participant_by_location(participants, "away")
    home_code = home.get("short_code")
    away_code = away.get("short_code")

    prediction_features = extract_prediction_features(fixture.get("predictions") or [], home_code, away_code)
    odds_features = extract_match_odds_features(fixture.get("odds") or [], home_code, away_code)
    xg_features = extract_xg_features(fixture.get("xgfixture") or [], home.get("id"), away.get("id"), home_code, away_code)

    data_quality = {
        "participants": "available" if home and away else "missing",
        "fulltime_result_probability": "available" if prediction_features.get("fulltime_result_probability") else "missing",
        "match_result_odds": "available" if odds_features.get("match_result_vig_free_consensus") else "missing",
        "expected_goals": "available" if xg_features else "missing",
        "lineups": "available" if fixture.get("lineups") else "missing",
        "sidelined": "available" if fixture.get("sidelined") else "missing",
        "weather": "available" if (fixture.get("weatherreport") or fixture.get("weather_report")) else "missing",
    }

    return {
        "participant_codes": {"home": home_code, "away": away_code},
        "predictions": prediction_features,
        "odds": odds_features,
        "expected_goals": xg_features,
        "data_quality": data_quality,
    }
