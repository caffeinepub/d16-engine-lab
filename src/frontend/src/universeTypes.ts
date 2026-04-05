// D16 Hybrid v0.8 — Universe Type System
// Layer: Full Universe Discovery, Eligibility, Tier, Hydration, Ranking
// These types are canonical. Do not flatten or reuse for hybrid layer state.

import type {
  EntryClass,
  HybridCorrelationState,
  HybridPermission,
  PerMarketState,
} from "./hybridTypes";
import type { EntryEngineOutput } from "./hybridTypes";

// ─── Universe Asset ────────────────────────────────────────────────────────────
// Canonical identity for a discovered asset across all exchange sources.

export type UniverseAsset = {
  asset: string; // canonical id: BTC, ETH, SOL, etc.

  binanceSpotSymbol: string | null;
  binanceFuturesSymbol: string | null;
  coinbaseSpotProduct: string | null;

  availability: {
    binanceSpot: boolean;
    binanceFutures: boolean;
    coinbaseSpot: boolean;
  };

  discovery: {
    discoveredAt: number;
    active: boolean;
    reasonExcluded: string | null;
  };

  // 24h volume by market (USD-equivalent, used for liquidity scoring)
  volumeUsd: {
    binanceSpot: number | null;
    binanceFutures: number | null;
    coinbaseSpot: number | null;
  };
};

// ─── Eligibility ───────────────────────────────────────────────────────────────

export type UniverseEligibility =
  | "ELIGIBLE"
  | "LIMITED_ELIGIBILITY"
  | "EXCLUDED";

export type UniverseEligibilityRecord = {
  asset: string;
  eligibility: UniverseEligibility;

  reasonsIncluded: string[];
  reasonsLimited: string[];
  reasonsExcluded: string[];

  liquidityScore: number; // 0–100
  coverageScore: number; // 0–100
  runtimeQualityScore: number; // 0–100
  mappingIntegrityScore: number; // 0–100

  overallEligibilityScore: number; // 0–100
};

// ─── Tier ─────────────────────────────────────────────────────────────────────

export type UniverseTier = "TIER_1" | "TIER_2" | "TIER_3" | "EXCLUDED";

export type UniverseTierAssignment = {
  asset: string;
  tier: UniverseTier;
  assignedAt: number;
  reasons: string[];
  promotionEligible: boolean;
  demotionWarning: boolean;
};

// ─── Hydration State ───────────────────────────────────────────────────────────

export type UniverseAssetHydration = {
  asset: string;
  tier: UniverseTier;

  binanceSpotState: PerMarketState | null;
  binanceFuturesState: PerMarketState | null;
  coinbaseSpotState: PerMarketState | null;

  hybridState: HybridCorrelationState | null;
  entryState: EntryEngineOutput | null;

  hydratedMarkets: number; // 0–3
  lastHydratedAt: number | null;
  isStale: boolean;
  staleSince: number | null;
};

// ─── Runtime Status ────────────────────────────────────────────────────────────

export type UniverseRuntimeStatus = {
  discoveredAssets: number;
  eligibleAssets: number;

  tierCounts: {
    tier1: number;
    tier2: number;
    tier3: number;
    excluded: number;
  };

  activelyHydrated: number;
  recomputeQueueDepth: number;
  skippedDueToBudget: number;

  lastDiscoveryRefreshAt: number | null;
  lastRankingRefreshAt: number | null;

  discoveryPhase:
    | "IDLE"
    | "FETCHING"
    | "MAPPING"
    | "FILTERING"
    | "TIERING"
    | "COMPLETE"
    | "ERROR";
  discoveryError: string | null;

  // Cadence tracking
  tier1RecomputeIntervalMs: number;
  tier2PollIntervalMs: number;
  tier3PollIntervalMs: number;
  discoveryRefreshIntervalMs: number;
};

// ─── Top Entry Category ────────────────────────────────────────────────────────

export type TopEntryCategory =
  | "TOP_EXACT"
  | "TOP_PROVISIONAL"
  | "TOP_WATCH"
  | "TOP_FUTURES_LEADS_SPOT"
  | "TOP_SPOT_CONFIRMED"
  | "TOP_BREAKOUT"
  | "TOP_RECLAIM"
  | "TOP_PULLBACK"
  | "TOP_CONTINUATION"
  | "TOP_REVERSAL";

// ─── Ranked Universe Record ────────────────────────────────────────────────────
// Final output: one record per eligible, hydrated asset in the ranked board.

export type UniverseTopEntryRecord = {
  asset: string;

  tier: UniverseTier;
  eligibility: UniverseEligibility;

  side: "LONG" | "SHORT" | "NONE";
  permissionLevel:
    | "BLOCKED"
    | "WATCH_ONLY"
    | "PROJECTED_ONLY"
    | "PROVISIONAL"
    | "EXACT";
  entryClass: EntryClass;

  hybridPermission: HybridPermission;
  crossMarketConfirmation: number; // 0–100
  runtimeTrust: number; // 0–100 (average of available markets)
  leadMarket: string;
  divergenceType: string;
  mainBlocker: string | null;
  nextUnlockCondition: string | null;

  confirmationStrength: number; // from EntryEngineOutput
  invalidationClarity: number;
  rewardFeasibility: number;

  strongestConfirmingMarket: string;
  laggingOrBlockingMarket: string;

  overallRankScore: number; // 0–100 weighted composite
  categoryRanks: Partial<Record<TopEntryCategory, number>>;
  activeCategories: TopEntryCategory[];

  whyRanked: string[]; // human-readable rank justification chips

  // v0.7 evidence context (read-only, not used for ranking until authorized)
  outcomeEvidence: {
    hasHistory: boolean;
    patternPrecision: number | null; // null if no data
    note: string | null;
  };

  // Timing
  lastRecomputedAt: number;
  isStale: boolean;
};

// ─── Scheduler State (internal) ───────────────────────────────────────────────

export type UniverseMode = "MOCK" | "LIVE";

export type UniverseSchedulerState = {
  mode: UniverseMode;
  assets: Map<string, UniverseAsset>;
  eligibility: Map<string, UniverseEligibilityRecord>;
  tiers: Map<string, UniverseTierAssignment>;
  hydration: Map<string, UniverseAssetHydration>;
  rankedRecords: UniverseTopEntryRecord[];
  runtimeStatus: UniverseRuntimeStatus;
};

// ─── Constants ────────────────────────────────────────────────────────────────

// The 8 canonical "anchor" assets that are always TIER_1
export const CANONICAL_ANCHOR_ASSETS = [
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "DOGE",
  "ADA",
  "LINK",
  "AVAX",
] as const;

// Tier cadences
export const TIER_1_RECOMPUTE_MS = 2_000; // same as runtimeManager
export const TIER_2_POLL_MS = 30_000; // 30s REST polling
export const TIER_3_POLL_MS = 120_000; // 2m REST polling
export const DISCOVERY_REFRESH_MS = 600_000; // 10m universe re-discovery

// Hydration budgets
export const MAX_TIER_1_CONCURRENT = 20;
export const MAX_TIER_2_CONCURRENT = 50;
export const MAX_TIER_3_CONCURRENT = 100;

// Eligibility thresholds
export const MIN_VOLUME_USD_TIER1 = 50_000_000; // $50M 24h volume
export const MIN_VOLUME_USD_TIER2 = 5_000_000; // $5M
export const MIN_VOLUME_USD_TIER3 = 500_000; // $500K
export const MIN_COVERAGE_SCORE_ELIGIBLE = 33; // at least 1 market
export const MIN_COVERAGE_SCORE_FULL = 66; // at least 2 markets
