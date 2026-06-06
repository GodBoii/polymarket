export type LayerItem = {
  code: string;
  label: string;
  description: string;
  status: "LIVE" | "READY" | "QUEUED";
};

export type ReasoningLayer = {
  id: string;
  index: string;
  title: string;
  sub: string;
  items: LayerItem[];
};

export const REASONING_LAYERS: ReasoningLayer[] = [
  {
    id: "research",
    index: "01",
    title: "RESEARCH LAYER",
    sub: "We read fourteen sources per second. Every fact is timestamped and weighted by reliability.",
    items: [
      { code: "R-01", label: "News & Wires",         description: "184 sources monitored, weighted by source reliability and recency.", status: "LIVE" },
      { code: "R-02", label: "Historical Matches",   description: "14,287 matches since 2014 indexed; xG, possession, press intensity.", status: "LIVE" },
      { code: "R-03", label: "Squad & Injuries",     description: "1,204 squad files cross-referenced. Player availability in real time.", status: "LIVE" },
      { code: "R-04", label: "Market Sentiment",     description: "412 order-book snapshots per minute, normalised against prior distributions.", status: "READY" },
    ],
  },
  {
    id: "reasoning",
    index: "02",
    title: "REASONING LAYER",
    sub: "Multi-agent debate, scenario simulation, and counterfactual analysis. The work is auditable.",
    items: [
      { code: "X-01", label: "LLM Analysis",             description: "Three models cross-check. Disagreement is logged, not smoothed over.", status: "LIVE" },
      { code: "X-02", label: "Scenario Simulation",      description: "Monte Carlo with n=10,000. Confidence intervals published, not just point estimates.", status: "LIVE" },
      { code: "X-03", label: "Risk Assessment",          description: "Tail risk evaluated. Every published probability carries an upper / lower band.", status: "READY" },
      { code: "X-04", label: "Probability Generation",   description: "Final probability is the weighted aggregate of every input above.", status: "READY" },
    ],
  },
  {
    id: "decision",
    index: "03",
    title: "DECISION LAYER",
    sub: "A single published number. The reasoning behind it is stored, signed, and available.",
    items: [
      { code: "D-01", label: "Final Prediction",     description: "One probability per market. Published to the public feed and the leaderboard.", status: "LIVE" },
      { code: "D-02", label: "Confidence Score",     description: "0 – 1 score derived from model agreement and historical calibration.", status: "LIVE" },
      { code: "D-03", label: "Expected Value",       description: "Probability vs. market. Edge, when it exists, is computed and surfaced.", status: "READY" },
      { code: "D-04", label: "Market Opportunity",   description: "Liquidity, slippage, and book depth scored before any action is recommended.", status: "QUEUED" },
    ],
  },
];
