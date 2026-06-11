from polymarket_features import build_polymarket_features


def test_polymarket_features_prefers_stair_normalized_market():
    context = {
        "event_slug": "fallback-slug",
        "arena_market": {
            "fixture_id": "19609127",
            "polymarket_event_slug": "fifwc-mex-rsa-2026-06-11",
            "kickoff_at": 1781204400000,
            "outcomes": [
                {"name": "MEX", "condition_id": "mex-condition", "token_id": "mex-token", "mid_price": 0.685},
                {"name": "ZAF", "condition_id": "zaf-condition", "token_id": "zaf-token", "mid_price": 0.105},
                {"name": "draw", "condition_id": "draw-condition", "token_id": "draw-token", "mid_price": 0.205},
            ],
        },
    }

    features = build_polymarket_features(context)

    assert features["source"] == "stair_normalized_market"
    assert features["fixture_id"] == "19609127"
    assert features["event_slug"] == "fifwc-mex-rsa-2026-06-11"
    assert features["raw_mid_probabilities"] == {"MEX": 0.685, "ZAF": 0.105, "draw": 0.205}
    assert features["raw_mid_sum"] == 0.995
    assert features["normalized_implied_probabilities"] == {"MEX": 0.6884, "ZAF": 0.1055, "draw": 0.206}
    assert features["pricing_available"] is True
    assert features["market_quality"]["has_yes_token_ids"] is True


def test_polymarket_features_flags_missing_executable_market_quality():
    features = build_polymarket_features({"arena_market": {"outcomes": []}, "markets": []})

    assert features["pricing_available"] is False
    assert "Missing one or more outcome mid prices." in features["data_gaps"]
    assert features["market_quality"]["uses_executable_prices"] is False
