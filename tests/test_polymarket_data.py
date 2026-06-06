import json
import os
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
ARENA = "https://staging.stair-ai.com"
FIXTURE_ID = 19609127


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


def parse_token_ids(raw_value):
    if isinstance(raw_value, list):
        return raw_value
    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


def main() -> None:
    load_env()
    arena_key = os.environ.get("ARENA_KEY")
    if not arena_key:
        raise SystemExit("Missing ARENA_KEY in .env")

    headers = {"x-api-key": arena_key}
    print("Testing Polymarket mapping via Stair AI...")
    mapping_resp = requests.get(
        f"{ARENA}/api/v1/web/mapping",
        params={"fixture_id": FIXTURE_ID},
        headers=headers,
        timeout=30,
    )
    print(f"mapping status: {mapping_resp.status_code}")
    mapping_resp.raise_for_status()

    mappings = mapping_resp.json().get("mappings") or []
    print(f"mappings returned: {len(mappings)}")
    if not mappings:
        raise SystemExit("No Polymarket mapping returned for fixture.")

    slug = mappings[0].get("polymarket_event_slug")
    print(f"event slug: {slug}")
    if not slug:
        raise SystemExit("Mapping exists, but polymarket_event_slug is empty.")

    print("Testing Polymarket Gamma event proxy...")
    gamma_resp = requests.get(
        f"{ARENA}/api/v1/data/proxy/polymarket-gamma/events",
        params={"slug": slug},
        headers=headers,
        timeout=30,
    )
    print(f"gamma status: {gamma_resp.status_code}")
    gamma_resp.raise_for_status()

    gamma_payload = gamma_resp.json()
    events = gamma_payload.get("body", gamma_payload)
    if isinstance(events, dict):
        events = events.get("data") or events.get("events") or [events]
    if not isinstance(events, list) or not events:
        raise SystemExit("Gamma proxy returned no event data.")

    event = events[0]
    markets = event.get("markets") or []
    print(f"event title: {event.get('title') or event.get('question')}")
    print(f"markets returned: {len(markets)}")

    yes_token_id = None
    for market in markets:
        token_ids = parse_token_ids(market.get("clobTokenIds"))
        if token_ids:
            yes_token_id = token_ids[0]
            print(f"sample market: {market.get('question') or market.get('title')}")
            break

    if not yes_token_id:
        raise SystemExit("No CLOB token ids found in Gamma market data.")

    print("Testing Polymarket CLOB midpoint proxy...")
    midpoint_resp = requests.get(
        f"{ARENA}/api/v1/data/proxy/polymarket-clob/midpoint",
        params={"token_id": yes_token_id},
        headers=headers,
        timeout=30,
    )
    print(f"midpoint status: {midpoint_resp.status_code}")
    midpoint_resp.raise_for_status()

    midpoint_payload = midpoint_resp.json()
    midpoint_body = midpoint_payload.get("body", midpoint_payload)
    print(f"sample token id: {yes_token_id}")
    print(f"midpoint response: {midpoint_body}")
    print("Polymarket smoke test passed.")


if __name__ == "__main__":
    main()
