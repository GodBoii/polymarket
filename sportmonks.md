Sportmonks Football API v3

Base URL: https://api.sportmonks.com/v3/football
Core API: https://api.sportmonks.com/v3/core
Auth: ?api_token=YOUR_TOKEN on every request

--- SEARCH ---
GET /players/search/{query}
GET /teams/search/{query}
GET /leagues/search/{query}

--- PLAYERS & TEAMS ---
GET /players/{id}
GET /teams/{id}
GET /leagues/{id}

--- SQUADS ---
GET /squads/teams/{team_id}
GET /squads/seasons/{season_id}/teams/{team_id}

--- FIXTURES ---
GET /fixtures/{id}
GET /fixtures/date/{date}
GET /fixtures/between/{start}/{end}
GET /fixtures/between/{start}/{end}/{team_id}
GET /fixtures/head-to-head/{team1_id}/{team2_id}
GET /livescores/inplay
GET /livescores

--- STANDINGS ---
GET /standings/seasons/{season_id}
GET /standings/live/leagues/{league_id}
GET /standings/rounds/{round_id}

--- TOPSCORERS ---
GET /topscorers/seasons/{season_id}
Common type IDs: goals=208, assists=209, yellow cards=84

--- INCLUDES ---
Pass as semicolon-separated string:
participants       - the two teams
scores             - current and final scoreline
state              - match state (NS/LIVE/HT/FT/AET/PEN)
league             - league name and ID
round              - gameweek/matchday
events             - goals, cards, substitutions
lineups            - starting XI and bench
statistics         - team stats (shots, possession, corners, etc.)
periods            - first half, second half breakdown
venue              - stadium info
player             - full player object (nest inside squad/lineup)
position           - player position
detailedPosition   - more granular position

--- FILTERS ---
Pass as key:value syntax:
fixtureLeagues:{league_id}        - filter fixtures by league
fixtureStates:{state_id,state_id} - filter by match state (2=1H, 22=2H)
fixturestatisticTypes:{type_ids}  - filter stat types
eventTypes:{type_ids}             - filter event types
seasonTopscorerTypes:{type_id}    - filter topscorer type

--- PAGINATION ---
?page=1&per_page=25&order=asc

--- COMMON IDs ---
Premier League: league_id=8
La Liga: league_id=564
Bundesliga: league_id=82
Serie A: league_id=384
Ligue 1: league_id=301
Champions League: league_id=2
World Cup 2026: league_id=732, season_id=26618

Docs: https://docs.sportmonks.com/football


Sportmonks Football API v3

Base URL: https://api.sportmonks.com/v3/football
Auth: ?api_token=YOUR_TOKEN (query parameter on every request)

Key endpoints:
GET /players/search/{query}
GET /teams/search/{query}
GET /leagues/search/{query}
GET /fixtures/{id}
GET /fixtures/date/{date}
GET /livescores/inplay
GET /squads/teams/{team_id}
GET /standings/live/leagues/{league_id}
GET /topscorers/seasons/{season_id}

Includes: semicolon-separated (e.g. include=participants;scores;league;state)
Filters: key:value syntax (e.g. filters=fixtureLeagues:8)
Pagination: ?page=1&per_page=25

Docs: https://docs.sportmonks.com/football

I'm building with the Sportmonks Football API v3.
Base URL: https://api.sportmonks.com/v3/football
Auth: api_token query parameter, read from SPORTMONKS_API_TOKEN env var.

Build a live score dashboard:
- Fetch in-play matches from GET /livescores/inplay?include=participants;scores;state;periods
- Display each match as a card: home team, away team, current score, match state (1H/HT/2H), elapsed minutes
- Poll every 30 seconds and update without a full page reload
- Show a "No live matches right now" empty state when the feed is empty

Use React and Tailwind CSS.
First, fetch a real sample response from the endpoint and print the raw JSON so we can confirm the data shape before writing any UI.

I'm building with the Sportmonks Football API v3.
Base URL: https://api.sportmonks.com/v3/football
Auth: api_token query parameter, read from SPORTMONKS_API_TOKEN env var.

Build a pre-match briefing generator:
1. Accept a fixture ID as input
2. Fetch the fixture: GET /fixtures/{id}?include=participants;league;state
3. Extract the two team IDs from participants, then fetch: GET /fixtures/head-to-head/{team1_id}/{team2_id}?per_page=5&order=desc&include=participants;scores
4. Fetch current standings: GET /standings/live/leagues/{league_id}?include=participant;details

Render a briefing card showing:
- Match title, kick-off time, competition name
- Last 5 H2H results as a compact table (date, result, score)
- Current league position for each team (position, played, points)

Use Next.js with Tailwind. Accept the fixture ID as a URL param (/briefing?fixture=123456).
Start by printing the raw API responses for fixture 19135697 before writing any UI.

I'm building with the Sportmonks Football API v3.
Base URL: https://api.sportmonks.com/v3/football
Auth: api_token query parameter, read from SPORTMONKS_API_TOKEN env var.

Build a squad viewer:
1. A search input that calls GET /teams/search/{query} and shows results as a clickable list
2. On team select, fetch: GET /squads/teams/{team_id}?include=player;position;detailedPosition
3. Display the squad grouped by position (Goalkeepers, Defenders, Midfielders, Attackers), each player showing name, jersey number, and detailed position

Use React and Tailwind.
First fetch team_id 85 (Arsenal) squad and print the raw JSON to confirm the response shape before building the UI.


I'm building with the Sportmonks Football API v3.
Base URL: https://api.sportmonks.com/v3/football
Auth: api_token query parameter, read from SPORTMONKS_API_TOKEN env var.

Build a top scorers leaderboard:
1. On load, fetch the Premier League's current season: GET /leagues/8?include=currentseason
2. Fetch the top 25 goal scorers: GET /topscorers/seasons/{season_id}?include=player;participant;type&filters=seasonTopscorerTypes:208&per_page=25
3. Show a ranked table: position, player name, team, count
4. Add a toggle between goals (type 208), assists (type 209), and yellow cards (type 84) - re-fetch on switch

Use React and Tailwind. Show a skeleton loader while fetching.
Start by printing the league and topscorers responses before writing any UI.


Types_overview API V3.xlsx