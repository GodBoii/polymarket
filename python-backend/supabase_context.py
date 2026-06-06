from typing import Any, Protocol


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


def resolve_country_id(data: SupabaseRowsProvider, team_name: str | None) -> int | None:
    if not team_name:
        return None
    lookups = [("team_name_a", "country_id_a"), ("team_name_b", "country_id_b")]
    for name_column, country_column in lookups:
        rows = data.get_supabase_rows(
            "dim_match",
            select=f"{name_column},{country_column}",
            filters={name_column: f"eq.{team_name}"},
            limit=1,
        )
        if rows:
            return rows[0].get(country_column)
    return None


def build_supabase_context(data: SupabaseRowsProvider, fixture: dict[str, Any]) -> dict[str, Any]:
    home = fixture.get("home") or {}
    away = fixture.get("away") or {}
    home_name = home.get("name")
    away_name = away.get("name")
    home_country_id = home.get("country_id") or resolve_country_id(data, home_name)
    away_country_id = away.get("country_id") or resolve_country_id(data, away_name)
    country_ids = [str(value) for value in [home_country_id, away_country_id] if value]
    country_filter = f"in.({','.join(country_ids)})" if country_ids else ""

    catalog = data.get_supabase_catalog()
    tables = {row.get("table_name") for row in catalog}
    context: dict[str, Any] = {
        "home_country": {"name": home_name, "code": home.get("short_code"), "country_id": home_country_id},
        "away_country": {"name": away_name, "code": away.get("short_code"), "country_id": away_country_id},
        "catalog_tables": catalog,
        "tables": {},
    }

    for table_name in ["ads_a_country_style", "ads_a_country_struct", "ads_a_ko_pattern", "ads_a_special_match", "ads_a_stage_record"]:
        if table_name in tables and country_filter:
            context["tables"][table_name] = data.get_supabase_rows(table_name, filters={"country_id": country_filter}, limit=20)

    if "ads_a_h2h_country" in tables and home_country_id and away_country_id:
        context["tables"]["ads_a_h2h_country"] = data.get_supabase_rows(
            "ads_a_h2h_country",
            filters={"country_id_a": f"eq.{home_country_id}", "country_id_b": f"eq.{away_country_id}"},
            limit=10,
        )

    return context
