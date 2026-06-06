import os
from datetime import datetime, timezone
from typing import Any

import requests


class SupabaseRunStore:
    def __init__(self) -> None:
        self.url = os.environ.get("SUPABASE_APP_URL")
        self.key = os.environ.get("SUPABASE_APP_SERVICE_ROLE_KEY")
        if not self.url or not self.key:
            raise RuntimeError("SUPABASE_APP_URL and SUPABASE_APP_SERVICE_ROLE_KEY are required")
        self.base = f"{self.url.rstrip('/')}/rest/v1"
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def create_run(self, run_id: str, fixture_id: int, status: str = "running") -> dict[str, Any]:
        payload = {"id": run_id, "fixture_id": fixture_id, "status": status}
        response = requests.post(f"{self.base}/agent_runs", headers=self.headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()[0]

    def update_run(self, run_id: str, **fields: Any) -> dict[str, Any]:
        if fields.get("status") == "completed" and "completed_at" not in fields:
            fields["completed_at"] = datetime.now(timezone.utc).isoformat()
        response = requests.patch(
            f"{self.base}/agent_runs",
            params={"id": f"eq.{run_id}"},
            headers=self.headers,
            json=fields,
            timeout=30,
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else {}

    def add_event(self, run_id: str, event_type: str, stage: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = {"run_id": run_id, "event_type": event_type, "stage": stage, "payload": payload}
        response = requests.post(f"{self.base}/agent_events", headers=self.headers, json=body, timeout=30)
        response.raise_for_status()
        return response.json()[0]

    def list_runs(self, limit: int = 50) -> list[dict[str, Any]]:
        response = requests.get(
            f"{self.base}/agent_runs",
            params={"select": "*", "order": "created_at.desc", "limit": str(limit)},
            headers=self.headers,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def get_run(self, run_id: str) -> dict[str, Any]:
        response = requests.get(
            f"{self.base}/agent_runs",
            params={"select": "*", "id": f"eq.{run_id}", "limit": "1"},
            headers=self.headers,
            timeout=30,
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else {}

    def get_events(self, run_id: str) -> list[dict[str, Any]]:
        response = requests.get(
            f"{self.base}/agent_events",
            params={"select": "*", "run_id": f"eq.{run_id}", "order": "created_at.asc"},
            headers=self.headers,
            timeout=30,
        )
        response.raise_for_status()
        return response.json()
