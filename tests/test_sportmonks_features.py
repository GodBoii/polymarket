from sportmonks_features import build_sportmonks_features


def test_decodes_fulltime_probability_without_confusing_first_half():
    fixture = {
        "participants": [
            {"id": 10, "name": "Mexico", "short_code": "MEX", "meta": {"location": "home"}},
            {"id": 20, "name": "South Africa", "short_code": "ZAF", "meta": {"location": "away"}},
        ],
        "predictions": [
            {"type_id": 233, "predictions": {"home": 28.4, "draw": 46.08, "away": 25.52}},
            {"type_id": 237, "predictions": {"home": 40.84, "draw": 27.78, "away": 31.38}},
        ],
    }

    features = build_sportmonks_features(fixture)

    assert features["predictions"]["fulltime_result_probability"] == {
        "MEX": 0.4084,
        "draw": 0.2778,
        "ZAF": 0.3138,
    }
    assert "FIRST_HALF_WINNER_PROBABILITY" in features["predictions"]["prediction_types_seen"]
    assert "FULLTIME_RESULT_PROBABILITY" in features["predictions"]["prediction_types_seen"]


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

    features = build_sportmonks_features(fixture)
    odds = features["odds"]

    assert odds["match_result_row_count"] == 6
    assert odds["match_result_bookmaker_count"] == 2
    assert odds["match_result_vig_free_consensus"] == {
        "MEX": 0.5131,
        "draw": 0.2434,
        "ZAF": 0.2434,
    }


def test_expected_goals_maps_participant_ids_to_team_codes():
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
    assert features["data_quality"]["expected_goals"] == "available"
