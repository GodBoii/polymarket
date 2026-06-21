from ledger import LedgerSink
from polycognitive_tools import FixtureSelectionToolkit, PolycognitiveToolkit
from toolkits import ArenaTradingToolkit


class FakeData:
    def get_sportmonks_schedule(self, season_id=26618):
        return {
            "body": {
                "data": [
                    {
                        "name": "Group Stage",
                        "rounds": [
                            {
                                "name": "1",
                                "fixtures": [
                                    {"id": 19609127, "name": "Mexico vs South Africa", "starting_at": "2026-06-11 19:00:00"}
                                ],
                            }
                        ],
                    }
                ]
            }
        }

    def get_polymarket_listings(self):
        return {"fixtures": [{"fixture_id": "19609127"}]}

    def get_arena_polymarket_market(self, fixture_code):
        return {
            "fixture_id": str(fixture_code),
            "polymarket_event_slug": "mexico-south-africa",
            "outcomes": [
                {"name": "MEX", "team_code": "MEX", "token_id": "mex-token", "condition_id": "mex-condition", "mid_price": 0.65},
                {"name": "draw", "team_code": "draw", "token_id": "draw-token", "condition_id": "draw-condition", "mid_price": 0.22},
                {"name": "ZAF", "team_code": "ZAF", "token_id": "zaf-token", "condition_id": "zaf-condition", "mid_price": 0.13},
            ],
        }

    def get_polymarket_mapping(self, fixture_id):
        return {"mappings": [{"fixture_id": fixture_id, "polymarket_event_slug": "mexico-south-africa"}]}

    def get_polymarket_event(self, event_slug):
        return {"body": [{"slug": event_slug, "markets": []}]}

    def get_polymarket_midpoint(self, token_id):
        mids = {"mex-token": 0.65, "draw-token": 0.22, "zaf-token": 0.13}
        return {"body": {"mid": mids.get(token_id)}}

    def get_polymarket_book(self, token_id):
        books = {
            "mex-token": {
                "bids": [{"price": "0.64", "size": "100"}],
                "asks": [{"price": "0.66", "size": "50"}],
                "min_order_size": "1",
                "tick_size": "0.01",
                "last_trade_price": "0.65",
            },
            "draw-token": {
                "bids": [{"price": "0.21", "size": "30"}],
                "asks": [{"price": "0.23", "size": "100"}],
                "min_order_size": "1",
                "tick_size": "0.01",
                "last_trade_price": "0.22",
            },
            "zaf-token": {
                "bids": [{"price": "0.12", "size": "20"}],
                "asks": [{"price": "0.14", "size": "200"}],
                "min_order_size": "1",
                "tick_size": "0.01",
                "last_trade_price": "0.13",
            },
        }
        return {"body": books[token_id]}

    def get_polymarket_spread(self, token_id):
        return {"body": {"spread": "0.02" if token_id != "mex-token" else "0.01"}}

    def get_polymarket_price(self, token_id, side):
        prices = {
            ("mex-token", "BUY"): "0.64",
            ("mex-token", "SELL"): "0.66",
            ("draw-token", "BUY"): "0.21",
            ("draw-token", "SELL"): "0.23",
            ("zaf-token", "BUY"): "0.12",
            ("zaf-token", "SELL"): "0.14",
        }
        return {"body": {"price": prices[(token_id, side.upper())]}}

    def get_polymarket_last_trade_price(self, token_id):
        return {"body": {"price": {"mex-token": "0.65", "draw-token": "0.22", "zaf-token": "0.13"}[token_id]}}

    def get_polymarket_tick_size(self, token_id):
        return {"body": {"minimum_tick_size": "0.01"}}

    def get_polymarket_price_history(self, token_id, interval="1d"):
        return {"body": {"history": [{"t": 1, "p": 0.5}, {"t": 2, "p": 0.6}]}}

    def get_sportmonks_fixture(self, fixture_id, include=None):
        return {
            "body": {
                "data": {
                    "id": fixture_id,
                    "name": "Mexico vs South Africa",
                    "starting_at": "2026-06-11 19:00:00",
                    "participants": [
                        {"id": 10, "name": "Mexico", "short_code": "MEX", "meta": {"location": "home"}},
                        {"id": 20, "name": "South Africa", "short_code": "ZAF", "meta": {"location": "away"}},
                    ],
                    "venue": {"name": "Mexico City Stadium", "latitude": "19.3029", "longitude": "-99.1505"},
                    "predictions": [{"type_id": 237, "predictions": {"home": 50}}],
                    "odds": [
                        {"bookmaker_id": 1, "market_id": 1, "label": "1", "probability": "55%"},
                        {"bookmaker_id": 1, "market_id": 1, "label": "X", "probability": "25%"},
                        {"bookmaker_id": 1, "market_id": 1, "label": "2", "probability": "20%"},
                    ],
                    "xgfixture": [{"participant_id": 10, "value": "1.1"}],
                }
            }
        }

    def get_sportmonks_head_to_head(self, home_team_id, away_team_id):
        return {"body": {"data": []}}

    def get_supabase_catalog(self):
        return []

    def get_supabase_rows(self, *args, **kwargs):
        return []


