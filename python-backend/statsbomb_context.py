from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_STATSBOMB_DATA_DIR = ROOT_DIR / "data" / "statsbomb-open-data" / "data"

TEAM_ALIASES = {
    "Mexico": {"mexico", "mex"},
    "MEX": {"mexico", "mex"},
    "South Africa": {"south africa", "zaf", "rsa"},
    "ZAF": {"south africa", "zaf", "rsa"},
    "RSA": {"south africa", "zaf", "rsa"},
}


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def _aliases(name: str | None, code: str | None = None) -> set[str]:
    values = {_norm(name), _norm(code)}
    for value in [name, code]:
        values.update(TEAM_ALIASES.get(str(value or ""), set()))
    return {value for value in values if value}


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _team_name(team: dict[str, Any] | None) -> str | None:
    if not isinstance(team, dict):
        return None
    return team.get("home_team_name") or team.get("away_team_name") or team.get("team_name") or team.get("name")


def _match_team_names(match: dict[str, Any]) -> tuple[str | None, str | None]:
    return _team_name(match.get("home_team")), _team_name(match.get("away_team"))


def _match_has_team(match: dict[str, Any], aliases: set[str]) -> bool:
    home_name, away_name = _match_team_names(match)
    return _norm(home_name) in aliases or _norm(away_name) in aliases


def _lineup_summary(data_dir: Path, match_id: Any, team_aliases: set[str]) -> dict[str, Any] | None:
    lineups_path = data_dir / "lineups" / f"{match_id}.json"
    if not lineups_path.exists():
        return None
    lineups = _load_json(lineups_path)
    for team in lineups if isinstance(lineups, list) else []:
        team_name = _norm((team.get("team") or {}).get("team_name"))
        if team_name not in team_aliases:
            continue
        players = team.get("lineup") or []
        return {
            "team_name": (team.get("team") or {}).get("team_name"),
            "player_count": len(players),
            "players": [
                {
                    "player_id": player.get("player_id"),
                    "player_name": player.get("player_name"),
                    "country": (player.get("country") or {}).get("name"),
                }
                for player in players[:26]
            ],
        }
    return None


def build_statsbomb_context(
    home_name: str | None,
    away_name: str | None,
    home_code: str | None = None,
    away_code: str | None = None,
    data_dir: str | os.PathLike[str] | None = None,
    max_matches: int = 12,
) -> dict[str, Any]:
    source_dir = Path(data_dir or os.environ.get("STATSBOMB_OPEN_DATA_DIR") or DEFAULT_STATSBOMB_DATA_DIR)
    if not source_dir.exists():
        return {
            "available": False,
            "source_dir": str(source_dir),
            "setup": "Clone https://github.com/statsbomb/open-data.git into data/statsbomb-open-data, or set STATSBOMB_OPEN_DATA_DIR to its data directory.",
            "id_warning": "StatsBomb open data uses its own team names and match IDs. Do not join it to Sportmonks or Supabase by numeric country_id.",
        }

    matches_root = source_dir / "matches"
    if not matches_root.exists():
        return {"available": False, "source_dir": str(source_dir), "error": "Missing matches directory."}

    home_aliases = _aliases(home_name, home_code)
    away_aliases = _aliases(away_name, away_code)
    team_matches: dict[str, list[dict[str, Any]]] = {"home": [], "away": []}
    h2h_matches: list[dict[str, Any]] = []

    for match_path in matches_root.glob("*/*.json"):
        try:
            matches = _load_json(match_path)
        except (OSError, json.JSONDecodeError):
            continue
        for match in matches if isinstance(matches, list) else []:
            has_home = _match_has_team(match, home_aliases)
            has_away = _match_has_team(match, away_aliases)
            if not has_home and not has_away:
                continue
            home_team, away_team = _match_team_names(match)
            row = {
                "match_id": match.get("match_id"),
                "match_date": match.get("match_date"),
                "competition": (match.get("competition") or {}).get("competition_name"),
                "season": (match.get("season") or {}).get("season_name"),
                "stage": (match.get("competition_stage") or {}).get("name"),
                "home_team": home_team,
                "away_team": away_team,
                "home_score": match.get("home_score"),
                "away_score": match.get("away_score"),
                "stadium": (match.get("stadium") or {}).get("name"),
                "referee": (match.get("referee") or {}).get("name"),
                "home_managers": [manager.get("name") for manager in ((match.get("home_team") or {}).get("managers") or [])],
                "away_managers": [manager.get("name") for manager in ((match.get("away_team") or {}).get("managers") or [])],
            }
            if has_home:
                team_matches["home"].append(row)
            if has_away:
                team_matches["away"].append(row)
            if has_home and has_away:
                h2h_matches.append(row)

    for key in team_matches:
        team_matches[key] = sorted(team_matches[key], key=lambda row: row.get("match_date") or "", reverse=True)[:max_matches]
    h2h_matches = sorted(h2h_matches, key=lambda row: row.get("match_date") or "", reverse=True)[:max_matches]

    lineups = {
        "home_recent": _lineup_summary(source_dir, team_matches["home"][0].get("match_id"), home_aliases) if team_matches["home"] else None,
        "away_recent": _lineup_summary(source_dir, team_matches["away"][0].get("match_id"), away_aliases) if team_matches["away"] else None,
    }

    return {
        "available": True,
        "source_dir": str(source_dir),
        "id_warning": "StatsBomb open data is joined by team-name aliases only. Numeric IDs are not Sportmonks or Supabase country IDs.",
        "home_aliases": sorted(home_aliases),
        "away_aliases": sorted(away_aliases),
        "recent_matches": team_matches,
        "head_to_head_matches": h2h_matches,
        "lineups": lineups,
        "data_quality": {
            "home_match_count": len(team_matches["home"]),
            "away_match_count": len(team_matches["away"]),
            "h2h_match_count": len(h2h_matches),
            "home_recent_lineup": lineups["home_recent"] is not None,
            "away_recent_lineup": lineups["away_recent"] is not None,
        },
    }
