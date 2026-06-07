from supabase_features import build_supabase_features


def test_supabase_features_extract_core_historical_priors():
    context = {
        "home_country": {"country_id": 147, "resolution": {"source": "config_alias", "sportmonks_country_id": 458}},
        "away_country": {"country_id": 211, "resolution": {"source": "config_alias", "sportmonks_country_id": 146}},
        "tables": {
            "ads_a_country_style": [
                {"country_id": 147, "conversion_rate": 0.021, "group_gpg": 0.889, "ko_gpg": 2.0},
                {"country_id": 211, "conversion_rate": 0.077, "group_gpg": 2.333, "ko_gpg": 2.0},
            ],
            "ads_a_stage_record": [
                {"country_id": 147, "stage_canonical": "group", "matches": 9, "win_rate": 0.444},
                {"country_id": 211, "stage_canonical": "group", "matches": 6, "win_rate": 0.167},
            ],
            "ads_a_ko_pattern": [
                {"country_id": 147, "first_ko_loss_rate": 1.0, "modal_exit_stage": "group"},
                {"country_id": 211, "first_ko_loss_rate": 1.0, "modal_exit_stage": "group"},
            ],
            "ads_a_special_match": [{"country_id": 211, "et_win_rate": 0.0, "pen_win_rate": 0.0}],
            "ads_a_h2h_country": [{"country_id_a": 147, "country_id_b": 211, "total_matches": 0}],
        },
    }

    features = build_supabase_features(context)

    assert features["country_ids"]["home"] == 147
    assert features["country_ids"]["home_sportmonks_country_id"] == 458
    assert features["style"]["set_piece_conversion_rate"] == {"home": 0.021, "away": 0.077}
    assert features["style"]["group_goals_conceded_per_game"] == {"home": 0.889, "away": 2.333}
    assert features["stage_record"]["group_win_rate"] == {"home": 0.444, "away": 0.167}
    assert features["knockout_pattern"]["modal_exit_stage"] == {"home": "group", "away": "group"}
    assert features["special_match"]["penalty_win_rate"] == {"home": None, "away": 0.0}
    assert features["h2h"]["row_count"] == 1
