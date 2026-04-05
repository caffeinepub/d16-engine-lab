// D16 Hybrid Branch — Seeded Deterministic Mock Data
// Phase H1 + H2: Canonical Asset Mapping + Per-Market State Generation
// IMPORTANT: NO Math.random() anywhere in this file. LCG seeded generator only.

import type {
  CanonicalAssetMarkets,
  CanonicalAssetState,
  MarketDirection,
  MarketExecutionPermission,
  MarketMaturity,
  MarketTrustClass,
  PerMarketState,
} from "./hybridTypes";

// ─── LCG: Linear Congruential Generator ─────────────────────────────────────
// Same seed always produces the same sequence. NO uncontrolled randomness.

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ─── Phase H1: Canonical Asset Mapping Layer ────────────────────────────────

const ASSET_DEFINITIONS = [
  {
    asset: "BTC",
    binanceSpot: "BTCUSDT",
    coinbase: "BTC-USD",
    binanceFutures: "BTCUSDT",
  },
  {
    asset: "ETH",
    binanceSpot: "ETHUSDT",
    coinbase: "ETH-USD",
    binanceFutures: "ETHUSDT",
  },
  {
    asset: "SOL",
    binanceSpot: "SOLUSDT",
    coinbase: "SOL-USD",
    binanceFutures: "SOLUSDT",
  },
  {
    asset: "XRP",
    binanceSpot: "XRPUSDT",
    coinbase: "XRP-USD",
    binanceFutures: "XRPUSDT",
  },
  {
    asset: "DOGE",
    binanceSpot: "DOGEUSDT",
    coinbase: "DOGE-USD",
    binanceFutures: "DOGEUSDT",
  },
  {
    asset: "ADA",
    binanceSpot: "ADAUSDT",
    coinbase: "ADA-USD",
    binanceFutures: "ADAUSDT",
  },
  {
    asset: "LINK",
    binanceSpot: "LINKUSDT",
    coinbase: "LINK-USD",
    binanceFutures: "LINKUSDT",
  },
  {
    asset: "AVAX",
    binanceSpot: "AVAXUSDT",
    coinbase: "AVAX-USD",
    binanceFutures: "AVAXUSDT",
  },
] as const;

export const CANONICAL_ASSET_MAPPINGS: CanonicalAssetMarkets[] =
  ASSET_DEFINITIONS.map((def) => ({
    asset: def.asset,
    binanceSpotSymbol: def.binanceSpot,
    coinbaseSpotProduct: def.coinbase,
    binanceFuturesSymbol: def.binanceFutures,
    availability: {
      binanceSpot: true,
      coinbaseSpot: true,
      binanceFutures: true,
    },
  }));

// ─── Phase H2: Per-Market State Generation ──────────────────────────────────

// Asset profile definitions — these are the architecturally meaningful distinctions.
// Numeric scores are generated within the profile's valid range using the seeded LCG.

type AssetProfile = {
  seed: number;
  asset: string;
  binanceSpot: MarketStateProfile;
  coinbaseSpot: MarketStateProfile;
  binanceFutures: MarketStateProfile;
};

type MarketStateProfile = {
  direction: MarketDirection;
  maturity: MarketMaturity;
  trustClass: MarketTrustClass;
  executionPermission: MarketExecutionPermission;
  structuralRange: [number, number];
  activationRange: [number, number];
  entryReadinessRange: [number, number];
  runtimeTrustRange: [number, number];
  mainBlockerTemplate: string | null;
};

