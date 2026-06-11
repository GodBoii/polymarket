from __future__ import annotations

from typing import Any

from scout import parse_dt


STATIC_WEATHER_FORECASTS: list[dict[str, Any]] = [
    {
        "fixture_id": "19609127",
        "fifa_match_id": "400021443",
        "date": "2026-06-11",
        "match": "Mexico v South Africa",
        "group": "Group A",
        "venue": "Mexico City Stadium",
        "city": "Mexico City",
        "region": None,
        "country": "Mexico",
        "summary": "Scattered thunderstorms",
        "high_c": 24,
        "low_c": 15,
        "precip_probability_pct": 65,
        "humidity_pct": 61,
        "uv_index": 11,
        "wind_mph": 3,
        "wind_direction": "east",
        "source": "manual_google_weather_screenshot",
        "notes": "Forecast captured from user-provided screenshot for Thursday, June 11, 2026.",
    },
    {
        "fixture_id": None,
        "fifa_match_id": "400021441",
        "date": "2026-06-11",
        "match": "Korea Republic v Czechia",
        "group": "Group A",
        "venue": "Estadio Guadalajara",
        "city": "Guadalajara",
        "region": "Jalisco",
        "country": "Mexico",
        "summary": "Thunderstorm",
        "high_c": 28,
        "low_c": 18,
        "precip_probability_pct": 40,
        "humidity_pct": 65,
        "uv_index": 11,
        "wind_mph": 3,
        "wind_direction": "southeast",
        "source": "manual_google_weather_screenshot",
        "notes": "Forecast captured from user-provided screenshot for Thursday, June 11, 2026.",
    },
    {
        "fixture_id": None,
        "fifa_match_id": "400021449",
        "date": "2026-06-13",
        "match": "Canada v Bosnia and Herzegovina",
        "group": "Group B",
        "venue": "Toronto Stadium",
        "city": "Toronto",
        "region": "ON",
        "country": "Canada",
        "summary": "Sunny",
        "high_c": 27,
        "low_c": 18,
        "precip_probability_pct": 5,
        "humidity_pct": 52,
        "uv_index": 9,
        "wind_mph": 13,
        "wind_direction": "southwest",
        "source": "manual_google_weather_screenshot",
        "notes": "Forecast captured from user-provided screenshot for Saturday, June 13, 2026.",
    },
    {
        "fixture_id": None,
        "fifa_match_id": "400021458",
        "date": "2026-06-13",
        "match": "USA v Paraguay",
        "group": "Group D",
        "venue": "Los Angeles Stadium",
        "city": "Los Angeles",
        "region": "CA",
        "country": "United States",
        "summary": "Sunny",
        "high_c": 27,
        "low_c": 18,
        "precip_probability_pct": 0,
        "humidity_pct": 63,
        "uv_index": 10,
        "wind_mph": 8,
        "wind_direction": "southwest",
        "source": "manual_google_weather_screenshot",
        "notes": "Forecast captured from user-provided screenshot for Saturday, June 13, 2026.",
    },
    {
        "fixture_id": None,
        "fifa_match_id": None,
        "date": "2026-06-14",
        "match": "Haiti v Scotland",
        "group": "Group C",
        "venue": "Boston Stadium",
        "city": "Boston",
        "region": "MA",
        "country": "United States",
        "summary": "Partly sunny",
        "high_c": 32,
        "low_c": 21,
        "precip_probability_pct": 10,
        "humidity_pct": 49,
        "uv_index": 7,
        "wind_mph": 14,
        "wind_direction": "southwest",
        "source": "manual_google_weather_screenshot",
        "notes": "Forecast captured from user-provided screenshot for Sunday, June 14, 2026.",
    },
    {
        "fixture_id": None,
        "fifa_match_id": None,
        "date": "2026-06-14",
        "match": "Australia v Turkiye",
        "group": "Group D",
        "venue": "BC Place Vancouver",
        "city": "Vancouver",
        "region": "BC",
        "country": "Canada",
        "summary": "Unavailable",
        "high_c": None,
        "low_c": None,
        "precip_probability_pct": None,
        "humidity_pct": None,
        "uv_index": None,
        "wind_mph": None,
        "wind_direction": None,
        "source": "manual_match_schedule",
        "notes": "Match and venue provided by user; weather screenshot not yet provided.",
    },
    {
        "fixture_id": None,
        "fifa_match_id": None,
        "date": "2026-06-14",
        "match": "Brazil v Morocco",
        "group": "Group C",
        "venue": "New York New Jersey Stadium",
        "city": "East Rutherford",
        "region": "NJ",
        "country": "United States",
        "summary": "Partly sunny",
        "high_c": 31,
        "low_c": 21,
        "precip_probability_pct": 5,
        "humidity_pct": 55,
        "uv_index": 9,
        "wind_mph": 11,
        "wind_direction": "southwest",
        "source": "manual_google_weather_screenshot",
        "notes": "Forecast captured from user-provided screenshot for Sunday, June 14, 2026.",
    },
    {
        "fixture_id": None,
        "fifa_match_id": None,
        "date": "2026-06-14",
        "match": "Qatar v Switzerland",
        "group": "Group B",
        "venue": "San Francisco Bay Area Stadium",
        "city": "Santa Clara",
        "region": "CA",
        "country": "United States",
        "summary": "Sunny",
        "high_c": 28,
        "low_c": 15,
        "precip_probability_pct": 0,
        "humidity_pct": 59,
        "uv_index": 10,
        "wind_mph": 6,
        "wind_direction": "southwest",
        "source": "manual_google_weather_screenshot",
        "notes": "Forecast captured from user-provided screenshot for Sunday, June 14, 2026.",
    },
    {
        "fixture_id": None,
        "fifa_match_id": None,
        "date": "2026-06-14",
        "match": None,
        "group": None,
        "venue": "Houston Stadium",
        "city": "Houston",
        "region": "TX",
        "country": "United States",
        "summary": "Scattered thunderstorms",
        "high_c": 30,
        "low_c": 26,
        "precip_probability_pct": 45,
        "humidity_pct": 81,
        "uv_index": 5,
        "wind_mph": 8,
        "wind_direction": "southeast",
        "source": "manual_google_weather_screenshot",
        "notes": "Forecast captured from user-provided screenshot for Sunday, June 14, 2026; match not specified.",
    },
]


