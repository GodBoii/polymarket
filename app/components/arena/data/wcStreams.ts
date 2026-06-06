export type WCTeam = {
  code: string;
  name: string;
  confederation: "UEFA" | "CONMEBOL" | "AFC" | "CAF" | "CONCACAF" | "OFC";
  winProb: number;
  delta: number;
  reachQF: number;
  reachSF: number;
  reachF: number;
};

export const WC_WINNER: WCTeam[] = [
  { code: "BRA", name: "Brazil",       confederation: "CONMEBOL", winProb: 23.1, delta: +0.4, reachQF: 71, reachSF: 48, reachF: 26 },
  { code: "ARG", name: "Argentina",    confederation: "CONMEBOL", winProb: 18.4, delta: -0.2, reachQF: 68, reachSF: 44, reachF: 22 },
  { code: "FRA", name: "France",       confederation: "UEFA",     winProb: 16.2, delta: +0.7, reachQF: 64, reachSF: 41, reachF: 19 },
  { code: "ENG", name: "England",      confederation: "UEFA",     winProb: 14.0, delta: +0.6, reachQF: 60, reachSF: 36, reachF: 16 },
  { code: "ESP", name: "Spain",        confederation: "UEFA",     winProb:  9.7, delta: -0.1, reachQF: 56, reachSF: 31, reachF: 12 },
  { code: "GER", name: "Germany",      confederation: "UEFA",     winProb:  7.4, delta: +0.1, reachQF: 52, reachSF: 27, reachF: 10 },
  { code: "NED", name: "Netherlands",  confederation: "UEFA",     winProb:  6.1, delta: -0.2, reachQF: 48, reachSF: 24, reachF:  8 },
  { code: "USA", name: "United States", confederation: "CONCACAF", winProb:  5.1, delta: +0.3, reachQF: 44, reachSF: 21, reachF:  7 },
];

export type QualLane = {
  confederation: string;
  slots: number;
  teams: { code: string; prob: number; delta: number }[];
};

export const WC_QUALIFICATION: QualLane[] = [
  {
    confederation: "UEFA",
    slots: 16,
    teams: [
      { code: "FRA", prob: 0.98, delta: +0.01 },
      { code: "ESP", prob: 0.96, delta: -0.01 },
      { code: "GER", prob: 0.94, delta:  0.00 },
      { code: "ENG", prob: 0.97, delta: +0.01 },
      { code: "NED", prob: 0.92, delta: +0.02 },
      { code: "POR", prob: 0.86, delta: -0.01 },
      { code: "ITA", prob: 0.81, delta: +0.03 },
      { code: "BEL", prob: 0.74, delta: -0.02 },
    ],
  },
  {
    confederation: "CONMEBOL",
    slots: 6,
    teams: [
      { code: "BRA", prob: 0.99, delta:  0.00 },
      { code: "ARG", prob: 0.99, delta:  0.00 },
      { code: "URU", prob: 0.78, delta: +0.04 },
      { code: "COL", prob: 0.71, delta: -0.02 },
      { code: "CHI", prob: 0.42, delta: -0.03 },
      { code: "ECU", prob: 0.36, delta: +0.02 },
    ],
  },
  {
    confederation: "CONCACAF",
    slots: 6,
    teams: [
      { code: "USA", prob: 0.91, delta: +0.02 },
      { code: "MEX", prob: 0.86, delta: -0.01 },
      { code: "CAN", prob: 0.71, delta: +0.04 },
      { code: "CRC", prob: 0.34, delta: -0.02 },
    ],
  },
  {
    confederation: "AFC",
    slots: 8,
    teams: [
      { code: "JPN", prob: 0.84, delta: +0.03 },
      { code: "KOR", prob: 0.71, delta: -0.01 },
      { code: "IRN", prob: 0.62, delta: +0.02 },
      { code: "AUS", prob: 0.54, delta: +0.01 },
      { code: "KSA", prob: 0.41, delta: -0.02 },
      { code: "QAT", prob: 0.38, delta:  0.00 },
    ],
  },
  {
    confederation: "CAF",
    slots: 9,
    teams: [
      { code: "MAR", prob: 0.79, delta: +0.02 },
      { code: "SEN", prob: 0.66, delta: +0.04 },
      { code: "NGA", prob: 0.61, delta: -0.01 },
      { code: "EGY", prob: 0.58, delta:  0.00 },
      { code: "CIV", prob: 0.49, delta: +0.01 },
      { code: "GHA", prob: 0.42, delta: -0.02 },
    ],
  },
  {
    confederation: "OFC",
    slots: 1,
    teams: [
      { code: "NZL", prob: 0.61, delta: +0.02 },
    ],
  },
];

export type Fixture = {
  id: string;
  round: string;
  home: { code: string; name: string };
  away: { code: string; name: string };
  pHome: number;
  pDraw: number;
  pAway: number;
  confidence: number;
  startsIn: string;
};

export const WC_MATCHES: Fixture[] = [
  {
    id: "m1",
    round: "QF · 18 DEC · 20:00 UTC",
    home: { code: "FRA", name: "France" },
    away: { code: "ARG", name: "Argentina" },
    pHome: 0.51,
    pDraw: 0.24,
    pAway: 0.25,
    confidence: 0.91,
    startsIn: "2h 14m",
  },
  {
    id: "m2",
    round: "QF · 19 DEC · 17:00 UTC",
    home: { code: "BRA", name: "Brazil" },
    away: { code: "ENG", name: "England" },
    pHome: 0.46,
    pDraw: 0.27,
    pAway: 0.27,
    confidence: 0.84,
    startsIn: "23h 17m",
  },
  {
    id: "m3",
    round: "QF · 20 DEC · 20:00 UTC",
    home: { code: "ESP", name: "Spain" },
    away: { code: "GER", name: "Germany" },
    pHome: 0.42,
    pDraw: 0.28,
    pAway: 0.30,
    confidence: 0.79,
    startsIn: "1d 02h",
  },
];