const ASSET_PROFILES: AssetProfile[] = [
  {
    // BTC (seed 1001): Futures leads spot — futures ACTIVE, spot FORMING
    seed: 1001,
    asset: "BTC",
    binanceFutures: {
      direction: "LONG",
      maturity: "ACTIVE",
      trustClass: "HIGH_TRUST",
      executionPermission: "PROJECTED_ONLY",
      structuralRange: [68, 78],
      activationRange: [70, 82],
      entryReadinessRange: [55, 68],
      runtimeTrustRange: [82, 92],
      mainBlockerTemplate: "Spot confirmation insufficient for exact entry",
    },
    binanceSpot: {
      direction: "LONG",
      maturity: "FORMING",
      trustClass: "GOOD_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [45, 58],
      activationRange: [38, 52],
      entryReadinessRange: [28, 42],
      runtimeTrustRange: [62, 74],
      mainBlockerTemplate: "Structure forming, awaiting futures confirmation",
    },
    coinbaseSpot: {
      direction: "LONG",
      maturity: "BREWING",
      trustClass: "GOOD_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [35, 48],
      activationRange: [28, 42],
      entryReadinessRange: [18, 32],
      runtimeTrustRange: [60, 72],
      mainBlockerTemplate: "Early stage development, no execution plan",
    },
  },
  {
    // ETH (seed 1002): Full three-market alignment — all LONG/READY/HIGH_TRUST/EXACT_PLAN
    seed: 1002,
    asset: "ETH",
    binanceFutures: {
      direction: "LONG",
      maturity: "READY",
      trustClass: "HIGH_TRUST",
      executionPermission: "EXACT_PLAN",
      structuralRange: [82, 92],
      activationRange: [85, 93],
      entryReadinessRange: [80, 90],
      runtimeTrustRange: [88, 95],
      mainBlockerTemplate: null,
    },
    binanceSpot: {
      direction: "LONG",
      maturity: "READY",
      trustClass: "HIGH_TRUST",
      executionPermission: "EXACT_PLAN",
      structuralRange: [80, 90],
      activationRange: [82, 91],
      entryReadinessRange: [78, 88],
      runtimeTrustRange: [85, 93],
      mainBlockerTemplate: null,
    },
    coinbaseSpot: {
      direction: "LONG",
      maturity: "READY",
      trustClass: "HIGH_TRUST",
      executionPermission: "EXACT_PLAN",
      structuralRange: [79, 89],
      activationRange: [81, 90],
      entryReadinessRange: [76, 86],
      runtimeTrustRange: [84, 92],
      mainBlockerTemplate: null,
    },
  },
  {
    // SOL (seed 1003): Direction conflict — futures SHORT, spot LONG, coinbase NEUTRAL
    seed: 1003,
    asset: "SOL",
    binanceFutures: {
      direction: "SHORT",
      maturity: "ACTIVE",
      trustClass: "GOOD_TRUST",
      executionPermission: "PROJECTED_ONLY",
      structuralRange: [55, 68],
      activationRange: [58, 70],
      entryReadinessRange: [40, 55],
      runtimeTrustRange: [62, 75],
      mainBlockerTemplate:
        "Direction conflict with spot markets — entry blocked",
    },
    binanceSpot: {
      direction: "LONG",
      maturity: "FORMING",
      trustClass: "GOOD_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [42, 55],
      activationRange: [35, 48],
      entryReadinessRange: [25, 38],
      runtimeTrustRange: [58, 70],
      mainBlockerTemplate: "Opposite direction to futures — no plan available",
    },
    coinbaseSpot: {
      direction: "NEUTRAL",
      maturity: "BREWING",
      trustClass: "REDUCED_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [28, 40],
      activationRange: [22, 35],
      entryReadinessRange: [12, 25],
      runtimeTrustRange: [38, 52],
      mainBlockerTemplate: "Neutral, reduced trust — insufficient conviction",
    },
  },
  {
    // XRP (seed 1004): Spot leads futures — spot ACTIVE, futures FORMING
    seed: 1004,
    asset: "XRP",
    binanceFutures: {
      direction: "LONG",
      maturity: "FORMING",
      trustClass: "GOOD_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [44, 56],
      activationRange: [38, 52],
      entryReadinessRange: [28, 42],
      runtimeTrustRange: [60, 72],
      mainBlockerTemplate: "Lagging behind spot — awaiting futures activation",
    },
    binanceSpot: {
      direction: "LONG",
      maturity: "ACTIVE",
      trustClass: "GOOD_TRUST",
      executionPermission: "PROVISIONAL_PLAN",
      structuralRange: [62, 74],
      activationRange: [65, 76],
      entryReadinessRange: [55, 68],
      runtimeTrustRange: [68, 80],
      mainBlockerTemplate: null,
    },
    coinbaseSpot: {
      direction: "LONG",
      maturity: "ARMED",
      trustClass: "HIGH_TRUST",
      executionPermission: "PROVISIONAL_PLAN",
      structuralRange: [68, 80],
      activationRange: [70, 82],
      entryReadinessRange: [62, 75],
      runtimeTrustRange: [75, 86],
      mainBlockerTemplate: null,
    },
  },
  {
    // DOGE (seed 1005): Futures overextended — futures READY, spots EARLY with reduced trust
    seed: 1005,
    asset: "DOGE",
    binanceFutures: {
      direction: "LONG",
      maturity: "READY",
      trustClass: "GOOD_TRUST",
      executionPermission: "PROVISIONAL_PLAN",
      structuralRange: [62, 74],
      activationRange: [65, 76],
      entryReadinessRange: [58, 70],
      runtimeTrustRange: [65, 76],
      mainBlockerTemplate:
        "Spot markets not yet confirming — futures overextended",
    },
    binanceSpot: {
      direction: "LONG",
      maturity: "EARLY",
      trustClass: "REDUCED_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [18, 30],
      activationRange: [12, 25],
      entryReadinessRange: [8, 20],
      runtimeTrustRange: [32, 44],
      mainBlockerTemplate: "Very early stage, reduced trust — no plan",
    },
    coinbaseSpot: {
      direction: "NEUTRAL",
      maturity: "EARLY",
      trustClass: "REDUCED_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [15, 28],
      activationRange: [10, 22],
      entryReadinessRange: [5, 18],
      runtimeTrustRange: [28, 40],
      mainBlockerTemplate:
        "Neutral direction, very early — insufficient structure",
    },
  },
  {
    // ADA (seed 1006): Trust conflict — futures valid, spot INVALID_RUNTIME, coinbase LOW_TRUST
    seed: 1006,
    asset: "ADA",
    binanceFutures: {
      direction: "LONG",
      maturity: "ACTIVE",
      trustClass: "HIGH_TRUST",
      executionPermission: "PROJECTED_ONLY",
      structuralRange: [65, 76],
      activationRange: [68, 80],
      entryReadinessRange: [52, 65],
      runtimeTrustRange: [82, 92],
      mainBlockerTemplate: "Spot trust conflict prevents exact entry",
    },
    binanceSpot: {
      direction: "LONG",
      maturity: "FORMING",
      trustClass: "INVALID_RUNTIME",
      executionPermission: "NO_PLAN",
      structuralRange: [30, 44],
      activationRange: [22, 36],
      entryReadinessRange: [12, 26],
      runtimeTrustRange: [8, 18],
      mainBlockerTemplate: "INVALID_RUNTIME: spot data feed unreliable",
    },
    coinbaseSpot: {
      direction: "LONG",
      maturity: "BREWING",
      trustClass: "LOW_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [22, 35],
      activationRange: [15, 28],
      entryReadinessRange: [8, 20],
      runtimeTrustRange: [18, 30],
      mainBlockerTemplate: "Low trust — runtime quality insufficient",
    },
  },
  {
    // LINK (seed 1007): Coinbase leads Binance spot — coinbase ACTIVE, binanceSpot BREWING, futures FORMING
    seed: 1007,
    asset: "LINK",
    binanceFutures: {
      direction: "LONG",
      maturity: "FORMING",
      trustClass: "GOOD_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [42, 55],
      activationRange: [36, 50],
      entryReadinessRange: [26, 40],
      runtimeTrustRange: [60, 72],
      mainBlockerTemplate: "Futures lagging — spot markets leading",
    },
    binanceSpot: {
      direction: "LONG",
      maturity: "BREWING",
      trustClass: "GOOD_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [32, 45],
      activationRange: [26, 40],
      entryReadinessRange: [16, 30],
      runtimeTrustRange: [58, 70],
      mainBlockerTemplate: "Still brewing — Coinbase leading move",
    },
    coinbaseSpot: {
      direction: "LONG",
      maturity: "ACTIVE",
      trustClass: "GOOD_TRUST",
      executionPermission: "PROVISIONAL_PLAN",
      structuralRange: [60, 72],
      activationRange: [62, 74],
      entryReadinessRange: [52, 65],
      runtimeTrustRange: [66, 78],
      mainBlockerTemplate: null,
    },
  },
  {
    // AVAX (seed 1008): Watch-only, maturity conflict — futures ARMED, binanceSpot EARLY, coinbase SHORT
    seed: 1008,
    asset: "AVAX",
    binanceFutures: {
      direction: "LONG",
      maturity: "ARMED",
      trustClass: "GOOD_TRUST",
      executionPermission: "PROJECTED_ONLY",
      structuralRange: [58, 70],
      activationRange: [60, 72],
      entryReadinessRange: [48, 62],
      runtimeTrustRange: [62, 74],
      mainBlockerTemplate: "Maturity conflict — spot not aligned",
    },
    binanceSpot: {
      direction: "LONG",
      maturity: "EARLY",
      trustClass: "REDUCED_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [15, 28],
      activationRange: [10, 22],
      entryReadinessRange: [5, 18],
      runtimeTrustRange: [30, 42],
      mainBlockerTemplate: "Early stage, reduced trust — no structure yet",
    },
    coinbaseSpot: {
      direction: "SHORT",
      maturity: "BREWING",
      trustClass: "REDUCED_TRUST",
      executionPermission: "NO_PLAN",
      structuralRange: [25, 38],
      activationRange: [20, 32],
      entryReadinessRange: [10, 22],
      runtimeTrustRange: [35, 48],
      mainBlockerTemplate: "Direction conflict — SHORT while futures LONG",
    },
  },
];

