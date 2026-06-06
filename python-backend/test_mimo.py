import os
from pathlib import Path

from agno.agent import Agent
from agno.models.xiaomi import MiMo


ROOT = Path(__file__).resolve().parents[1]
MIMO_BASE_URL = "https://token-plan-ams.xiaomimimo.com/v1"
MIMO_MODEL = "mimo-v2.5-pro"


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

    mimo_api_key = os.environ.get("MIMO_API_KEY")
    if not mimo_api_key:
        raise SystemExit("Missing MIMO_API_KEY in .env")

    print("Testing Xiaomi MiMo through Agno...")
    print(f"MIMO_API_KEY: present, length={len(mimo_api_key)}")
    print(f"model: {MIMO_MODEL}")
    print(f"base_url: {MIMO_BASE_URL}")

    agent = Agent(
        name="MiMo Smoke Test Agent",
        model=MiMo(
            id=MIMO_MODEL,
            api_key=mimo_api_key,
            base_url=MIMO_BASE_URL,
            use_thinking=False,
        ),
        instructions=[
            "You are a concise test agent.",
            "Reply with exactly one short sentence.",
        ],
        markdown=False,
    )

    response = agent.run(
        "what do you know about india?"
    )
    content = getattr(response, "content", response)

    print("\nAgent response:")
    print(content)
    print("\nMiMo Agno smoke test passed.")


if __name__ == "__main__":
    main()
