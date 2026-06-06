import json
import re
from typing import Any


def compact_json(data: Any, limit: int = 30000) -> str:
    text = json.dumps(data, ensure_ascii=True, default=str)
    if len(text) <= limit:
        return text
    return text[:limit] + f"...[truncated, was {len(text)} chars]"


def extract_json_object(text: Any) -> dict[str, Any]:
    if isinstance(text, dict):
        return text
    raw = str(text)
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {"value": parsed}
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return {"raw_response": raw}
    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else {"value": parsed}
    except json.JSONDecodeError:
        return {"raw_response": raw}


def run_content(response: Any) -> str:
    return str(getattr(response, "content", response))


def parse_token_ids(raw_value: Any) -> list[str]:
    if isinstance(raw_value, list):
        return [str(value) for value in raw_value]
    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
            if isinstance(parsed, list):
                return [str(value) for value in parsed]
        except json.JSONDecodeError:
            return []
    return []
