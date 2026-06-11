import pytest
from fastapi import HTTPException

from server import live_orders_enabled, require_live_order_permission


def test_live_orders_are_disabled_without_explicit_env(monkeypatch):
    monkeypatch.delenv("ALLOW_LIVE_ORDERS", raising=False)

    assert live_orders_enabled() is False
    with pytest.raises(HTTPException) as exc:
        require_live_order_permission(dry_run=False)

    assert exc.value.status_code == 403


def test_live_orders_can_be_explicitly_enabled(monkeypatch):
    monkeypatch.setenv("ALLOW_LIVE_ORDERS", "true")

    assert live_orders_enabled() is True
    require_live_order_permission(dry_run=False)
