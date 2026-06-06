export type ReasoningEntry = {
  ts: string;
  stage: "RESEARCH" | "REASONING" | "DECISION";
  subject: string;
  message: string;
  confidence: number;
  delta?: number;
};

export const REASONING_SEED: ReasoningEntry[] = [
  { ts: "14:02:18.421", stage: "RESEARCH",  subject: "France vs Argentina",  message: "Wire pull: 184 sources updated. Squad depth re-rated +0.6σ.", confidence: 0.84 },
  { ts: "14:02:18.876", stage: "REASONING", subject: "France",               message: "Mbappé cleared by medical staff. Win probability Δ +0.018. Cross-referencing 4-3-3 historical xG.", confidence: 0.91, delta: +0.018 },
  { ts: "14:02:19.204", stage: "REASONING", subject: "Argentina",            message: "Midfield availability narrowed. Reach-semifinal 0.71 → 0.68. Running Monte Carlo (n=10,000).", confidence: 0.84, delta: -0.030 },
  { ts: "14:02:19.918", stage: "DECISION",  subject: "France vs Argentina",  message: "Win probability 0.51. Confidence 0.91. Published. Audit trail locked.", confidence: 0.91 },
  { ts: "14:02:20.412", stage: "RESEARCH",  subject: "Brazil",               message: "Tactical report: high press efficiency up 11% across last 5 matches.", confidence: 0.72 },
  { ts: "14:02:21.077", stage: "REASONING", subject: "England",              message: "Probability increased. Reason: Midfield confirmed. Win 0.42 → 0.46.", confidence: 0.87, delta: +0.040 },
  { ts: "14:02:21.604", stage: "DECISION",  subject: "England",              message: "Win probability 0.46. Confidence 0.87. Published.", confidence: 0.87 },
  { ts: "14:02:22.183", stage: "RESEARCH",  subject: "Spain vs Germany",     message: "Injury report ingested. Spain 2 starters at 92% / 88% availability.", confidence: 0.81 },
  { ts: "14:02:22.740", stage: "REASONING", subject: "Spain",                message: "Counterfactual: with both starters, win 0.48 → 0.51. Confidence ceiling 0.79.", confidence: 0.79, delta: +0.030 },
  { ts: "14:02:23.301", stage: "DECISION",  subject: "Spain vs Germany",     message: "Win probability 0.42 / 0.30 / 0.28 (home/draw/away). Confidence 0.79. Published.", confidence: 0.79 },
  { ts: "14:02:24.118", stage: "RESEARCH",  subject: "Netherlands",          message: "Wire: Van Dijk returns to training. Squad depth metric re-rated.", confidence: 0.68 },
  { ts: "14:02:24.802", stage: "REASONING", subject: "United States",        message: "Counterfactual simulation: n=4,182. Confidence 0.72. Reach-quarterfinal 0.44 → 0.45.", confidence: 0.72, delta: +0.010 },
  { ts: "14:02:25.421", stage: "DECISION",  subject: "United States",        message: "Win probability 0.051. Confidence 0.72. Published.", confidence: 0.72 },
  { ts: "14:02:26.040", stage: "REASONING", subject: "Brazil vs England",    message: "Win interval narrows to 0.43 – 0.49. Convergence after 14,287 simulation runs.", confidence: 0.84 },
  { ts: "14:02:26.711", stage: "DECISION",  subject: "Brazil vs England",    message: "Win probability 0.46. Draw 0.27. Away 0.27. Confidence 0.84. Published.", confidence: 0.84 },
  { ts: "14:02:27.418", stage: "RESEARCH",  subject: "Argentina",            message: "Historical query: 18 knockouts since 2014. Win rate 0.61 when conceding first.", confidence: 0.78 },
  { ts: "14:02:28.001", stage: "REASONING", subject: "Argentina",            message: "Reasoning: France's high-press efficiency vs ARG build-up. Δ +0.022 on ARG.", confidence: 0.81, delta: +0.022 },
  { ts: "14:02:28.611", stage: "DECISION",  subject: "France vs Argentina",  message: "Re-evaluation. Win probability 0.51 → 0.50. Draw 0.24 → 0.25. Published.", confidence: 0.91 },
  { ts: "14:02:29.220", stage: "RESEARCH",  subject: "Germany",              message: "Counter-running xG: 2.18 (last 5). Squad depth metric: 0.71 σ.", confidence: 0.74 },
  { ts: "14:02:29.881", stage: "REASONING", subject: "Spain",                message: "Probability decreased. Reason: tactical asymmetry detected. Δ -0.014.", confidence: 0.79, delta: -0.014 },
  { ts: "14:02:30.490", stage: "DECISION",  subject: "Spain",                message: "Win probability 0.42 → 0.41. Confidence 0.79. Published.", confidence: 0.79 },
  { ts: "14:02:31.144", stage: "REASONING", subject: "Tournament",           message: "Top-4 distribution: BRA 41 / ARG 33 / FRA 27 / ENG 24. Rebalanced by 0.4σ.", confidence: 0.83 },
  { ts: "14:02:31.820", stage: "DECISION",  subject: "Tournament",           message: "Reach-semifinal probabilities published across 32 teams. Audit log closed.", confidence: 0.83 },
  { ts: "14:02:32.401", stage: "RESEARCH",  subject: "Global",               message: "184 wires, 14,287 historical matches, 1,204 squad files, 412 tactical reports in last 60s.", confidence: 0.90 },
];

export const REASONING_TEMPLATES: Omit<ReasoningEntry, "ts">[] = [
  { stage: "RESEARCH",  subject: "France",        message: "Wire: training ground report ingested. 4 sources, 1.4σ consensus.", confidence: 0.82 },
  { stage: "REASONING", subject: "Argentina",     message: "Counterfactual: with Messi 90' available, win Δ +0.034. Monte Carlo converges.", confidence: 0.86, delta: +0.034 },
  { stage: "DECISION",  subject: "France vs Argentina", message: "Win probability 0.51 → 0.52. Confidence 0.91. Published. Audit locked.", confidence: 0.91 },
  { stage: "RESEARCH",  subject: "Brazil",        message: "Tactical report: high press efficiency up 11% across last 5 matches.", confidence: 0.72 },
  { stage: "REASONING", subject: "England",       message: "Probability increased. Reason: Midfield confirmed. Win 0.42 → 0.46.", confidence: 0.87, delta: +0.040 },
  { stage: "DECISION",  subject: "England",       message: "Win probability 0.46. Confidence 0.87. Published.", confidence: 0.87 },
  { stage: "REASONING", subject: "Spain",         message: "Probability decreased. Reason: tactical asymmetry. Δ -0.014.", confidence: 0.79, delta: -0.014 },
  { stage: "RESEARCH",  subject: "United States", message: "Squad depth re-rated +0.6σ. CONFED-CAF fixture window opens.", confidence: 0.71 },
  { stage: "DECISION",  subject: "Tournament",    message: "Reach-semifinal probabilities published across 32 teams. Audit log closed.", confidence: 0.83 },
  { stage: "REASONING", subject: "Netherlands",   message: "Van Dijk returns. Build-up Δ +0.018. Counterfactual n=4,182 runs.", confidence: 0.78, delta: +0.018 },
];
