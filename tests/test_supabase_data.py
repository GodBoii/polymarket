import os
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
SUPABASE = "https://ezvbmtvrvzageqixvdak.supabase.co"
DEFAULT_SUPABASE_KEY = "sb_publishable__m8bOkD05ToFwATpaWST5w_2-3fGS7V"


def load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def main() -> None:
    load_env()
    supabase_key = os.environ.get("SUPABASE_KEY", DEFAULT_SUPABASE_KEY)
    headers = {"apikey": supabase_key}

    print("Testing Supabase public catalog...")
    catalog_resp = requests.get(
        f"{SUPABASE}/rest/v1/catalog_tables",
        params={"select": "table_name,description,row_count", "limit": "5"},
        headers=headers,
        timeout=30,
    )
    print(f"catalog status: {catalog_resp.status_code}")
    catalog_resp.raise_for_status()
    catalog_rows = catalog_resp.json()
    print(f"catalog rows returned: {len(catalog_rows)}")
    if catalog_rows:
        first = catalog_rows[0]
        print(f"first catalog table: {first.get('table_name')}")

    print("Testing Supabase world_cup_arena schema table...")
    arena_headers = {
        "apikey": supabase_key,
        "Accept-Profile": "world_cup_arena",
    }
    aggregate_resp = requests.get(
        f"{SUPABASE}/rest/v1/ads_a_country_style",
        params={"select": "*", "limit": "3"},
        headers=arena_headers,
        timeout=30,
    )
    print(f"ads_a_country_style status: {aggregate_resp.status_code}")
    aggregate_resp.raise_for_status()
    aggregate_rows = aggregate_resp.json()
    print(f"aggregate rows returned: {len(aggregate_rows)}")
    if aggregate_rows:
        print(f"sample columns: {', '.join(list(aggregate_rows[0].keys())[:8])}")

    print("Supabase smoke test passed.")


if __name__ == "__main__":
    main()
