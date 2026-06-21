import json
import os
import time
import uuid
from typing import Any

import requests

from http_logging import request as logged_request

SCHEMA_VERSION = "0.3"
MAX_BATCH_RECORDS = 50
MAX_RECORD_BYTES = 64 * 1024
MAX_BATCH_BYTES = 1024 * 1024
THINKING_PROMPT_MAX_BYTES = 16 * 1024
THINKING_OUTPUT_MAX_BYTES = 32 * 1024
TOOL_INPUT_MAX_BYTES = 16 * 1024
TOOL_OUTPUT_MAX_BYTES = 32 * 1024
ACTING_PARAMETERS_MAX_BYTES = 16 * 1024
OTHER_DATA_MAX_BYTES = 16 * 1024
TRUNCATION_SUFFIX = " ... [TRUNCATED]"
ARENA_BASE_URL = os.environ.get("ARENA_BASE_URL", "https://stair-ai.com").rstrip("/")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "xiaomi/mimo-v2.5-pro")


def arena_headers() -> dict[str, str]:
    arena_key = os.environ.get("ARENA_KEY") or os.environ.get("ARENA_API_KEY")
    if not arena_key:
        raise RuntimeError("Missing ARENA_KEY or ARENA_API_KEY in .env")
    return {"x-api-key": arena_key}


def _string_payload(value: Any) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=True, default=str)


def _sum_metric(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, (list, tuple)):
        return sum(_sum_metric(item) for item in value)
    if isinstance(value, dict):
        return sum(_sum_metric(item) for item in value.values())
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def build_model_invocation(metrics: Any = None, response: Any = None) -> dict[str, Any]:
    invocation: dict[str, Any] = {
        "provider": "openrouter",
        "model_name": OPENROUTER_MODEL,
    }
    if metrics is not None:
        invocation["tokens_in"] = _sum_metric(getattr(metrics, "input_tokens", None))
        invocation["tokens_out"] = _sum_metric(getattr(metrics, "output_tokens", None))

    reasoning = extract_reasoning_content(response)
    if reasoning:
        invocation["internal_reasoning"] = reasoning
    return invocation


def extract_reasoning_content(value: Any) -> str | None:
    seen: set[int] = set()
    parts: list[str] = []

    def visit(node: Any) -> None:
        if node is None:
            return
        node_id = id(node)
        if node_id in seen:
            return
        seen.add(node_id)
        if isinstance(node, dict):
            for key in ("reasoning_content", "reasoning", "internal_reasoning"):
                candidate = node.get(key)
                if isinstance(candidate, str) and candidate.strip():
                    parts.append(candidate.strip())
            for child in node.values():
                visit(child)
            return
        if isinstance(node, (list, tuple, set)):
            for child in node:
                visit(child)
            return
        for key in ("reasoning_content", "reasoning", "internal_reasoning"):
            candidate = getattr(node, key, None)
            if isinstance(candidate, str) and candidate.strip():
                parts.append(candidate.strip())
        for attr in ("messages", "content", "response", "raw_response", "extra_data"):
            if hasattr(node, attr):
                visit(getattr(node, attr))

    visit(value)
    unique_parts = list(dict.fromkeys(parts))
    return "\n\n".join(unique_parts) if unique_parts else None