// ─── Per-Market State Generator ──────────────────────────────────────────────

function randInRange(rand: () => number, min: number, max: number): number {
  return Math.round(min + rand() * (max - min));
}

function buildPerMarketState(
  profile: MarketStateProfile,
  rand: () => number,
  now: number,
): PerMarketState {
  return {
    direction: profile.direction,
    maturity: profile.maturity,
    trustClass: profile.trustClass,
    executionPermission: profile.executionPermission,
    structuralScore: randInRange(
      rand,
      profile.structuralRange[0],
      profile.structuralRange[1],
    ),
    activationScore: randInRange(
      rand,
      profile.activationRange[0],
      profile.activationRange[1],
    ),
    entryReadiness: randInRange(
      rand,
      profile.entryReadinessRange[0],
      profile.entryReadinessRange[1],
    ),
    runtimeTrust: randInRange(
      rand,
      profile.runtimeTrustRange[0],
      profile.runtimeTrustRange[1],
    ),
    mainBlocker: profile.mainBlockerTemplate,
    updatedAt: now,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function generateHybridAssetStates(_seed = 42): CanonicalAssetState[] {
  const now = 1712275200000; // Fixed timestamp for determinism: 2024-04-05T00:00:00Z

  return ASSET_PROFILES.map((profile) => {
    // Each asset uses its own seed — different seeds produce different numeric scores
    const rand = lcg(profile.seed);

    return {
      asset: profile.asset,
      binanceFutures: buildPerMarketState(profile.binanceFutures, rand, now),
      binanceSpot: buildPerMarketState(profile.binanceSpot, rand, now),
      coinbaseSpot: buildPerMarketState(profile.coinbaseSpot, rand, now),
    };
  });
}

// Pre-generated with default seed — stable, deterministic, never changes on reload.
export const HYBRID_ASSET_STATES: CanonicalAssetState[] =
  generateHybridAssetStates(42);
