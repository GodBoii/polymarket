import json

from statsbomb_context import build_statsbomb_context


def test_statsbomb_context_uses_team_name_aliases_without_numeric_ids(tmp_path):
    data_dir = tmp_path / "data"
    matches_dir = data_dir / "matches" / "43"
    lineups_dir = data_dir / "lineups"
    matches_dir.mkdir(parents=True)
    lineups_dir.mkdir(parents=True)

    (matches_dir / "3.json").write_text(
        json.dumps(
            [
                {
                    "match_id": 1001,
                    "match_date": "2010-06-11",
                    "competition": {"competition_name": "FIFA World Cup"},
                    "season": {"season_name": "2010"},
                    "competition_stage": {"name": "Group Stage"},
                    "home_team": {"home_team_name": "South Africa", "managers": [{"name": "Coach A"}]},
                    "away_team": {"away_team_name": "Mexico", "managers": [{"name": "Coach B"}]},
                    "home_score": 1,
                    "away_score": 1,
                    "stadium": {"name": "Soccer City"},
                    "referee": {"name": "Ref A"},
                }
            ]
        ),
        encoding="utf-8",
    )
    (lineups_dir / "1001.json").write_text(
        json.dumps(
            [
                {"team": {"team_name": "Mexico"}, "lineup": [{"player_id": 1, "player_name": "Player M", "country": {"name": "Mexico"}}]},
                {"team": {"team_name": "South Africa"}, "lineup": [{"player_id": 2, "player_name": "Player S", "country": {"name": "South Africa"}}]},
            ]
        ),
        encoding="utf-8",
    )

    context = build_statsbomb_context("Mexico", "South Africa", "MEX", "ZAF", data_dir=data_dir)

    assert context["available"] is True
    assert "Numeric IDs are not Sportmonks or Supabase country IDs." in context["id_warning"]
    assert context["data_quality"]["home_match_count"] == 1
    assert context["data_quality"]["away_match_count"] == 1
    assert context["data_quality"]["h2h_match_count"] == 1
    assert context["lineups"]["home_recent"]["players"][0]["player_name"] == "Player M"
