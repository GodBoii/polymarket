// Edges between arena agents — used in the ArenaGraph three.js scene
export type AgentEdge = {
  from: string;
  to: string;
  intensity: number; // 0..1
};

export const ARENA_EDGES: AgentEdge[] = [
  { from: "poly",      to: "tide",      intensity: 0.92 },
  { from: "poly",      to: "keel",      intensity: 0.78 },
  { from: "poly",      to: "parallax",  intensity: 0.61 },
  { from: "poly",      to: "ledger",    intensity: 0.44 },
  { from: "tide",      to: "keel",      intensity: 0.71 },
  { from: "tide",      to: "parallax",  intensity: 0.58 },
  { from: "tide",      to: "ledger",    intensity: 0.40 },
  { from: "keel",      to: "parallax",  intensity: 0.66 },
  { from: "keel",      to: "ledger",    intensity: 0.48 },
  { from: "parallax",  to: "ledger",    intensity: 0.52 },
  { from: "poly",      to: "tide",      intensity: 0.85 },
  { from: "poly",      to: "keel",      intensity: 0.70 },
];
