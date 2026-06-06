import os
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests


LOCAL_STORE_PATH = Path(__file__).resolve().parent / "storage" / "app_runs.json"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LocalRunStore:
    def __init__(self) -> None:
        LOCAL_STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        if not LOCAL_STORE_PATH.exists():
            self._write({"runs": [], "events": []})

    def _read(self) -> dict[str, Any]:
        return json.loads(LOCAL_STORE_PATH.read_text(encoding="utf-8"))

    def _write(self, data: dict[str, Any]) -> None:
        LOCAL_STORE_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=True, default=str), encoding="utf-8")

    def create_run(self, run_id: str, fixture_id: int, status: str = "running", mode: str = "manual") -> dict[str, Any]:
        data = self._read()
        run = {
            "id": run_id,
            "fixture_id": fixture_id,
            "mode": mode,
            "status": status,
            "fixture": None,
            "result": None,
            "created_at": utc_now(),
            "completed_at": None,
        }
        data["runs"].append(run)
        self._write(data)
        return run

    def update_run(self, run_id: str, **fields: Any) -> dict[str, Any]:
        data = self._read()
        for run in data["runs"]:
            if run["id"] == run_id:
                if fields.get("status") == "completed" and "completed_at" not in fields:
                    fields["completed_at"] = utc_now()
                run.update(fields)
                self._write(data)
                return run
        return {}

    def add_event(self, run_id: str, event_type: str, stage: str, payload: dict[str, Any]) -> dict[str, Any]:
        data = self._read()
        event = {
            "id": len(data["events"]) + 1,
            "run_id": run_id,
            "event_type": event_type,
            "stage": stage,
            "payload": payload,
            "created_at": utc_now(),
        }
        data["events"].append(event)
        self._write(data)
        return event

    def list_runs(self, limit: int = 50) -> list[dict[str, Any]]:
        data = self._read()
        return sorted(data["runs"], key=lambda row: row.get("created_at") or "", reverse=True)[:limit]

    def get_run(self, run_id: str) -> dict[str, Any]:
        data = self._read()
        for run in data["runs"]:
            if run["id"] == run_id:
                return run
        return {}

    def get_events(self, run_id: str) -> list[dict[str, Any]]:
        data = self._read()
        return [event for event in data["events"] if event.get("run_id") == run_id]


class SupabaseRunStore:
    def __init__(self) -> None:
        self.local = LocalRunStore()
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

    def create_run(self, run_id: str, fixture_id: int, status: str = "running", mode: str = "manual") -> dict[str, Any]:
        payload = {"id": run_id, "fixture_id": fixture_id, "status": status, "mode": mode}
        response = requests.post(f"{self.base}/agent_runs", headers=self.headers, json=payload, timeout=30)
        if response.status_code == 404:
            return self.local.create_run(run_id, fixture_id, status, mode)
        if response.status_code == 400 and "mode" in response.text:
            payload.pop("mode", None)
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
        if response.status_code == 404:
            return self.local.update_run(run_id, **fields)
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else {}

    def add_event(self, run_id: str, event_type: str, stage: str, payload: dict[str, Any]) -> dict[str, Any]:
        body = {"run_id": run_id, "event_type": event_type, "stage": stage, "payload": payload}
        response = requests.post(f"{self.base}/agent_events", headers=self.headers, json=body, timeout=30)
        if response.status_code == 404:
            return self.local.add_event(run_id, event_type, stage, payload)
        response.raise_for_status()
        return response.json()[0]

    def list_runs(self, limit: int = 50) -> list[dict[str, Any]]:
        response = requests.get(
            f"{self.base}/agent_runs",
            params={"select": "*", "order": "created_at.desc", "limit": str(limit)},
            headers=self.headers,
            timeout=30,
        )
        if response.status_code == 404:
            return self.local.list_runs(limit)
        response.raise_for_status()
        return response.json()

    def get_run(self, run_id: str) -> dict[str, Any]:
        response = requests.get(
            f"{self.base}/agent_runs",
            params={"select": "*", "id": f"eq.{run_id}", "limit": "1"},
            headers=self.headers,
            timeout=30,
        )
        if response.status_code == 404:
            return self.local.get_run(run_id)
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
        if response.status_code == 404:
            return self.local.get_events(run_id)
        response.raise_for_status()
        return response.json()
