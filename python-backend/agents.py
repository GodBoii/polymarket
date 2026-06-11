from agno.agent import Agent
from agno.db.json import JsonDb
from agno.team import Team
from agno.tools.websearch import WebSearchTools

from config import WEB_SEARCH_BACKEND, build_openrouter_model
from polycognitive_tools import FixtureSelectionToolkit, PolycognitiveToolkit


NATURAL_RESPONSE_RULES = [
    "You may respond naturally in concise Markdown.",
    "Do not expose private chain-of-thought. Share a concise decision summary, evidence, confidence, and action taken.",
]

ULTRA_THINK_RULES = [
    "ULTRA THINK: Before acting, pause and reason step by step; do not rush to a conclusion.",
    "Think deeply and for longer than you normally would. Consider every angle before deciding.",
    "Reason through the problem sequentially: (1) gather all available data, (2) weigh the evidence, (3) form a probability estimate, (4) compare to market price, (5) decide action.",
    "Use all available information and context - match data, team form, injuries, historical results, weather, Polymarket odds, and web search results - to form a well-reasoned opinion.",
    "Synthesize the evidence to explicitly judge which team is stronger and has a higher probability of winning. State your reasoning clearly before placing any bet.",
]

BUDGET_RULES = [
    "Total budget is $100 USDC. Do not exceed this across all bets in a session.",
    "Minimum bet size is $1 USDC. Never place an order below $1.",
    "Maximum bet size is $5 USDC per order. Never place a single bet above $5.",
    "We need more than 10 bets across the $100 bankroll, so keep sizing compact: $1-2 for weak or uncertain edges, $3-4 for moderate edges, and use $5 only for the clearest opportunities.",
    "Always check current exposure before betting to avoid exceeding budget or duplicating risk.",
]

SEARCH_RULES = [
    "Use the shared web search toolkit when you need current external information.",
    "Search with focused queries and summarize the takeaway instead of copying large search result dumps, long lineups, or long tables into the final answer.",
]


def build_web_search_tools() -> WebSearchTools:
    return WebSearchTools(
        backend=WEB_SEARCH_BACKEND,
        timeout=15,
        fixed_max_results=5,
        region="us-en",
    )


def fixture_agent(db: JsonDb, session_id: str, fixture_tools: FixtureSelectionToolkit) -> Agent:
    return Agent(
        name="fixture_agent",
        role="Select one World Cup football fixture for POLYCOGNITIVE to analyze.",
        model=build_openrouter_model(),
        db=db,
        session_id=f"{session_id}:fixture_agent",
        user_id="polymarket-arena-builder",
        tools=[fixture_tools, build_web_search_tools()],
        instructions=[
            *NATURAL_RESPONSE_RULES,
            *ULTRA_THINK_RULES,
            *SEARCH_RULES,
            "Call get_worldcup_fixture_candidates before selecting a fixture.",
            "Choose the strongest fixture using named teams, kickoff timing, venue/weather context, Polymarket mapping, market count, midpoint count, and odds coverage.",
            "Prefer fixtures with tradable prices and enough football context for a decisive bet.",
            "Return the chosen fixture id plainly using the text `fixture_id: <number>` and explain the reason briefly.",
            f"If you need any additional information (team news, injuries, form, weather, odds, or other context), use WebSearchTools with the configured `{WEB_SEARCH_BACKEND}` backend.",
        ],
        markdown=True,
        telemetry=False,
        debug_mode=True,
    )


def polycognitive_team(
    db: JsonDb,
    session_id: str,
    fixture_tools: FixtureSelectionToolkit,
    arena_tools: PolycognitiveToolkit,
) -> Team:
    selector = fixture_agent(db, session_id, fixture_tools)
    return Team(
        name="POLYCOGNITIVE (POLY-09)",
        role="World Cup Arena prediction-market research and execution team.",
        members=[selector],
        model=build_openrouter_model(),
        db=db,
        session_id=session_id,
        user_id="polymarket-arena-builder",
        tools=[arena_tools, build_web_search_tools()],
        instructions=[
            *NATURAL_RESPONSE_RULES,
            *ULTRA_THINK_RULES,
            *BUDGET_RULES,
            *SEARCH_RULES,
            "First delegate fixture selection to fixture_agent and use its selected fixture_id.",
            "Then call get_match_context for football and historical evidence.",
            "Then call get_polymarket_context and get_current_exposure before any prediction or bet.",
            "Always convert the evidence into a three-outcome probability view for home, draw, and away. Think deeply - which team is objectively stronger based on all available data? State your opinion explicitly.",
            "Compare your probabilities to the available market prices and choose the best buy-YES outcome. Prefer backing the stronger team unless the market price makes it a poor value bet.",
            "Submit a prediction to Stair AI with submit_prediction_to_stair before placing the bet.",
            "Place a bet with place_bet on the best available outcome following the budget rules above.",
            "Do not end the run without choosing an outcome unless order submission is technically impossible.",
            "Use current exposure to avoid accidental duplicate risk, but if there is no duplicate exposure, take the best available bet.",
            "Keep final output natural: selected fixture, evidence read, probability view, team strength opinion, market comparison, prediction submitted, bet placed, confidence, and main factors.",
            f"If you need any additional information (live scores, breaking news, team updates, market trends, or any other context), use WebSearchTools with the configured `{WEB_SEARCH_BACKEND}` backend.",
        ],
        markdown=True,
        telemetry=False,
        debug_mode=True,
        stream_member_events=True,
        store_events=True,
    )
