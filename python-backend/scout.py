from datetime import datetime, timezone
from typing import Any


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    if "T" not in normalized and " " in normalized:
        normalized = normalized.replace(" ", "T")
    try:
        parsed = datetime.fromisoformat(normalized)
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def flatten_schedule(schedule_envelope: dict[str, Any]) -> list[dict[str, Any]]:
    stages = schedule_envelope.get("body", {}).get("data", schedule_envelope.get("data", []))
    fixtures: list[dict[str, Any]] = []
    for stage in stages or []:
        stage_name = stage.get("name")
        for round_row in stage.get("rounds") or []:
            for fixture in round_row.get("fixtures") or []:
                fixtures.append(_normalize_schedule_fixture(fixture, stage_name, round_row.get("name")))
        for fixture in stage.get("fixtures") or []:
            fixtures.append(_normalize_schedule_fixture(fixture, stage_name, None))
    return sorted(fixtures, key=lambda row: row.get("starting_at") or "")


def _normalize_schedule_fixture(fixture: dict[str, Any], stage_name: str | None, round_name: str | None) -> dict[str, Any]:
    name = fixture.get("name") or ""
    return {
        "fixture_id": fixture.get("id"),
        "fixture_code": str(fixture.get("id")) if fixture.get("id") is not None else None,
        "name": name,
        "starting_at": fixture.get("starting_at"),
        "stage": stage_name,
        "round": round_name,
        "has_named_participants": " vs " in name and not any(marker in name.lower() for marker in ["winner ", "loser ", "1st group", "2nd group", "3rd group"]),
    }


def safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def american_to_probability(odds: float) -> float | None:
    if odds > 0:
        return 100 / (odds + 100)
    if odds < 0:
        return abs(odds) / (abs(odds) + 100)
    return None


def decimal_to_probability(odds: float) -> float | None:
    if odds > 1:
        return 1 / odds
    return None


def odds_to_probability(value: Any) -> float | None:
    odds = safe_float(value)
    if odds is None:
        return None
    if odds > 20 or odds < 0:
        return american_to_probability(odds)
    return decimal_to_probability(odds)


def probability_to_percent(value: Any) -> str:
    prob = safe_float(value)
    if prob is None:
        return "n/a"
    return f"{prob * 100:.1f}%"


def score_candidate(
    fixture: dict[str, Any],
    *,
    now: datetime | None = None,
    mapping_count: int = 0,
    market_count: int = 0,
    midpoint_count: int = 0,
    prediction_count: int = 0,
    odds_count: int = 0,
) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    kickoff = parse_dt(fixture.get("starting_at"))
    hours_until = ((kickoff - now).total_seconds() / 3600) if kickoff else None

    score = 0.0
    reasons: list[str] = []
    if fixture.get("has_named_participants"):
        score += 20
        reasons.append("named teams")
    if hours_until is not None and hours_until >= -2:
        recency_score = max(0, 40 - min(hours_until, 240) / 6)
        score += recency_score
        reasons.append(f"kickoff in {hours_until:.1f}h")
    if mapping_count:
        score += 25
        reasons.append("Polymarket mapping")
    if market_count:
        score += min(15, market_count * 5)
        reasons.append(f"{market_count} markets")
    if midpoint_count:
        score += min(15, midpoint_count * 5)
        reasons.append(f"{midpoint_count} prices")
    if prediction_count:
        score += min(10, prediction_count / 3)
        reasons.append(f"{prediction_count} SportMonks predictions")
    if odds_count:
        score += min(10, odds_count / 250)
        reasons.append(f"{odds_count} odds rows")

    return {
        **fixture,
        "score": round(score, 2),
        "hours_until": round(hours_until, 2) if hours_until is not None else None,
        "mapping_count": mapping_count,
        "market_count": market_count,
        "midpoint_count": midpoint_count,
        "prediction_count": prediction_count,
        "odds_count": odds_count,
        "score_reasons": reasons,
    }


def choose_best_candidate(candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    viable = [candidate for candidate in candidates if candidate.get("has_named_participants")]
    if not viable:
        return None
    return max(viable, key=lambda row: (row.get("score") or 0, -(row.get("hours_until") or 10_000)))


def clamp_probability(value: Any, minimum: float = 0.001, maximum: float = 0.999) -> float | None:
    prob = safe_float(value)
    if prob is None:
        return None
    if prob > 1:
        prob = prob / 100
    return max(minimum, min(maximum, prob))


def edge_pp(prediction_probability: Any, market_probability: Any) -> float | None:
    pred = clamp_probability(prediction_probability)
    market = clamp_probability(market_probability)
    if pred is None or market is None:
        return None
    return round((pred - market) * 100, 2)
