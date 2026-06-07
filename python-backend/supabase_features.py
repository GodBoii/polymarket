from typing import Any


def _by_country(rows: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    result = {}
    for row in rows or []:
        country_id = row.get("country_id")
        if country_id is not None:
            result[int(country_id)] = row
    return result


def _stage_rows(rows: list[dict[str, Any]], country_id: int | None, stage: str) -> dict[str, Any] | None:
    if country_id is None:
        return None
    for row in rows or []:
        if row.get("country_id") == country_id and str(row.get("stage_canonical") or "").lower() == stage:
            return row
    return None


def _value(row: dict[str, Any] | None, key: str) -> Any:
    return row.get(key) if row else None


def build_supabase_features(context: dict[str, Any]) -> dict[str, Any]:
    home = context.get("home_country") or {}
    away = context.get("away_country") or {}
    home_id = home.get("country_id")
    away_id = away.get("country_id")
    tables = context.get("tables") or {}

    style = _by_country(tables.get("ads_a_country_style") or [])
    struct = _by_country(tables.get("ads_a_country_struct") or [])
    ko = _by_country(tables.get("ads_a_ko_pattern") or [])
    special = _by_country(tables.get("ads_a_special_match") or [])
    stage_rows = tables.get("ads_a_stage_record") or []

    home_style = style.get(home_id)
    away_style = style.get(away_id)
    home_ko = ko.get(home_id)
    away_ko = ko.get(away_id)
    home_special = special.get(home_id)
    away_special = special.get(away_id)
    home_group = _stage_rows(stage_rows, home_id, "group")
    away_group = _stage_rows(stage_rows, away_id, "group")

    h2h_rows = tables.get("ads_a_h2h_country") or []
    return {
        "country_ids": {
            "home": home_id,
            "away": away_id,
            "home_source": (home.get("resolution") or {}).get("source"),
            "away_source": (away.get("resolution") or {}).get("source"),
            "home_sportmonks_country_id": (home.get("resolution") or {}).get("sportmonks_country_id"),
            "away_sportmonks_country_id": (away.get("resolution") or {}).get("sportmonks_country_id"),
        },
        "style": {
            "set_piece_conversion_rate": {"home": _value(home_style, "conversion_rate"), "away": _value(away_style, "conversion_rate")},
            "group_goals_conceded_per_game": {"home": _value(home_style, "group_gpg"), "away": _value(away_style, "group_gpg")},
            "knockout_goals_conceded_per_game": {"home": _value(home_style, "ko_gpg"), "away": _value(away_style, "ko_gpg")},
        },
        "stage_record": {
            "group_win_rate": {"home": _value(home_group, "win_rate"), "away": _value(away_group, "win_rate")},
            "group_matches": {"home": _value(home_group, "matches"), "away": _value(away_group, "matches")},
        },
        "knockout_pattern": {
            "first_ko_loss_rate": {"home": _value(home_ko, "first_ko_loss_rate"), "away": _value(away_ko, "first_ko_loss_rate")},
            "modal_exit_stage": {"home": _value(home_ko, "modal_exit_stage"), "away": _value(away_ko, "modal_exit_stage")},
        },
        "special_match": {
            "extra_time_win_rate": {"home": _value(home_special, "et_win_rate"), "away": _value(away_special, "et_win_rate")},
            "penalty_win_rate": {"home": _value(home_special, "pen_win_rate"), "away": _value(away_special, "pen_win_rate")},
        },
        "h2h": {
            "row_count": len(h2h_rows),
            "rows": h2h_rows[:10],
        },
        "data_quality": {
            "style_rows": len(tables.get("ads_a_country_style") or []),
            "stage_rows": len(tables.get("ads_a_stage_record") or []),
            "ko_rows": len(tables.get("ads_a_ko_pattern") or []),
            "special_rows": len(tables.get("ads_a_special_match") or []),
            "h2h_rows": len(h2h_rows),
        },
    }
