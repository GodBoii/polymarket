from scout import choose_best_candidate, edge_pp, flatten_schedule, score_candidate


def test_flatten_schedule_walks_rounds_and_stage_fixtures():
    schedule = {
        "body": {
            "data": [
                {
                    "name": "Group Stage",
                    "rounds": [
                        {
                            "name": "1",
                            "fixtures": [
                                {"id": 1, "name": "Mexico vs South Africa", "starting_at": "2026-06-11 19:00:00"},
                                {"id": 2, "name": "Winner Match 1 vs Winner Match 2", "starting_at": "2026-07-01 19:00:00"},
                            ],
                        }
                    ],
                },
                {"name": "Final", "fixtures": [{"id": 3, "name": "Winner Semi-final 1 vs Winner Semi-final 2", "starting_at": "2026-07-19 19:00:00"}]},
            ]
        }
    }

    fixtures = flatten_schedule(schedule)

    assert len(fixtures) == 3
    assert fixtures[0]["fixture_id"] == 1
    assert fixtures[0]["has_named_participants"] is True
    assert fixtures[1]["has_named_participants"] is False


def test_choose_best_candidate_prefers_data_rich_named_fixture():
    weak = score_candidate({"fixture_id": 1, "name": "A vs B", "starting_at": "2026-06-11 19:00:00", "has_named_participants": True})
    strong = score_candidate(
        {"fixture_id": 2, "name": "C vs D", "starting_at": "2026-06-11 20:00:00", "has_named_participants": True},
        mapping_count=1,
        market_count=3,
        midpoint_count=3,
        prediction_count=24,
        odds_count=1000,
    )

    assert choose_best_candidate([weak, strong])["fixture_id"] == 2


def test_edge_pp_normalizes_percent_and_decimal_inputs():
    assert edge_pp(62, 0.55) == 7.0
