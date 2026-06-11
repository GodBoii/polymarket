from __future__ import annotations

import json
import logging
import os
import time
from typing import Any

import requests


_LOGGING_CONFIGURED = False
LOGGER = logging.getLogger("polymarket.backend.http")
SENSITIVE_HEADERS = {"x-api-key", "authorization", "apikey"}


def setup_backend_logging() -> None:
    global _LOGGING_CONFIGURED
    if _LOGGING_CONFIGURED:
        return
    level_name = os.environ.get("BACKEND_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    _LOGGING_CONFIGURED = True


def _logging_enabled() -> bool:
    return os.environ.get("BACKEND_HTTP_LOGS", "true").strip().lower() not in {"0", "false", "no", "off"}


def _preview_limit() -> int:
    raw = os.environ.get("BACKEND_HTTP_PREVIEW_CHARS", "700").strip()
    try:
        return max(120, min(int(raw), 4000))
    except ValueError:
        return 700


def _sanitize_headers(headers: dict[str, Any] | None) -> dict[str, Any]:
    sanitized: dict[str, Any] = {}
    for key, value in (headers or {}).items():
        sanitized[key] = "<redacted>" if key.lower() in SENSITIVE_HEADERS else value
    return sanitized


def _preview_value(value: Any) -> str:
    try:
        if isinstance(value, str):
            text = value
        else:
            text = json.dumps(value, ensure_ascii=True, default=str)
    except Exception:
        text = repr(value)
    text = text.replace("\n", " ").replace("\r", " ")
    limit = _preview_limit()
    if len(text) <= limit:
        return text
    return f"{text[:limit]} ... [truncated]"


def request(method: str, url: str, *, params: dict[str, Any] | None = None, headers: dict[str, Any] | None = None, json_body: Any = None, timeout: int | float = 30) -> requests.Response:
    setup_backend_logging()
    started = time.time()
    if _logging_enabled():
        LOGGER.info(
            "HTTP request method=%s url=%s params=%s headers=%s json=%s timeout=%s",
            method.upper(),
            url,
            _preview_value(params),
            _preview_value(_sanitize_headers(headers)),
            _preview_value(json_body),
            timeout,
        )
    try:
        response = requests.request(method=method.upper(), url=url, params=params, headers=headers, json=json_body, timeout=timeout)
    except Exception:
        elapsed_ms = int((time.time() - started) * 1000)
        LOGGER.exception("HTTP request_failed method=%s url=%s elapsed_ms=%s", method.upper(), url, elapsed_ms)
        raise

    if _logging_enabled():
        content_type = response.headers.get("content-type")
        preview = _preview_value(response.text)
        LOGGER.info(
            "HTTP response method=%s url=%s status=%s elapsed_ms=%s content_type=%s body=%s",
            method.upper(),
            url,
            response.status_code,
            int((time.time() - started) * 1000),
            content_type,
            preview,
        )
    return response
