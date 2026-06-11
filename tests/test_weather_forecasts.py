from weather_forecasts import weather_context_from_fixture


def test_weather_forecast_matches_mexico_fixture_id():
    weather = weather_context_from_fixture({"id": 19609127, "starting_at": "2026-06-11 19:00:00", "venue": {"name": "Mexico City Stadium"}})

    assert weather["matched_by"] == "fixture_id"
    assert weather["description"] == "Scattered thunderstorms"
    assert weather["high_c"] == 24
    assert weather["precip_probability_pct"] == 65


def test_weather_forecast_matches_other_venues_by_date():
    guadalajara = weather_context_from_fixture({"starting_at": "2026-06-11 19:00:00", "venue": {"name": "Estadio Guadalajara"}})
    toronto = weather_context_from_fixture({"starting_at": "2026-06-13 19:00:00", "venue": {"name": "Toronto Stadium"}})
    los_angeles = weather_context_from_fixture({"starting_at": "2026-06-13 19:00:00", "venue": {"name": "Los Angeles Stadium"}})

    assert guadalajara["description"] == "Thunderstorm"
    assert guadalajara["precip_probability_pct"] == 40
    assert toronto["description"] == "Sunny"
    assert toronto["wind_mph"] == 13
    assert los_angeles["description"] == "Sunny"
    assert los_angeles["precip_probability_pct"] == 0


def test_weather_forecast_returns_none_for_unknown_fixture():
    assert weather_context_from_fixture({"id": 999, "starting_at": "2026-06-15 19:00:00", "venue": {"name": "Unknown Stadium"}}) is None


def test_weather_forecast_matches_june_14_venues():
    boston = weather_context_from_fixture({"starting_at": "2026-06-14 19:00:00", "venue": {"name": "Boston Stadium"}})
    east_rutherford = weather_context_from_fixture({"starting_at": "2026-06-14 19:00:00", "venue": {"name": "New York New Jersey Stadium"}})
    santa_clara = weather_context_from_fixture({"starting_at": "2026-06-14 19:00:00", "venue": {"name": "San Francisco Bay Area Stadium"}})
    houston = weather_context_from_fixture({"starting_at": "2026-06-14 19:00:00", "venue": {"name": "Houston Stadium"}})

    assert boston["description"] == "Partly sunny"
    assert boston["high_c"] == 32
    assert east_rutherford["description"] == "Partly sunny"
    assert east_rutherford["humidity_pct"] == 55
    assert santa_clara["description"] == "Sunny"
    assert santa_clara["wind_mph"] == 6
    assert houston["description"] == "Scattered thunderstorms"
    assert houston["precip_probability_pct"] == 45


def test_weather_forecast_marks_vancouver_weather_as_pending():
    vancouver = weather_context_from_fixture({"starting_at": "2026-06-14 19:00:00", "venue": {"name": "BC Place Vancouver"}})

    assert vancouver["description"] == "Unavailable"
    assert vancouver["source"] == "manual_match_schedule"
    assert vancouver["high_c"] is None