class FakeTrading:
    dry_run = True

    def get_agent_profile(self):
        return {
            "agent_id": "agent-1",
            "display_name": "POLYCOGNITIVE",
            "slug": "poly-agent",
            "lifecycle_phase": "active",
            "wallet": {
                "address": "0xabc",
                "available_balance_usdc": "96.93",
                "locked_balance_usdc": "0",
                "polymarket_profile_url": "https://polymarket.com/profile/test",
                "polyscan_url": "https://polygonscan.com/address/test",
            },
        }

    def get_exposure(self, fixture_code=None):
        return {"positions": []}

    def get_match(self, fixture_id):
        return {"fixture_id": str(fixture_id), "current_window": "PRE_MATCH"}

    def submit_order(self, **kwargs):
        return {"dry_run": True, "payload": kwargs}


def contains_key(value, blocked_key):
    if isinstance(value, dict):
        return blocked_key in value or any(contains_key(child, blocked_key) for child in value.values())
    if isinstance(value, list):
        return any(contains_key(child, blocked_key) for child in value)
    return False


def test_fixture_candidates_exclude_prediction_counts():
    toolkit = FixtureSelectionToolkit(FakeData(), LedgerSink("test-session"))

    result = toolkit.get_worldcup_fixture_candidates("test-session")

    assert result["session_id"] == "test-session"
    assert result["fixture_count"] == 1
    assert "prediction_count" not in result["candidates"][0]
    assert "data_boundary" not in result


def test_fixture_candidates_include_exposure_penalty():
    class ExposedTrading(FakeTrading):
        def get_exposure(self, fixture_code=None):
            return {
                "positions": [
                    {
                        "fixture_id": "19609127",
                        "team_code": "draw",
                        "avg_cost_usdc": "0.21",
                        "quantity": "14.285714",
                        "value_usdc": "2.93",
                    }
                ]
            }

    toolkit = FixtureSelectionToolkit(FakeData(), LedgerSink("test-session"), trading=ExposedTrading())

    result = toolkit.get_worldcup_fixture_candidates("test-session")

    candidate = result["candidates"][0]
    assert candidate["open_exposure_count"] == 1
    assert candidate["open_exposure_cost"] > 2.9
    assert "existing exposure penalty" in " ".join(candidate["score_reasons"])


def test_get_account_status_aggregates_wallet_and_positions():
    class ExposedTrading(FakeTrading):
        def get_exposure(self, fixture_code=None):
            return {
                "positions": [
                    {
                        "fixture_id": "19609127",
                        "team_code": "draw",
                        "avg_cost_usdc": "0.21",
                        "quantity": "14.285714",
                        "mark_price": 0.205,
                        "value_usdc": "2.928571",
                        "unrealized_pnl_usdc": "-0.071429",
                        "outcome_token_id": "token-1",
                    }
                ]
            }

    toolkit = PolycognitiveToolkit(FakeData(), ExposedTrading(), LedgerSink("test-session"))

    result = toolkit.get_account_status()

    assert result["wallet"]["available_balance_usdc"] == "96.93"
    assert result["positions_summary"]["open_position_count"] == 1
    assert result["open_positions"][0]["match"] == "Mexico vs South Africa"
    assert result["open_positions"][0]["estimated_cost_usdc"] == "3.00"


