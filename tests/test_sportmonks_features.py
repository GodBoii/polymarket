from sportmonks_features import build_sportmonks_features


def test_prediction_rows_are_not_exposed():
    fixture = {
        "participants": [
            {"id": 10, "name": "Mexico", "short_code": "MEX", "meta": {"location": "home"}},
            {"id": 20, "name": "South Africa", "short_code": "ZAF", "meta": {"location": "away"}},
        ],
        "predictions": [{"type_id": 237, "predictions": {"home": 40.84, "draw": 27.78, "away": 31.38}}],
    }

    features = build_sportmonks_features(fixture)

    assert "predictions" not in features
    assert "data_quality" not in features


def test_match_result_odds_consensus_filters_props_and_removes_vig():
    fixture = {
        "participants": [
            {"id": 10, "name": "Mexico", "short_code": "MEX", "meta": {"location": "home"}},
            {"id": 20, "name": "South Africa", "short_code": "ZAF", "meta": {"location": "away"}},
        ],
        "odds": [
            {"bookmaker_id": 1, "market_id": 1, "label": "1", "probability": "55%"},
            {"bookmaker_id": 1, "market_id": 1, "label": "X", "probability": "27.5%"},
            {"bookmaker_id": 1, "market_id": 1, "label": "2", "probability": "27.5%"},
            {"bookmaker_id": 2, "market_id": 1, "label": "1", "value": "1.80"},
            {"bookmaker_id": 2, "market_id": 1, "label": "X", "value": "4.00"},
            {"bookmaker_id": 2, "market_id": 1, "label": "2", "value": "4.00"},
            {"bookmaker_id": 1, "market_id": 334, "label": "2+", "probability": "29.41%"},
        ],
    }

    odds = build_sportmonks_features(fixture)["odds"]

    assert odds["match_result_row_count"] == 6
    assert odds["match_result_bookmaker_count"] == 2
    assert odds["match_result_vig_free_consensus"] == {
        "MEX": 0.5131,
        "draw": 0.2434,
        "ZAF": 0.2434,
    }


def test_expected_goals_is_included_only_when_available():
    fixture = {
        "participants": [
            {"id": 10, "name": "Mexico", "short_code": "MEX", "meta": {"location": "home"}},
            {"id": 20, "name": "South Africa", "short_code": "ZAF", "meta": {"location": "away"}},
        ],
        "xgfixture": [
            {"participant_id": 10, "value": "1.62"},
            {"participant_id": 20, "value": "0.84"},
        ],
    }

    features = build_sportmonks_features(fixture)

    assert features["expected_goals"] == {"MEX": 1.62, "ZAF": 0.84}
    assert "expected_goals" not in build_sportmonks_features({"participants": fixture["participants"]})


def test_factual_context_omits_absent_sections():
    fixture = {
        "starting_at": "2026-06-11 19:00:00",
        "participants": [
            {"id": 10, "name": "Mexico", "short_code": "MEX", "meta": {"location": "home"}},
            {"id": 20, "name": "South Africa", "short_code": "ZAF", "meta": {"location": "away"}},
        ],
        "metadata": [{"type": "weather", "value": {"temperature": 24, "description": "clear"}}],
        "venue": {"name": "Estadio Azteca"},
        "lineups": [{"participant_id": 10, "formation": "4-3-3"}],
    }

    factual = build_sportmonks_features(fixture)["factual_context"]

    assert factual["kickoff"] == "2026-06-11 19:00:00"
    assert factual["lineup_count"] == 1
    assert "weather" not in factual
    assert "sidelined" not in factual
    assert "referees" not in factual
