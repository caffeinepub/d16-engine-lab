// D16 Hybrid v0.7 — Outcome / Entry Precision Validation Layer
// Canonical type definitions for all v0.7 data structures.
// Do NOT import from this file into v0.6 engine layers — v0.7 is above them.

import type {
  EntryEngineOutput,
  HybridCorrelationState,
  PerMarketState,
} from "./hybridTypes";

// Re-export for convenience so consumers only need one import
export type { EntryEngineOutput, HybridCorrelationState, PerMarketState };

// ─── Engine Mode (mirrors liveAdapterTypes) ───────────────────────────────────
export type OutcomeEngineMode = "MOCK" | "LIVE" | "HYBRID_LIVE";

// ─── Outcome Classification ───────────────────────────────────────────────────
export type OutcomeClass =
  | "STRONG_SUCCESS"
  | "PARTIAL_SUCCESS"
  | "NEUTRAL"
  | "EARLY_FALSE_POSITIVE"
  | "FAILED"
  | "INSUFFICIENT_FORWARD_DATA";

// ─── Horizon Result ───────────────────────────────────────────────────────────
export type HorizonResult = {
  returnPct: number | null;
  directionalCorrect: boolean | null;
};

// ─── Snapshot Ledger ─────────────────────────────────────────────────────────
// The canonical record of engine state at a meaningful moment.
// This is the raw truth. It must not be altered after capture.

export type HybridOutcomeSnapshot = {
  snapshotId: string;
  capturedAt: number; // unix ms
  asset: string;

  mode: OutcomeEngineMode;

  perMarket: {
    binanceSpot: PerMarketState | null;
    binanceFutures: PerMarketState | null;
    coinbaseSpot: PerMarketState | null;
  };

  hybrid: HybridCorrelationState;
  entry: EntryEngineOutput;

  // Reference price at snapshot time (from live normalizer or mock)
  referencePrice: number;

  runtime: {
    overallTrust: number; // 0–100
    connectedMarkets: number; // 0–3
    staleMarkets: number;
    hybridReady: boolean;
  };

  tags: {
    leadMarket: string;
    divergenceType: string;
    permissionLevel: string;
    entryClass: string;
    mainBlocker: string | null;
  };

  // What triggered this snapshot (for audit trail)
  captureReason: CaptureReason;
};

export type CaptureReason =
  | "HYBRID_PERMISSION_CHANGE"
  | "ENTRY_PERMISSION_CHANGE"
  | "ENTRY_CLASS_CHANGE"
  | "DIVERGENCE_TYPE_CHANGE"
  | "LEAD_MARKET_CHANGE"
  | "MAIN_BLOCKER_CHANGE"
  | "MATURITY_CHANGE"
  | "INTERVAL_SNAPSHOT"
  | "MANUAL_CAPTURE";

// ─── Candidate Lifecycle ─────────────────────────────────────────────────────
// Groups snapshots for an asset into a candidate episode.

export type LifecycleFinalState =
  | "OPEN"
  | "COMPLETED"
  | "DECAYED"
  | "CANCELLED";

export type CandidateLifecycle = {
  lifecycleId: string;
  asset: string;

  startedAt: number;
  endedAt: number | null;

  firstSnapshotId: string;
  latestSnapshotId: string;

  // Historical accumulation — all unique values seen
  stagesSeen: string[];
  leadMarketsSeen: string[];
  divergenceTypesSeen: string[];
  permissionLevelsSeen: string[];
  entryClassesSeen: string[];

  // Peak reached (highest permission level seen)
  peakPermissionLevel: string;

  snapshotCount: number;

  finalState: LifecycleFinalState;
};

// ─── Forward Outcome Evaluator ────────────────────────────────────────────────
// For each snapshot: what happened at each forward horizon?

export type SnapshotOutcome = {
  snapshotId: string;
  asset: string;
  referencePrice: number;
  referenceDirection: "LONG" | "SHORT" | "NONE";

  after15m: HorizonResult;
  after1h: HorizonResult;
  after4h: HorizonResult;
  after24h: HorizonResult;

  mfePct: number | null; // max favorable excursion %
  maePct: number | null; // max adverse excursion %

  outcomeClass: OutcomeClass;

  // Timestamp when this outcome was computed
  evaluatedAt: number;
};

// Price tick used by outcome evaluator to build forward windows
export type PriceTick = {
  asset: string;
  price: number;
  ts: number; // unix ms
};

// ─── State Transition Record ──────────────────────────────────────────────────
// Links a state change to subsequent outcome windows.

export type StateTransitionRecord = {
  transitionId: string;
  snapshotId: string; // the snapshot where this transition was captured
  asset: string;
  capturedAt: number;

  // What changed
  changedFields: string[];
  previousValues: Record<string, string | null>;
  newValues: Record<string, string | null>;
};

// ─── Precision Metrics ────────────────────────────────────────────────────────
// Aggregated precision analytics across all evaluated snapshots.

export type PrecisionBucket = {
  label: string;
  count: number;
  hitRate: number; // % directionally correct
  avgReturn15m: number | null;
  avgReturn1h: number | null;
  avgReturn4h: number | null;
  avgReturn24h: number | null;
  strongSuccessRate: number;
  failRate: number;
  falsePositiveRate: number;
};

export type BlockerEffectivenessRecord = {
  blocker: string;
  appearances: number;
  // Of blocked entries: how many would have been failures if taken?
  savedLossRate: number; // 0–1
  // Of blocked entries: how many would have succeeded if taken?
  overConservativeRate: number; // 0–1
  avgOutcomeAfterBlock: OutcomeClass | null;
  netValue: "VALUABLE" | "NEUTRAL" | "OVER_CONSERVATIVE";
};

export type PrecisionMetrics = {
  computedAt: number;

  totalSnapshots: number;
  evaluatedSnapshots: number; // has at least one non-null horizon
  totalLifecycles: number;
  openLifecycles: number;

  // Overall directional hit rate across all evaluated snapshots
  overallHitRate15m: number | null;
  overallHitRate1h: number | null;
  overallHitRate4h: number | null;
  overallHitRate24h: number | null;

  // By permission level
  byPermissionLevel: Record<string, PrecisionBucket>;

  // By entry class
  byEntryClass: Record<string, PrecisionBucket>;

  // By divergence type
  byDivergenceType: Record<string, PrecisionBucket>;

  // By lead market
  byLeadMarket: Record<string, PrecisionBucket>;

  // By asset
  byAsset: Record<string, PrecisionBucket>;

  // Blocker effectiveness
  blockerEffectiveness: BlockerEffectivenessRecord[];

  // Outcome class distribution
  outcomeClassDistribution: Record<OutcomeClass, number>;
};

// ─── Full outcome engine state (top-level) ────────────────────────────────────

export type OutcomeEngineState = {
  snapshots: HybridOutcomeSnapshot[];
  outcomes: Record<string, SnapshotOutcome>; // keyed by snapshotId
  lifecycles: CandidateLifecycle[];
  transitions: StateTransitionRecord[];
  metrics: PrecisionMetrics | null;
  lastCaptureAt: number | null;
  lastEvaluationAt: number | null;
};
