from supabase_context import build_supabase_context


class FakeData:
    def get_supabase_catalog(self):
        return [
            {"table_name": "ads_a_country_style"},
            {"table_name": "ads_a_h2h_country"},
        ]

    def get_supabase_rows(self, table_name, select="*", filters=None, limit=20, arena_schema=True):
        if table_name == "ads_a_country_style":
            return [{"country_id": 458}, {"country_id": 146}]
        if table_name == "ads_a_h2h_country":
            return [{"country_id_a": 458, "country_id_b": 146, "total_matches": 1}]
        return []


def test_supabase_context_uses_sportmonks_participant_country_ids():
    fixture = {
        "home": {"name": "Mexico", "short_code": "MEX", "country_id": 458},
        "away": {"name": "South Africa", "short_code": "ZAF", "country_id": 146},
    }

    context = build_supabase_context(FakeData(), fixture)

    assert context["home_country"]["country_id"] == 458
    assert context["away_country"]["country_id"] == 146
    assert "ads_a_country_style" in context["tables"]
    assert "ads_a_h2h_country" in context["tables"]
