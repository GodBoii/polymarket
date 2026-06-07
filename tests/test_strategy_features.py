from strategy_features import build_strategy_context, describe_ml_prediction_risk, probability_for_market_outcome


def test_strategy_context_finds_best_buy_yes_when_favorite_is_overpriced():
    prediction = {
        "probabilities": {"home": 0.41, "draw": 0.28, "away": 0.31},
    }
    polymarket_digest = {
        "implied_probabilities": {"MEX": 0.685, "draw": 0.205, "ZAF": 0.105},
        "execution_handles": [
            {"outcome": "MEX", "yes_token_id": "mex-yes", "mid": 0.685},
            {"outcome": "draw", "yes_token_id": "draw-yes", "mid": 0.205},
            {"outcome": "ZAF", "yes_token_id": "zaf-yes", "mid": 0.105},
        ],
    }

    context = build_strategy_context(prediction, polymarket_digest)

    assert context["edge_table"] == [
        {
            "model_key": "home",
            "outcome": "MEX",
            "team_code": "MEX",
            "prediction_probability": 0.41,
            "market_probability": 0.685,
            "edge_pp": -27.5,
            "yes_token_id": "mex-yes",
            "mid": 0.685,
        },
        {
            "model_key": "draw",
            "outcome": "draw",
            "team_code": "draw",
            "prediction_probability": 0.28,
            "market_probability": 0.205,
            "edge_pp": 7.5,
            "yes_token_id": "draw-yes",
            "mid": 0.205,
        },
        {
            "model_key": "away",
            "outcome": "ZAF",
            "team_code": "ZAF",
            "prediction_probability": 0.31,
            "market_probability": 0.105,
            "edge_pp": 20.5,
            "yes_token_id": "zaf-yes",
            "mid": 0.105,
        },
    ]
    assert context["best_buy_yes"]["team_code"] == "ZAF"
    assert context["best_buy_yes"]["edge_pp"] == 20.5


def test_probability_for_market_outcome_maps_team_codes_back_to_model_keys():
    prediction = {"probability": 0.41, "probabilities": {"home": 0.41, "draw": 0.28, "away": 0.31}}
    implied = {"MEX": 0.685, "draw": 0.205, "ZAF": 0.105}

    assert probability_for_market_outcome(prediction, "MEX", implied) == 0.41
    assert probability_for_market_outcome(prediction, "draw", implied) == 0.28
    assert probability_for_market_outcome(prediction, "ZAF", implied) == 0.31


def test_ml_primary_prediction_warns_without_blocking_best_buy_yes_candidate():
    prediction = {
        "probabilities": {"home": 0.408, "draw": 0.277, "away": 0.315},
        "rationale": "The Sportmonks fulltime result probability model gives Mexico a 40.8% chance.",
        "key_factors": ["Model probability split: home 40.8%, draw 27.7%, away 31.5%"],
        "data_gaps": ["expected_goals missing", "head_to_head missing", "standings missing", "weather missing"],
    }
    polymarket_digest = {
        "implied_probabilities": {"MEX": 0.685, "draw": 0.205, "ZAF": 0.105},
        "execution_handles": [
            {"outcome": "MEX", "yes_token_id": "mex-yes", "mid": 0.685},
            {"outcome": "draw", "yes_token_id": "draw-yes", "mid": 0.205},
            {"outcome": "ZAF", "yes_token_id": "zaf-yes", "mid": 0.105},
        ],
    }

    context = build_strategy_context(prediction, polymarket_digest)

    assert context["ml_prediction_risk"]["level"] == "weak_ml_primary"
    assert "advisory" in context["ml_prediction_risk"]
    assert context["best_buy_yes"]["team_code"] == "ZAF"


def test_ml_prediction_risk_is_advisory_only():
    prediction = {
        "rationale": "Sportmonks model probability is considered with independent lineup and historical evidence.",
        "data_gaps": [],
    }

    risk = describe_ml_prediction_risk(prediction)

    assert risk["level"] == "ml_present"
    assert "advisory" in risk
    assert "trade_allowed" not in risk
    assert "max_size_usdc" not in risk
