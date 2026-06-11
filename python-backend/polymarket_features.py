from __future__ import annotations

from typing import Any

from scout import clamp_probability


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalized(probabilities: dict[str, float | None]) -> dict[str, float | None] | None:
    values = {key: value for key, value in probabilities.items() if value is not None}
    total = sum(values.values())
    if not values or total <= 0:
        return None
    return {key: round(value / total, 4) for key, value in values.items()}


def _outcomes_from_arena_market(arena_market: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not isinstance(arena_market, dict):
        return []
    outcomes = arena_market.get("outcomes") or []
    if not isinstance(outcomes, list):
        return []
    normalized = []
    for row in outcomes:
        if not isinstance(row, dict):
            continue
        name = row.get("name")
        mid = clamp_probability(row.get("mid_price"))
        normalized.append(
            {
                "outcome": name,
                "team_code": name,
                "condition_id": row.get("condition_id"),
                "yes_token_id": row.get("token_id"),
                "mid": mid,
                "source": "stair_normalized_market",
            }
        )
    return normalized


def _outcomes_from_gamma_markets(markets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = []
    for row in markets or []:
        if not isinstance(row, dict):
            continue
        question = str(row.get("question") or "").lower()
        outcome = row.get("outcome") or row.get("team_code")
        if not outcome:
            if "draw" in question:
                outcome = "draw"
            elif row.get("question"):
                outcome = row.get("question")
        normalized.append(
            {
                "outcome": outcome,
                "team_code": outcome,
                "condition_id": row.get("condition_id"),
                "yes_token_id": row.get("yes_token_id"),
                "no_token_id": row.get("no_token_id"),
                "mid": clamp_probability(row.get("mid")),
                "source": "gamma_clob_fallback",
            }
        )
    return normalized


def build_polymarket_features(context: dict[str, Any]) -> dict[str, Any]:
    arena_market = context.get("arena_market")
    arena_outcomes = _outcomes_from_arena_market(arena_market)
    fallback_outcomes = _outcomes_from_gamma_markets(context.get("markets") or [])
    outcomes = arena_outcomes or fallback_outcomes

    mid_probabilities = {
        str(row.get("outcome")): row.get("mid")
        for row in outcomes
        if row.get("outcome") is not None and row.get("mid") is not None
    }
    raw_mid_sum = round(sum(value for value in mid_probabilities.values() if value is not None), 4) if mid_probabilities else None
    normalized_probabilities = _normalized(mid_probabilities)

    pricing_available = len([value for value in mid_probabilities.values() if value is not None]) >= 3
    data_gaps = []
    if not arena_outcomes:
        data_gaps.append("Stair normalized Polymarket market endpoint unavailable; using Gamma/CLOB fallback if present.")
    if not pricing_available:
        data_gaps.append("Missing one or more outcome mid prices.")
    if raw_mid_sum is not None and abs(raw_mid_sum - 1.0) > 0.03:
        data_gaps.append(f"Raw YES midpoint sum is {raw_mid_sum}, materially away from 1.0; use normalized probabilities for comparison.")

    return {
        "source": "stair_normalized_market" if arena_outcomes else "gamma_clob_fallback",
        "fixture_id": (arena_market or {}).get("fixture_id") if isinstance(arena_market, dict) else None,
        "event_slug": (arena_market or {}).get("polymarket_event_slug") if isinstance(arena_market, dict) else context.get("event_slug"),
        "event_ticker": (arena_market or {}).get("polymarket_event_ticker") if isinstance(arena_market, dict) else None,
        "kickoff_at": (arena_market or {}).get("kickoff_at") if isinstance(arena_market, dict) else None,
        "outcomes": outcomes,
        "raw_mid_probabilities": mid_probabilities,
        "normalized_implied_probabilities": normalized_probabilities,
        "raw_mid_sum": raw_mid_sum,
        "pricing_available": pricing_available,
        "market_quality": {
            "has_three_outcomes": len(outcomes) >= 3,
            "has_condition_ids": all(row.get("condition_id") for row in outcomes) if outcomes else False,
            "has_yes_token_ids": all(row.get("yes_token_id") for row in outcomes) if outcomes else False,
            "uses_executable_prices": False,
            "price_source_note": "Only midpoint prices are available in the current feature set. Treat as indicative, not guaranteed executable.",
        },
        "data_gaps": data_gaps,
    }
