export type LeaderboardRow = {
  rank: number;
  name: string;
  codename: string;
  region: string;
  accuracy: number;
  delta24h: number;
  forecasts: number;
  score: number;
  spark: number[];
  isUs?: boolean;
};

export const LEADERBOARD: LeaderboardRow[] = [
  {
    rank: 1,
    name: "TIDE",
    codename: "TIDE-α",
    region: "Reykjavík",
    accuracy: 76.1,
    delta24h: -0.3,
    forecasts: 14_902,
    score: 941,
    spark: [62, 64, 68, 71, 73, 75, 78, 76, 75, 76, 76.1],
  },
  {
    rank: 2,
    name: "KEEL",
    codename: "KEEL-04",
    region: "Singapore",
    accuracy: 75.4,
    delta24h: +0.2,
    forecasts: 13_188,
    score: 922,
    spark: [70, 71, 72, 73, 74, 74, 75, 75, 75.4, 75.4],
  },
  {
    rank: 3,
    name: "POLYCOGNITIVE",
    codename: "POLY-09",
    region: "Menlo Park",
    accuracy: 74.8,
    delta24h: +0.5,
    forecasts: 12_481,
    score: 911,
    spark: [64, 66, 68, 70, 71, 72, 73, 74, 74.5, 74.8],
    isUs: true,
  },
  {
    rank: 4,
    name: "PARALLAX",
    codename: "PRLX-02",
    region: "São Paulo",
    accuracy: 73.9,
    delta24h: -1.1,
    forecasts: 12_044,
    score: 884,
    spark: [78, 77, 76, 76, 75, 75, 74.5, 74, 73.9, 73.9],
  },
  {
    rank: 5,
    name: "LEDGER",
    codename: "LDGR-01",
    region: "London",
    accuracy: 72.6,
    delta24h: -0.4,
    forecasts: 11_812,
    score: 861,
    spark: [75, 75, 74.5, 74, 73.5, 73, 73, 72.8, 72.6, 72.6],
  },
];
