from typing import Any

from agno.agent import Agent
from agno.db.json import JsonDb

from config import build_openrouter_model


JSON_RULES = [
    "Return only valid JSON.",
    "Do not wrap the JSON in markdown fences.",
    "Use null when a value is unavailable.",
    "Be explicit about data gaps and confidence.",
]


def make_agent(name: str, role: str, db: JsonDb, session_id: str) -> Agent:
    return Agent(
        name=name,
        model=build_openrouter_model(),
        db=db,
        session_id=session_id,
        user_id="polymarket-arena-builder",
        description=role,
        instructions=JSON_RULES,
        markdown=False,
        telemetry=False,
        debug_mode=True,
    )


def fixture_selector_agent(db: JsonDb, session_id: str) -> Agent:
    return make_agent(
        "Fixture Selector",
        "Select and normalize the target football fixture identity for downstream agents.",
        db,
        session_id,
    )


def sportmonks_agent(db: JsonDb, session_id: str) -> Agent:
    return make_agent(
        "Sportmonks Research Agent",
        "Digest Sportmonks football data into pre-game signals without looking at market prices.",
        db,
        session_id,
    )


def polymarket_agent(db: JsonDb, session_id: str) -> Agent:
    return make_agent(
        "Polymarket Market Agent",
        "Digest Polymarket market data into pricing, implied probability, and execution handles.",
        db,
        session_id,
    )


def supabase_agent(db: JsonDb, session_id: str) -> Agent:
    return make_agent(
        "Supabase Historical Agent",
        "Digest Supabase historical priors into team history and matchup signals.",
        db,
        session_id,
    )


def prediction_agent(db: JsonDb, session_id: str) -> Agent:
    return make_agent(
        "Prediction Agent",
        "Make an independent match prediction from football and historical signals only.",
        db,
        session_id,
    )


def strategy_agent(db: JsonDb, session_id: str) -> Agent:
    return make_agent(
        "Strategy Agent",
        "Compare an independent prediction to market prices and decide trade or no-trade.",
        db,
        session_id,
    )


def prompt_for_fixture_selection(target_fixture_id: int, schedule_summary: dict[str, Any]) -> str:
    return f"""
Select the target fixture and return this schema:
{{
  "fixture_id": int,
  "fixture_code": str,
  "selection_reason": str,
  "schedule_entries_seen": int
}}

Target fixture id: {target_fixture_id}
Schedule summary: {schedule_summary}
"""


def prompt_for_sportmonks_digest(fixture_context: dict[str, Any]) -> str:
    return f"""
Digest the Sportmonks pre-game data for one fixture.

Prefer the decoded `features` object when it is available. In particular:
- Use `features.predictions.fulltime_result_probability` for the 1X2 full-time outcome probabilities.
- Do not treat `FIRST_HALF_WINNER_PROBABILITY` or `TEAM_TO_SCORE_FIRST_PROBABILITY` as full-time win/draw/loss.
- Use `features.odds.match_result_vig_free_consensus` for bookmaker consensus, because it is filtered to match-result odds and has bookmaker margin removed.
- Use raw `prediction_rows` and `match_result_odds_rows` only as audit/detail context.

Return this schema:
{{
  "source": "sportmonks",
  "fixture": str,
  "fixture_id": int,
  "home_team": str,
  "away_team": str,
  "home_code": str,
  "away_code": str,
  "available_signals": [str],
  "probabilities": {{"HOME_TEAM_CODE": float|null, "draw": float|null, "AWAY_TEAM_CODE": float|null}},
  "bookmaker_consensus_probabilities": {{"HOME_TEAM_CODE": float|null, "draw": float|null, "AWAY_TEAM_CODE": float|null}}|null,
  "expected_goals": {{"HOME_TEAM_CODE": float|null, "AWAY_TEAM_CODE": float|null}}|null,
  "bookmaker_count": int|null,
  "confidence": "low"|"medium"|"high",
  "data_gaps": [str],
  "summary": str
}}

Probability values must be decimals from 0 to 1, not percentages.
Use the actual team short codes as probability keys. Do not use placeholder keys like HOME_CODE, HOME_TEAM_CODE, AWAY_CODE, or AWAY_TEAM_CODE.

Context:
{fixture_context}
"""


