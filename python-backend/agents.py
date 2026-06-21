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
    "Maximum bet size is $15 USDC per order. Never place a single bet above $15.",
    "Choose bet size dynamically from $1 to $15 based on confidence, market liquidity, spread, order-book depth, and remaining edge after executable ask price.",
    "Use smaller sizes near $1-$5 for weak, uncertain, wide-spread, or thin-book edges; use larger sizes up to $15 only when confidence, liquidity, and executable price quality are strong.",
    "Always check current exposure before betting to avoid exceeding budget or duplicating risk.",
]

SEARCH_RULES = [
    "Use the shared web search toolkit when you need current external information.",
    "Search with focused queries and summarize the takeaway instead of copying large search result dumps, long lineups, or long tables into the final answer.",
]

LEDGER_QUALITY_RULES = [
    "This is the Stair AI World Cup Agent Arena. Tournament ranking depends on both correct predictions/bets and the quality/completeness of the submitted Reasoning Ledger trace.",
    "Treat the Reasoning Ledger as a scored artifact: every major observation, data source, probability judgment, market comparison, prediction, and order/skip decision must be represented clearly.",
    "Use record_ledger_checkpoint after major reasoning milestones when a concise, high-quality audit note would help Stair evaluate the run: evidence gathered, data quality/gaps, probability estimate, edge calculation, and final action rationale.",
    "Do not fabricate data for ledger quality. If a source is missing, stale, unavailable, or low-confidence, say that explicitly in the checkpoint.",
    "Do not manually invent raw ledger IDs, timestamps, schema fields, or batch payloads. Use the provided tools; the backend will create schema-valid records and submit them to Stair AI.",
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
            *LEDGER_QUALITY_RULES,
            "Use the current date and assigned fixture details supplied by the backend prompt; do not rely on stale hard-coded dates.",
            "bet on todays matches",
            "Select and bet on only one match at a time. Do not try to do everything all at once; select one match, take one bet, and stop.",
            "Call get_worldcup_match_slate before selecting a fixture so you can see the full listed match slate with dates and any existing open exposure.",
            "Then call get_worldcup_fixture_candidates before selecting a fixture.",
            "Prioritize selecting a match from today's matches that has 0 current open exposures (open_exposure_count == 0). Never select any match that already has 1 or more exposures.",
            "Select a match that has 0 current exposures. The goal is to bet on todays matches. Ensure you analyze the match with deep reasoning and step-by-step thinking of all aspects and information.",
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
    fixture_tools: FixtureSelectionToolkit | PolycognitiveToolkit,
    arena_tools: PolycognitiveToolkit | None = None,
) -> Team:
    if arena_tools is None:
        arena_tools = fixture_tools  # Backwards-compatible call shape after removing the selector from normal flow.
    return Team(
        name="POLYCOGNITIVE (POLY-09)",
        role="World Cup Arena prediction-market research and execution team.",
        members=[],
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
            *LEDGER_QUALITY_RULES,
            "Use the current date and assigned fixture details supplied by the backend prompt; do not rely on stale hard-coded dates.",
            "The backend assigns exactly one fixture_id to this run. Do not select, replace, or delegate fixture selection.",
            "Analyze only the assigned fixture_id from the user prompt. If the fixture is not tradable pre-match, explain the blocker and stop safely.",
            "Call get_account_status early in the run and use it as the bankroll and exposure source of truth.",
            "Then call get_match_context for the assigned fixture_id for football and historical evidence.",
            "Then call get_polymarket_context, get_executable_market_snapshot, and get_current_exposure for the assigned fixture_id before any prediction or bet.",
            "After match context is gathered, call record_ledger_checkpoint with the most important football evidence, historical priors, data quality, and missing data.",
            "After Polymarket context, executable market snapshot, and exposure are gathered, call record_ledger_checkpoint with midpoint prices, bid/ask, spread, tick size, last trade, order-book depth, current exposure, and any execution constraints.",
            "Before submit_prediction_to_stair, call record_ledger_checkpoint with your independent three-outcome probabilities, main reasons, confidence, and the exact outcome you intend to submit.",
            "Always convert the evidence into a three-outcome probability view for home, draw, and away.",
            "Compare your probabilities to executable buy prices, not only midpoint. For buy-YES orders, use the best ask or the depth-derived worst price for your chosen size as the real execution price.",
            "Use GET /book, /spread, /price, /last-trade-price, /tick-size, and /prices-history data from get_executable_market_snapshot to choose both order size and limit price.",
            "Do not hard-code a default bet size or default limit price. Choose a size between $1 and $15 and a tick-valid limit price based on confidence, liquidity, and executable edge.",
            "Use account status and current exposure to limit bets on any single fixture to a maximum of 1. You may place up to 1 bet on the same fixture.",
            "Submit a prediction to Stair AI with submit_prediction_to_stair before placing the bet.",
            "Use place_guarded_bet on the best available outcome following the budget rules above. The tool will reject technically unsafe orders; only skip when confidence, edge, liquidity, window, or validation makes betting unsafe.",
            "After prediction/order execution, call record_ledger_checkpoint with the final prediction, market edge, order or skip result, and why this action best serves the tournament objective.",
            "Do not end the run without choosing an outcome unless order submission is technically impossible.",
            "Use current exposure to ensure you do not exceed 1 bet on the same fixture/outcome.",
            "Keep final output natural: assigned fixture, evidence read, probability view, market comparison, prediction submitted, bet placed or technical skip, confidence, and main factors.",
            f"If you need any additional information (live scores, breaking news, team updates, market trends, or any other context), use WebSearchTools with the configured `{WEB_SEARCH_BACKEND}` backend.",  
        ],
        markdown=True,
        telemetry=False,
        debug_mode=True,
        stream_member_events=True,
        store_events=True,
    )