def weather_context_from_fixture(fixture: dict[str, Any]) -> dict[str, Any] | None:
    fixture_id = fixture.get("id") or fixture.get("fixture_id") or fixture.get("fixture_code")
    normalized_fixture_id = str(fixture_id) if fixture_id is not None else None
    venue = fixture.get("venue") if isinstance(fixture.get("venue"), dict) else {}
    venue_name = _clean(venue.get("name"))
    city_name = _clean(venue.get("city_name") or venue.get("city") or venue.get("location"))
    kickoff = parse_dt(fixture.get("starting_at"))
    kickoff_date = kickoff.date().isoformat() if kickoff else None
    fixture_name = _clean(fixture.get("name"))

    for row in STATIC_WEATHER_FORECASTS:
        if row.get("fixture_id") and normalized_fixture_id == str(row["fixture_id"]):
            return _format_weather(row, "fixture_id")
        if kickoff_date and row.get("date") != kickoff_date:
            continue
        if venue_name and _clean(row.get("venue")) == venue_name:
            return _format_weather(row, "venue_date")
        if city_name and _clean(row.get("city")) == city_name:
            return _format_weather(row, "city_date")
        if fixture_name and _clean(row.get("match")) and _match_names_overlap(fixture_name, _clean(row.get("match"))):
            return _format_weather(row, "match_date")
    return None


def _format_weather(row: dict[str, Any], matched_by: str) -> dict[str, Any]:
    return {
        "source": row["source"],
        "matched_by": matched_by,
        "match": row["match"],
        "group": row["group"],
        "venue": row["venue"],
        "city": row["city"],
        "region": row.get("region"),
        "country": row["country"],
        "date": row["date"],
        "description": row["summary"],
        "high_c": row["high_c"],
        "low_c": row["low_c"],
        "precip_probability_pct": row["precip_probability_pct"],
        "humidity_pct": row["humidity_pct"],
        "uv_index": row["uv_index"],
        "wind_mph": row["wind_mph"],
        "wind_direction": row["wind_direction"],
        "notes": row["notes"],
    }


def _clean(value: Any) -> str:
    return str(value or "").strip().lower()


def _match_names_overlap(left: str, right: str) -> bool:
    left_parts = {part.strip() for part in left.replace(" v ", " vs ").split(" vs ") if part.strip()}
    right_parts = {part.strip() for part in right.replace(" v ", " vs ").split(" vs ") if part.strip()}
    return bool(left_parts and right_parts and left_parts == right_parts)
