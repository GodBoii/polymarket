import os
from pathlib import Path

from agno.db.json import JsonDb
from agno.models.xiaomi import MiMo


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BACKEND_DIR / "storage"

ARENA_BASE_URL = "https://staging.stair-ai.com"
SUPABASE_URL = "https://ezvbmtvrvzageqixvdak.supabase.co"
SUPABASE_KEY = "sb_publishable__m8bOkD05ToFwATpaWST5w_2-3fGS7V"

MIMO_BASE_URL = "https://token-plan-ams.xiaomimimo.com/v1"
MIMO_MODEL = "mimo-v2.5-pro"

SPORTMONKS_SEASON_ID = 26618
DEFAULT_FIXTURE_ID = 19609127

# Current sample mapping from the arena notebook.
COUNTRY_IDS = {
    "Mexico": 147,
    "MEX": 147,
    "South Africa": 211,
    "ZAF": 211,
}


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


def arena_headers() -> dict[str, str]:
    arena_key = os.environ.get("ARENA_KEY")
    if not arena_key:
        raise RuntimeError("Missing ARENA_KEY in .env")
    return {"x-api-key": arena_key}


def supabase_key() -> str:
    return os.environ.get("SUPABASE_KEY", SUPABASE_KEY)


def build_db() -> JsonDb:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    return JsonDb(db_path=str(STORAGE_DIR / "json_db"))


def build_mimo_model() -> MiMo:
    mimo_api_key = os.environ.get("MIMO_API_KEY")
    if not mimo_api_key:
        raise RuntimeError("Missing MIMO_API_KEY in .env")

    return MiMo(
        id=MIMO_MODEL,
        api_key=mimo_api_key,
        base_url=MIMO_BASE_URL,
        use_thinking=False,
    )
