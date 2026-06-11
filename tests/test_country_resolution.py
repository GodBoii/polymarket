from supabase_context import build_supabase_context, resolve_country_id


class FakeData:
    def __init__(self):
        self.calls = []

    def get_supabase_catalog(self):
        return [
            {"table_name": "ads_a_country_style"},
            {"table_name": "ads_a_h2h_country"},
            {"table_name": "dim_match"},
        ]

    def get_supabase_rows(self, table_name, select="*", filters=None, limit=20, arena_schema=True):
        self.calls.append((table_name, filters))
        if table_name == "ads_a_country_style":
            return [{"country_id": 147}, {"country_id": 211}]
        if table_name == "ads_a_h2h_country":
            if filters == {"country_id_a": "eq.147", "country_id_b": "eq.211"}:
                return [{"country_id_a": 147, "country_id_b": 211, "total_matches": 1}]
            return []
        return []


def test_supabase_context_resolves_arena_country_ids_from_team_codes():
    fake = FakeData()
    fixture = {
        "home": {"name": "Mexico", "short_code": "MEX", "country_id": 458},
        "away": {"name": "South Africa", "short_code": "ZAF", "country_id": 146},
    }

    context = build_supabase_context(fake, fixture)

    assert context["home_country"]["country_id"] == 147
    assert context["home_country"]["resolution"]["sportmonks_country_id"] == 458
    assert context["away_country"]["country_id"] == 211
    assert context["away_country"]["resolution"]["sportmonks_country_id"] == 146
    assert "ads_a_country_style" in context["tables"]
    assert "ads_a_h2h_country" in context["tables"]
    assert context["tables"]["ads_a_country_style"] == [{"country_id": 147}, {"country_id": 211}]
    assert context["tables"]["ads_a_h2h_country"] == [{"country_id_a": 147, "country_id_b": 211, "total_matches": 1}]


def test_unresolved_country_does_not_fallback_to_sportmonks_id():
    fake = FakeData()

    resolution = resolve_country_id(fake, "Unknown Team", "UNK", sportmonks_country_id=999999)

    assert resolution["country_id"] is None
    assert resolution["source"] == "unresolved"
    assert resolution["sportmonks_country_id"] == 999999