class LedgerSink:
    """Builds Reasoning Ledger records and optionally submits them to the arena."""

    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self.records: list[dict[str, Any]] = []
        self._last_id: str | None = None
        self._single_submitted_record_ids: set[str] = set()

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

    def planning(
        self,
        *,
        goal: str,
        steps: list[dict[str, Any]],
        contingencies: list[str] | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        return self._push(
            self._new_record(
                "Planning",
                description=description,
                goal=goal,
                steps=steps,
                contingencies=contingencies,
            )
        )

    def reflecting(
        self,
        *,
        inputs: list[dict[str, Any]],
        output_payload: str,
        description: str | None = None,
        model_invocation: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._push(
            self._new_record(
                "Reflecting",
                description=description,
                inputs=inputs,
                output_payload=output_payload,
                model_invocation=model_invocation,
            )
        )

    def bind_session_to_fixture(self, fixture_id: str | int, dry_run: bool = True) -> dict[str, Any]:
        fixture_id_str = str(fixture_id)
        if dry_run:
            return {"dry_run": True, "submitted": False, "session_id": self.session_id, "fixture_id": fixture_id_str}
        response = logged_request(
            "POST",
            f"{ARENA_BASE_URL}/api/v1/arena/ledger/sessions/{self.session_id}/fixture",
            headers=arena_headers(),
            json_body={"fixture_id": fixture_id_str},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def validate(self, records: list[dict[str, Any]] | None = None, fixture_id: str | int | None = None, dry_run: bool = True) -> dict[str, Any]:
        prepared_records = [self._enforce_record_size_limit(self._normalize_record_limits(dict(record))) for record in (records or self._batch_records())]
        payload: dict[str, Any] = {"records": prepared_records}
        if fixture_id is not None:
            payload["fixture_id"] = str(fixture_id)
        if dry_run:
            return {"dry_run": True, "submitted": False, "payload": payload}
        response = logged_request(
            "POST",
            f"{ARENA_BASE_URL}/api/v1/arena/ledger/records/validate",
            headers=arena_headers(),
            json_body=payload,
            timeout=60,
        )
        response.raise_for_status()
        return response.json()

    def submit_record(self, record: dict[str, Any], dry_run: bool = True) -> dict[str, Any]:
        record = self._enforce_record_size_limit(self._normalize_record_limits(dict(record)))
        if dry_run:
            return {"dry_run": True, "submitted": False, "record": record}
        response = logged_request(
            "POST",
            f"{ARENA_BASE_URL}/api/v1/arena/ledger/records",
            headers=arena_headers(),
            json_body=record,
            timeout=30,
        )
        response.raise_for_status()
        self._single_submitted_record_ids.add(str(record.get("record_id")))
        return response.json()

    def submit(self, dry_run: bool = True, fixture_id: str | int | None = None) -> dict[str, Any]:
        records = [self._enforce_record_size_limit(self._normalize_record_limits(record)) for record in self._batch_records()]
        records = self._enforce_batch_size_limit(records)
        if len(records) > MAX_BATCH_RECORDS:
            raise ValueError(f"Ledger batch too large: {len(records)} records exceeds {MAX_BATCH_RECORDS}.")
        if dry_run:
            result = {"dry_run": True, "submitted": False, "record_count": len(records), "records": records}
            if fixture_id is not None:
                result["fixture_id"] = str(fixture_id)
            return result
        payload: dict[str, Any] = {"records": records}
        if fixture_id is not None:
            payload["fixture_id"] = str(fixture_id)
        response = logged_request(
            "POST",
            f"{ARENA_BASE_URL}/api/v1/arena/ledger/records/batch",
            headers=arena_headers(),
            json_body=payload,
            timeout=60,
        )
        response.raise_for_status()
        body = response.json()
        body["record_count"] = len(records)
        return body

    def _batch_records(self) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        cloned_ids: dict[str, str] = {}
        for record in self.records:
            record_id = str(record.get("record_id"))
            batch_record = dict(record)
            is_prediction = record.get("behavior") == "Acting" and record.get("action_type") == "prediction"
            if is_prediction or record_id in self._single_submitted_record_ids:
                batch_record["record_id"] = str(uuid.uuid4())
                cloned_ids[record_id] = batch_record["record_id"]
            records.append(batch_record)

        if not cloned_ids:
            return records
        for record in records:
            upstream = record.get("upstream_record_id")
            if isinstance(upstream, list):
                record["upstream_record_id"] = [cloned_ids.get(str(item), item) for item in upstream]
        return records

    def _normalize_record_limits(self, record: dict[str, Any]) -> dict[str, Any]:
        record = dict(record)
        behavior = record.get("behavior")
        if isinstance(record.get("notes"), str):
            record["notes"] = record["notes"][:2048]
        if isinstance(record.get("trigger_payload_summary"), str):
            record["trigger_payload_summary"] = self._compact_value(record["trigger_payload_summary"], 4096)

        if behavior == "Thinking":
            if "prompt" in record:
                record["prompt"] = self._compact_value(record.get("prompt"), THINKING_PROMPT_MAX_BYTES)
            if "output_payload" in record:
                record["output_payload"] = self._compact_value(record.get("output_payload"), THINKING_OUTPUT_MAX_BYTES)
        elif behavior == "ToolCalling":
            if "input_payload" in record:
                record["input_payload"] = self._compact_value(record.get("input_payload"), TOOL_INPUT_MAX_BYTES)
            if "output_payload" in record:
                record["output_payload"] = self._compact_value(record.get("output_payload"), TOOL_OUTPUT_MAX_BYTES)
        elif behavior == "Acting" and "parameters" in record:
            record["parameters"] = self._compact_value(record.get("parameters"), ACTING_PARAMETERS_MAX_BYTES, preserve_object=True)
        elif behavior == "Other" and "data" in record:
            record["data"] = self._compact_value(record.get("data"), OTHER_DATA_MAX_BYTES, preserve_object=True)
        elif behavior == "Planning":
            if "goal" in record:
                record["goal"] = self._compact_value(record.get("goal"), THINKING_PROMPT_MAX_BYTES)
        elif behavior == "Reflecting":
            if "output_payload" in record:
                record["output_payload"] = self._compact_value(record.get("output_payload"), THINKING_OUTPUT_MAX_BYTES)

        model_invocation = record.get("model_invocation")
        if isinstance(model_invocation, dict) and "internal_reasoning" in model_invocation:
            model_invocation = dict(model_invocation)
            model_invocation["internal_reasoning"] = self._compact_value(model_invocation.get("internal_reasoning"), THINKING_OUTPUT_MAX_BYTES)
            record["model_invocation"] = model_invocation
        return record

    def _enforce_record_size_limit(self, record: dict[str, Any], max_bytes: int = MAX_RECORD_BYTES) -> dict[str, Any]:
        record = dict(record)
        if self._json_size(record) <= max_bytes:
            return record

        for _ in range(24):
            if self._json_size(record) <= max_bytes:
                return record
            field_path = self._largest_truncatable_field(record)
            if not field_path:
                break
            value = self._get_path(record, field_path)
            current_size = self._json_size(value)
            target_size = max(256, current_size // 2)
            self._set_path(record, field_path, self._compact_value(value, target_size, preserve_object=field_path == ("parameters",)))

        if self._json_size(record) > max_bytes:
            raise ValueError("Ledger record exceeds the 64 KB size limit even after truncation.")
        return record

    def _enforce_batch_size_limit(self, records: list[dict[str, Any]], max_bytes: int = MAX_BATCH_BYTES) -> list[dict[str, Any]]:
        records = [dict(record) for record in records]
        if self._json_size({"records": records}) <= max_bytes:
            return records

        for _ in range(32):
            if self._json_size({"records": records}) <= max_bytes:
                return records
            largest_index = max(range(len(records)), key=lambda idx: self._json_size(records[idx]))
            records[largest_index] = self._enforce_record_size_limit(records[largest_index], max_bytes=MAX_RECORD_BYTES // 2)

        if self._json_size({"records": records}) > max_bytes:
            raise ValueError("Ledger batch exceeds the 1 MB size limit even after truncation.")
        return records

    def _largest_truncatable_field(self, record: dict[str, Any]) -> tuple[Any, ...] | None:
        candidates = [
            ("model_invocation", "internal_reasoning"),
            ("output_payload",),
            ("input_payload",),
            ("parameters",),
            ("prompt",),
            ("trigger_payload_summary",),
            ("description",),
            ("action_summary",),
            ("notes",),
        ]
        best_path: tuple[Any, ...] | None = None
        best_size = 0
        for path in candidates:
            value = self._get_path(record, path)
            if value is None:
                continue
            size = self._json_size(value)
            if size > best_size:
                best_size = size
                best_path = path
        return best_path if best_size > len(TRUNCATION_SUFFIX.encode("utf-8")) else None

    def _compact_value(self, value: Any, max_bytes: int, preserve_object: bool = False) -> Any:
        if self._json_size(value) <= max_bytes:
            return value
        if isinstance(value, str):
            return self._truncate_text(value, max_bytes)
        if isinstance(value, dict):
            compacted = dict(value)
            for _ in range(24):
                if self._json_size(compacted) <= max_bytes:
                    return compacted
                string_path = self._largest_string_path(compacted)
                if string_path is None:
                    break
                current = self._get_path(compacted, string_path)
                if not isinstance(current, str):
                    break
                self._set_path(compacted, string_path, self._truncate_text(current, max(128, len(current.encode("utf-8")) // 2)))
            if self._json_size(compacted) <= max_bytes:
                return compacted
            if preserve_object:
                summary = self._truncate_text(json.dumps(compacted, ensure_ascii=True, default=str), max(128, max_bytes // 2))
                return {"truncated": True, "summary": summary}
            return self._truncate_text(json.dumps(compacted, ensure_ascii=True, default=str), max_bytes)
        if isinstance(value, list):
            compacted = list(value)
            for _ in range(24):
                if self._json_size(compacted) <= max_bytes:
                    return compacted
                string_path = self._largest_string_path(compacted)
                if string_path is None:
                    break
                current = self._get_path(compacted, string_path)
                if not isinstance(current, str):
                    break
                self._set_path(compacted, string_path, self._truncate_text(current, max(128, len(current.encode("utf-8")) // 2)))
            if self._json_size(compacted) <= max_bytes:
                return compacted
            return self._truncate_text(json.dumps(compacted, ensure_ascii=True, default=str), max_bytes)
        if preserve_object:
            summary = self._truncate_text(json.dumps(value, ensure_ascii=True, default=str), max(128, max_bytes // 2))
            return {"truncated": True, "summary": summary}
        return self._truncate_text(json.dumps(value, ensure_ascii=True, default=str), max_bytes)

    def _truncate_text(self, value: str, max_bytes: int) -> str:
        if self._json_size(value) <= max_bytes:
            return value
        suffix_bytes = len(TRUNCATION_SUFFIX.encode("utf-8"))
        if max_bytes <= suffix_bytes:
            return TRUNCATION_SUFFIX[: max(1, len(TRUNCATION_SUFFIX) // 2)]
        low = 0
        high = len(value)
        best = TRUNCATION_SUFFIX
        while low <= high:
            mid = (low + high) // 2
            candidate = value[:mid] + TRUNCATION_SUFFIX
            if self._json_size(candidate) <= max_bytes:
                best = candidate
                low = mid + 1
            else:
                high = mid - 1
        return best

    def _largest_string_path(self, value: Any) -> tuple[Any, ...] | None:
        best_path: tuple[Any, ...] | None = None
        best_len = 0

        def visit(node: Any, path: tuple[Any, ...]) -> None:
            nonlocal best_path, best_len
            if isinstance(node, str):
                node_len = len(node.encode("utf-8"))
                if node_len > best_len:
                    best_len = node_len
                    best_path = path
                return
            if isinstance(node, dict):
                for key, child in node.items():
                    visit(child, path + (key,))
                return
            if isinstance(node, list):
                for index, child in enumerate(node):
                    visit(child, path + (index,))

        visit(value, ())
        return best_path

    def _get_path(self, value: Any, path: tuple[Any, ...]) -> Any:
        current = value
        for key in path:
            if isinstance(current, dict):
                current = current.get(key)
            elif isinstance(current, list) and isinstance(key, int) and 0 <= key < len(current):
                current = current[key]
            else:
                return None
        return current

    def _set_path(self, value: Any, path: tuple[Any, ...], new_value: Any) -> None:
        if not path:
            return
        current = value
        for key in path[:-1]:
            current = current[key]
        current[path[-1]] = new_value

    def _json_size(self, value: Any) -> int:
        return len(json.dumps(value, ensure_ascii=True, default=str).encode("utf-8"))
