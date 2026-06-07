from typing import Any, Protocol

from statsbomb_context import build_statsbomb_context
from supabase_features import build_supabase_features

COUNTRY_IDS = {
    "Mexico": 147,
    "MEX": 147,
    "South Africa": 211,
    "ZAF": 211,
    "RSA": 211,
}


class SupabaseRowsProvider(Protocol):
    def get_supabase_catalog(self) -> list[dict[str, Any]]:
        ...

    def get_supabase_rows(
        self,
        table_name: str,
        select: str = "*",
        filters: dict[str, str] | None = None,
        limit: int = 20,
        arena_schema: bool = True,
    ) -> list[dict[str, Any]]:
        ...


def _first_present(*values: Any) -> Any:
    return next((value for value in values if value is not None), None)


def _name_variants(team_name: str | None, short_code: str | None = None) -> list[str]:
    variants = []
    for value in [team_name, short_code]:
        if value and value not in variants:
            variants.append(value)

    aliases = {
        "Mexico": ["MEX"],
        "MEX": ["Mexico"],
        "South Africa": ["ZAF", "RSA"],
        "ZAF": ["South Africa", "RSA"],
        "RSA": ["South Africa", "ZAF"],
    }
    for value in list(variants):
        for alias in aliases.get(value, []):
            if alias not in variants:
                variants.append(alias)
    return variants


def resolve_country_id(
    data: SupabaseRowsProvider,
    team_name: str | None,
    short_code: str | None = None,
    sportmonks_country_id: int | None = None,
) -> dict[str, Any]:
    """Resolve a team to the arena/Supabase country id.

    Sportmonks participant country_id values are useful metadata, but the
    historical `ads_a_*` tables use the arena dataset's own country id space.
    """
    for key in _name_variants(team_name, short_code):
        if key in COUNTRY_IDS:
            return {"country_id": COUNTRY_IDS[key], "source": "config_alias", "matched": key, "sportmonks_country_id": sportmonks_country_id}

    for variant in _name_variants(team_name, short_code):
        for name_column, country_column in [("team_name_a", "country_id_a"), ("team_name_b", "country_id_b")]:
            rows = data.get_supabase_rows(
                "dim_match",
                select=f"{name_column},{country_column}",
                filters={name_column: f"eq.{variant}"},
                limit=1,
            )
            if not rows and len(variant) > 3:
                rows = data.get_supabase_rows(
                    "dim_match",
                    select=f"{name_column},{country_column}",
                    filters={name_column: f"ilike.*{variant}*"},
                    limit=1,
                )
            if rows:
                return {"country_id": rows[0].get(country_column), "source": "dim_match", "matched": variant, "sportmonks_country_id": sportmonks_country_id}

    return {"country_id": sportmonks_country_id, "source": "sportmonks_country_id", "matched": None, "sportmonks_country_id": sportmonks_country_id}


def _country_rows(data: SupabaseRowsProvider, table_name: str, country_ids: list[int]) -> list[dict[str, Any]]:
    if not country_ids:
        return []
    country_filter = f"in.({','.join(str(value) for value in country_ids)})"
    return data.get_supabase_rows(table_name, filters={"country_id": country_filter}, limit=40)


def _h2h_rows(data: SupabaseRowsProvider, home_country_id: int | None, away_country_id: int | None) -> list[dict[str, Any]]:
    if not home_country_id or not away_country_id:
        return []
    forward = data.get_supabase_rows(
        "ads_a_h2h_country",
        filters={"country_id_a": f"eq.{home_country_id}", "country_id_b": f"eq.{away_country_id}"},
        limit=10,
    )
    reverse = data.get_supabase_rows(
        "ads_a_h2h_country",
        filters={"country_id_a": f"eq.{away_country_id}", "country_id_b": f"eq.{home_country_id}"},
        limit=10,
    )
    return forward + reverse


def _match_meta_rows(data: SupabaseRowsProvider, fixture: dict[str, Any], home_name: str | None, away_name: str | None) -> dict[str, list[dict[str, Any]]]:
    fixture_id = _first_present(fixture.get("fixture_id"), fixture.get("id"), fixture.get("fixture_code"))
    rows: dict[str, list[dict[str, Any]]] = {}

    if fixture_id:
        for table_name in ["sm_match_meta", "sm_statistics_snapshot"]:
            try:
                rows[table_name] = data.get_supabase_rows(table_name, filters={"match_id": f"eq.{fixture_id}"}, limit=20)
            except Exception:
                rows[table_name] = []

    if home_name and away_name:
        try:
            rows["dim_match_lookup"] = data.get_supabase_rows(
                "dim_match",
                filters={"team_name_a": f"ilike.*{home_name}*", "team_name_b": f"ilike.*{away_name}*"},
                limit=5,
            )
        except Exception:
            rows["dim_match_lookup"] = []
    return rows


def build_supabase_context(data: SupabaseRowsProvider, fixture: dict[str, Any]) -> dict[str, Any]:
    home = fixture.get("home") or {}
    away = fixture.get("away") or {}
    home_name = home.get("name")
    away_name = away.get("name")

    home_resolution = resolve_country_id(data, home_name, home.get("short_code"), home.get("country_id"))
    away_resolution = resolve_country_id(data, away_name, away.get("short_code"), away.get("country_id"))
    home_country_id = home_resolution.get("country_id")
    away_country_id = away_resolution.get("country_id")
    country_ids = [int(value) for value in [home_country_id, away_country_id] if value is not None]

    catalog = data.get_supabase_catalog()
    tables = {row.get("table_name") for row in catalog}
    context: dict[str, Any] = {
        "home_country": {"name": home_name, "code": home.get("short_code"), "country_id": home_country_id, "resolution": home_resolution},
        "away_country": {"name": away_name, "code": away.get("short_code"), "country_id": away_country_id, "resolution": away_resolution},
        "catalog_tables": catalog,
        "tables": {},
        "supabase_join_note": "Historical ads_a_* tables use arena country IDs. Sportmonks participant country_id is kept as metadata but is not always the correct Supabase join key.",
    }

    for table_name in ["ads_a_country_style", "ads_a_country_struct", "ads_a_ko_pattern", "ads_a_special_match", "ads_a_stage_record"]:
        if table_name in tables:
            context["tables"][table_name] = _country_rows(data, table_name, country_ids)

    if "ads_a_h2h_country" in tables:
        context["tables"]["ads_a_h2h_country"] = _h2h_rows(data, home_country_id, away_country_id)

    for table_name, rows in _match_meta_rows(data, fixture, home_name, away_name).items():
        if table_name in tables or table_name == "dim_match_lookup":
            context["tables"][table_name] = rows

    context["features"] = build_supabase_features(context)
    context["statsbomb_open_data"] = build_statsbomb_context(home_name, away_name, home.get("short_code"), away.get("short_code"))
    return context