def prompt_for_polymarket_digest(market_context: dict[str, Any]) -> str:
    return f"""
Digest the Polymarket market data for one football fixture.

Return this schema:
{{
  "source": "polymarket",
  "event_slug": str|null,
  "event_title": str|null,
  "implied_probabilities": {{"HOME_TEAM_CODE": float|null, "draw": float|null, "AWAY_TEAM_CODE": float|null}},
  "sum_implied_probability": float|null,
  "execution_handles": [
    {{"outcome": str, "condition_id": str|null, "yes_token_id": str|null, "mid": float|null}}
  ],
  "pricing_available": bool,
  "data_gaps": [str],
  "summary": str
}}

Context:
{market_context}
"""


def prompt_for_supabase_digest(history_context: dict[str, Any]) -> str:
    return f"""
Digest the Supabase historical priors for the two countries.

Return this schema:
{{
  "source": "supabase",
  "home_country": str,
  "away_country": str,
  "available_tables": [str],
  "historical_signals": [
    {{"signal": str, "home_value": str|float|null, "away_value": str|float|null, "interpretation": str}}
  ],
  "h2h_summary": str|null,
  "confidence": "low"|"medium"|"high",
  "data_gaps": [str],
  "summary": str
}}

Context:
{history_context}
"""


def prompt_for_prediction(sportmonks_digest: dict[str, Any], supabase_digest: dict[str, Any]) -> str:
    return f"""
Make an independent football prediction. Do not use Polymarket market prices.

Return this schema:
{{
  "fixture": str,
  "outcome": str,
  "probability": float,
  "probabilities": {{"home": float, "draw": float, "away": float}},
  "confidence_level": "low"|"medium"|"high",
  "rationale": str,
  "key_factors": [str],
  "data_gaps": [str]
}}

Sportmonks digest:
{sportmonks_digest}

Supabase digest:
{supabase_digest}
"""


def prompt_for_strategy(strategy_context: dict[str, Any]) -> str:
    return f"""
Decide whether to trade using a conservative $100 demo bankroll.

Rules:
- Evaluate every listed outcome, not only the most likely predicted outcome.
- Edge = prediction probability for that outcome minus Polymarket implied probability for the same outcome.
- Positive edge means the outcome's YES market appears underpriced and can be bought.
- Negative edge means that specific YES market appears overpriced; do not buy that YES market.
- If no outcome has positive edge of at least 5 percentage points, do not trade.
- Maximum trade size is $5.
- Stair arena orders are submitted as buy-YES orders using fixture_code/team_code. Therefore, when one outcome is overpriced, express the fade by buying YES on the underpriced alternative outcome with the best positive edge when one exists.
- You may discuss a short/fade thesis in the rationale, but if should_trade=true the executable order must be direction="long", team_code must be the outcome to buy YES on, and limit_price must be near that outcome's YES mid.
- limit_price should be near but not wildly above the market mid for the selected YES token.
- If should_trade=false, direction must be "none", size_usdc must be "0", limit_price must be null, and team_code must be null.
- If should_trade=true, direction must be "long", team_code must be one of the available outcome codes, size_usdc must be 1.00 to 5.00, and limit_price must be a number.
- Prefer the provided `best_buy_yes` candidate when it exists, unless you can justify a more conservative no-trade due to low confidence or missing pricing.

Return this schema:
{{
  "should_trade": bool,
  "outcome": str,
  "team_code": str|null,
  "direction": "long"|"short"|"none",
  "size_usdc": str,
  "limit_price": float|null,
  "edge_pp": float|null,
  "confidence": "low"|"medium"|"high",
  "rationale": str
}}

Strategy context:
{strategy_context}
"""
