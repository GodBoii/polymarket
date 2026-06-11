import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "python-backend"
if str(BACKEND) not in sys.path:
    sys.path.append(str(BACKEND))

from agents import build_web_search_tools
from config import WEB_SEARCH_BACKEND, build_openrouter_model


def test_build_openrouter_model_clears_hidden_agno_token_caps(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    model = build_openrouter_model()

    assert model.max_tokens is None
    assert model.max_completion_tokens is None


def test_build_web_search_tools_uses_configured_backend():
    tools = build_web_search_tools()

    assert tools.backend == WEB_SEARCH_BACKEND
    assert tools.fixed_max_results == 5
    assert tools.region == "us-en"
