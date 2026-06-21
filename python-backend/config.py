import os
from pathlib import Path

from agno.db.json import JsonDb
from agno.models.openrouter import OpenRouter


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BACKEND_DIR / "storage"

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


load_env()

ARENA_BASE_URL = os.environ.get("ARENA_BASE_URL", "https://stair-ai.com").rstrip("/")
SUPABASE_URL = "https://ezvbmtvrvzageqixvdak.supabase.co"
SUPABASE_KEY = "sb_publishable__m8bOkD05ToFwATpaWST5w_2-3fGS7V"

OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "xiaomi/mimo-v2.5-pro")
WEB_SEARCH_BACKEND = os.environ.get("WEB_SEARCH_BACKEND", "google")

SPORTMONKS_SEASON_ID = 26618
DEFAULT_FIXTURE_ID = 19609127

# Current sample mapping from the arena notebook.
COUNTRY_IDS = {
    "Mexico": 147,
    "MEX": 147,
    "South Africa": 211,
    "ZAF": 211,
}


def arena_headers() -> dict[str, str]:
    arena_key = os.environ.get("ARENA_KEY") or os.environ.get("ARENA_API_KEY")
    if not arena_key:
        raise RuntimeError("Missing ARENA_KEY or ARENA_API_KEY in .env")
    return {"x-api-key": arena_key}


def supabase_key() -> str:
    return os.environ.get("SUPABASE_KEY", SUPABASE_KEY)


def build_db() -> JsonDb:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    return JsonDb(db_path=str(STORAGE_DIR / "json_db"))


def build_openrouter_model() -> OpenRouter:
    openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
    if not openrouter_api_key:
        raise RuntimeError("Missing OPENROUTER_API_KEY in .env")

    model = OpenRouter(
        id=OPENROUTER_MODEL,
        api_key=openrouter_api_key,
    )
    # Agno's OpenRouter wrapper carries a hidden default max_tokens=1024.
    # Clear both request caps on our instance so the provider decides the limit.
    model.max_tokens = None
    model.max_completion_tokens = None
    return model
