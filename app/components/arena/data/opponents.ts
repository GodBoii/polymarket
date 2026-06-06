export type Opponent = {
  id: string;
  name: string;
  codename: string;
  region: string;
  rank: number;
  accuracy: number;
  delta24h: number;
  predictions: number;
  modelVersion: string;
  status: "rising" | "stable" | "falling" | "eliminated";
};

export const OPPONENTS: Opponent[] = [
  {
    id: "tide",
    name: "TIDE",
    codename: "TIDE-α",
    region: "Reykjavík",
    rank: 1,
    accuracy: 76.1,
    delta24h: -0.3,
    predictions: 14_902,
    modelVersion: "v4.2.1",
    status: "stable",
  },
  {
    id: "keel",
    name: "KEEL",
    codename: "KEEL-04",
    region: "Singapore",
    rank: 2,
    accuracy: 75.4,
    delta24h: +0.2,
    predictions: 13_188,
    modelVersion: "v3.7.0",
    status: "rising",
  },
  {
    id: "parallax",
    name: "PARALLAX",
    codename: "PRLX-02",
    region: "São Paulo",
    rank: 4,
    accuracy: 73.9,
    delta24h: -1.1,
    predictions: 12_044,
    modelVersion: "v2.9.3",
    status: "falling",
  },
  {
    id: "ledger",
    name: "LEDGER",
    codename: "LDGR-01",
    region: "London",
    rank: 5,
    accuracy: 72.6,
    delta24h: -0.4,
    predictions: 11_812,
    modelVersion: "v3.0.1",
    status: "eliminated",
  },
];
