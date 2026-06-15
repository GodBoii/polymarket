import os
from pathlib import Path

from agno.agent import Agent
from agno.models.openrouter import OpenRouter
from agno.run.agent import RunStatus


ROOT = Path(__file__).resolve().parents[1]
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "nex-agi/nex-n2-pro:free")


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

    openrouter_api_key = os.environ.get("OPENROUTER_API_KEY")
    if not openrouter_api_key:
        raise SystemExit("Missing OPENROUTER_API_KEY in .env")

    print("Testing OpenRouter through Agno...")
    print(f"OPENROUTER_API_KEY: present, length={len(openrouter_api_key)}")
    print(f"model: {OPENROUTER_MODEL}")

    agent = Agent(
        name="OpenRouter Smoke Test Agent",
        model=OpenRouter(
            id=OPENROUTER_MODEL,
            api_key=openrouter_api_key,
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
    status = getattr(response, "status", None)

    print("\nAgent response:")
    print(content)
    if status == RunStatus.error:
        raise SystemExit("OpenRouter Agno smoke test failed.")

    print("\nOpenRouter Agno smoke test passed.")


if __name__ == "__main__":
    main()
