import json
import time
import uuid
from typing import Any

import requests


SCHEMA_VERSION = "0.3"
MAX_BATCH_RECORDS = 50
ARENA_BASE_URL = "https://staging.stair-ai.com"


def arena_headers() -> dict[str, str]:
    import os

    arena_key = os.environ.get("ARENA_KEY")
    if not arena_key:
        raise RuntimeError("Missing ARENA_KEY in .env")
    return {"x-api-key": arena_key}


def _string_payload(value: Any) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=True, default=str)


class LedgerSink:
    """Builds Reasoning Ledger records and optionally submits them to the arena."""

    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self.records: list[dict[str, Any]] = []
        self._last_id: str | None = None

    def _new_record(self, behavior: str, **fields: Any) -> dict[str, Any]:
        record = {
            "schema_version": SCHEMA_VERSION,
            "session_id": self.session_id,
            "record_id": str(uuid.uuid4()),
            "behavior": behavior,
            "client_ts_utc": int(time.time() * 1000),
        }
        if "upstream_record_id" not in fields and self._last_id:
            record["upstream_record_id"] = [self._last_id]
        record.update({key: value for key, value in fields.items() if value is not None})
        return record

    def _push(self, record: dict[str, Any]) -> dict[str, Any]:
        self.records.append(record)
        self._last_id = record["record_id"]
        return record

    def observing(self, *, trigger_source: str, trigger_type: str, trigger_description: str, trigger_payload_summary: str) -> dict[str, Any]:
        return self._push(
            self._new_record(
                "Observing",
                trigger_source=trigger_source,
                trigger_type=trigger_type,
                trigger_description=trigger_description,
                trigger_payload_summary=trigger_payload_summary[:512],
            )
        )

    def tool_calling(
        self,
        *,
        tool_name: str,
        description: str,
        input_payload: Any = None,
        output_payload: Any = None,
        success: bool = True,
    ) -> dict[str, Any]:
        return self._push(
            self._new_record(
                "ToolCalling",
                tool_meta={"name": tool_name},
                description=description,
                input_payload=input_payload,
                output_payload=output_payload,
                success=success,
            )
        )

    def thinking(
        self,
        *,
        prompt: str,
        output_payload: Any,
        inputs: list[dict[str, Any]] | None = None,
        model_invocation: dict[str, Any] | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        return self._push(
            self._new_record(
                "Thinking",
                description=description,
                prompt=prompt,
                inputs=inputs or [],
                output_payload=_string_payload(output_payload),
                model_invocation=model_invocation,
            )
        )

    def acting(
        self,
        *,
        action_type: str,
        target_system: str,
        action_summary: str,
        parameters: dict[str, Any],
        dry_run: bool,
        execution_status: str = "confirmed",
        execution_id: str | None = None,
    ) -> dict[str, Any]:
        return self._push(
            self._new_record(
                "Acting",
                action_type=action_type,
                target_system=target_system,
                action_summary=action_summary,
                parameters=parameters,
                dry_run=dry_run,
                execution_status=execution_status,
                execution_id=execution_id,
            )
        )

    def submit(self, dry_run: bool = True) -> dict[str, Any]:
        if len(self.records) > MAX_BATCH_RECORDS:
            raise ValueError(f"Ledger batch too large: {len(self.records)} records exceeds {MAX_BATCH_RECORDS}.")
        if dry_run:
            return {"dry_run": True, "submitted": False, "record_count": len(self.records), "records": self.records}
        response = requests.post(
            f"{ARENA_BASE_URL}/api/v1/arena/ledger/records/batch",
            headers=arena_headers(),
            json={"records": self.records},
            timeout=60,
        )
        response.raise_for_status()
        body = response.json()
        body["record_count"] = len(self.records)
        return body