def test_match_context_strips_prediction_payloads_and_uses_static_weather():
    toolkit = PolycognitiveToolkit(FakeData(), FakeTrading(), LedgerSink("test-session"))

    result = toolkit.get_match_context(19609127)

    assert not contains_key(result, "predictions")
    assert not contains_key(result, "fulltime_result_probability")
    assert not contains_key(result, "data_boundary")
    assert not contains_key(result, "data_quality")
    assert result["sportmonks"]["weather"]["source"] == "manual_google_weather_screenshot"
    assert result["sportmonks"]["weather"]["matched_by"] == "fixture_id"
    assert result["sportmonks"]["weather"]["description"] == "Scattered thunderstorms"
    assert result["sportmonks"]["weather"]["precip_probability_pct"] == 65
    assert result["sportmonks"]["weather"]["wind_direction"] == "east"


def test_place_bet_rejects_unsafe_orders():
    toolkit = PolycognitiveToolkit(FakeData(), FakeTrading(), LedgerSink("test-session"))

    too_large = toolkit.place_bet("19609127", "MEX", "16.00", 0.5)
    too_small = toolkit.place_bet("19609127", "MEX", "0.50", 0.5)
    bad_price = toolkit.place_bet("19609127", "MEX", "1.00", 1.0)

    assert too_large["submitted"] is False
    assert "no more than 15" in too_large["error"]
    assert too_small["submitted"] is False
    assert "at least 1" in too_small["error"]
    assert bad_price["submitted"] is False
    assert "less than 1" in bad_price["error"]


def test_place_bet_uses_fok_payload_for_stair():
    trading = ArenaTradingToolkit(dry_run=True)
    trading.get_match = lambda fixture_id: {"fixture_id": str(fixture_id), "current_window": "PRE_MATCH"}
    trading.get_exposure = lambda fixture_code=None: {"positions": []}
    toolkit = PolycognitiveToolkit(FakeData(), trading, LedgerSink("test-session"))

    result = toolkit.place_bet("19609127", "MEX", "1.239", 0.68)

    payload = result["order"]["payload"]
    assert payload["fixture_id"] == "19609127"
    assert payload["usd_size"] == "1.23"
    assert payload["worst_price"] == 0.68
    assert result["best_ask"] == 0.66


def test_place_bet_rejects_bad_tick_and_price_below_ask():
    toolkit = PolycognitiveToolkit(FakeData(), FakeTrading(), LedgerSink("test-session"))

    bad_tick = toolkit.place_bet("19609127", "MEX", "1.00", 0.665)
    below_ask = toolkit.place_bet("19609127", "MEX", "1.00", 0.65)

    assert bad_tick["submitted"] is False
    assert "tick size" in bad_tick["error"]
    assert below_ask["submitted"] is False
    assert "below current best ask" in below_ask["error"]


def test_place_bet_allows_up_to_15_usdc():
    toolkit = PolycognitiveToolkit(FakeData(), FakeTrading(), LedgerSink("test-session"))

    result = toolkit.place_bet("19609127", "MEX", "15.00", 0.66)

    assert result["order"]["payload"]["usd_size"] == "15.00"


def test_get_executable_market_snapshot_includes_bid_ask_and_depth():
    toolkit = PolycognitiveToolkit(FakeData(), FakeTrading(), LedgerSink("test-session"))

    result = toolkit.get_executable_market_snapshot(19609127, "15.00")

    mex = next(row for row in result["outcomes"] if row["team_code"] == "MEX")
    assert mex["best_bid"] == 0.64
    assert mex["best_ask"] == 0.66
    assert mex["tick_size"] == 0.01
    assert mex["min_order_size_usdc"] == 1.0
    assert mex["depth_for_target"]["fillable"] is True
    assert mex["depth_for_target"]["worst_price_for_target"] == 0.66


def test_submit_prediction_uses_single_record_shape_in_dry_run():
    toolkit = PolycognitiveToolkit(FakeData(), FakeTrading(), LedgerSink("test-session"), dry_run=True)

    result = toolkit.submit_prediction_to_stair("19609127", "MEX", 0.52)

    record = result["record"]
    assert record["behavior"] == "Acting"
    assert record["action_type"] == "prediction"
    assert record["parameters"] == {"fixture_id": "19609127", "outcome": "MEX", "probability": 0.52}
    assert result["response"]["submitted"] is False
