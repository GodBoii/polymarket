import os
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
ARENA = "https://stair-ai.com"
SPORTMONKS_SEASON_ID = 26618


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
    arena_key = os.environ.get("ARENA_KEY")
    if not arena_key:
        raise SystemExit("Missing ARENA_KEY in .env")

    base = f"{ARENA}/api/v1/data/proxy/sportmonks/v3/football"
    headers = {"x-api-key": arena_key}

    print("Testing Sportmonks via Stair AI proxy...")
    schedule_resp = requests.get(
        f"{base}/schedules/seasons/{SPORTMONKS_SEASON_ID}",
        headers=headers,
        timeout=30,
    )
    print(f"schedule status: {schedule_resp.status_code}")
    schedule_resp.raise_for_status()

    envelope = schedule_resp.json()
    schedule = envelope.get("body", {}).get("data", [])
    print(f"schedule entries: {len(schedule)}")
    print(f"proxy request id: {envelope.get('requestId')}")

    fixture_id = 19609127
    fixture_resp = requests.get(
        f"{base}/fixtures/{fixture_id}",
        params={"include": "participants;odds;xGFixture"},
        headers=headers,
        timeout=60,
    )
    print(f"fixture status: {fixture_resp.status_code}")
    fixture_resp.raise_for_status()

    fixture = fixture_resp.json().get("body", {}).get("data", {})
    participants = fixture.get("participants") or []
    print(f"fixture id: {fixture.get('id')}")
    print(f"fixture name: {fixture.get('name')}")
    print(f"participants: {len(participants)}")
    print(f"odds rows: {len(fixture.get('odds') or [])}")
    print(f"xG rows: {len(fixture.get('xgfixture') or [])}")
    print("Sportmonks smoke test passed.")


if __name__ == "__main__":
    main()
