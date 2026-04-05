// D16 Hybrid v0.8 — Universe Scheduler
// Central React hook managing full-universe discovery, hydration, and ranking.
//
// Hydration strategy:
// - TIER_1 anchor assets (8 canonical): live normalized states fed directly from
//   runtimeManager via getLiveNormalizedState() on every 2s recompute cycle.
// - TIER_1 expanded assets (beyond the 8): REST batch polling at 10s cadence.
// - TIER_2: REST batch polling at 30s cadence.
// - TIER_3: REST batch polling at 2m cadence.
// - MOCK mode: shows 8 canonical mock assets ranked through the ranking engine.
//
// KEY INVARIANT: The 8 canonical anchor assets (TIER_1) MUST always exist in
// the assets/eligibility/tier maps. Discovery results MERGE with the anchor
// bootstrap — they never replace or destroy it. This ensures:
// 1. Anchors rank immediately from live WebSocket states on first recompute.
// 2. CORS failures or empty discovery results do NOT collapse the board to zero.
// 3. applyAnchorLiveStates() always has valid tier entries for all 8 anchors.

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveEntryEngine } from "./entryEngine";
import { resolveHybridCorrelation } from "./hybridEngine";
import { HYBRID_ASSET_STATES } from "./hybridMockData";
import type { PerMarketState } from "./hybridTypes";
import type { EngineMode } from "./liveAdapterTypes";
import type { LiveMarketId } from "./liveAdapterTypes";
import { normalizeSnapshot } from "./liveNormalizer";
import type { PrecisionMetrics } from "./outcomeTypes";
import { discoverFullUniverse } from "./universeDiscovery";
import { computeAllEligibility } from "./universeEligibility";
import { buildRankedRecord, rankUniverse } from "./universeRanking";
import { assignAllTiers } from "./universeTierAssignment";
import type {
  UniverseAsset,
  UniverseAssetHydration,
  UniverseEligibilityRecord,
  UniverseMode,
  UniverseRuntimeStatus,
  UniverseTierAssignment,
  UniverseTopEntryRecord,
} from "./universeTypes";
import {
  CANONICAL_ANCHOR_ASSETS,
  DISCOVERY_REFRESH_MS,
  MAX_TIER_2_CONCURRENT,
  MAX_TIER_3_CONCURRENT,
  TIER_1_RECOMPUTE_MS,
  TIER_2_POLL_MS,
  TIER_3_POLL_MS,
} from "./universeTypes";

// TIER_1 expanded REST poll cadence (for non-anchor TIER_1 assets)
const TIER_1_EXPANDED_POLL_MS = 10_000;
// Max concurrent expanded TIER_1 REST assets
const MAX_TIER_1_EXPANDED_CONCURRENT = 30;

// ─── Symbol normalization ──────────────────────────────────────────────────────────
/** Safely strips a trailing USDT suffix from a Binance symbol. */
function stripUsdtSuffix(symbol: string): string {
  return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
}

// ─── Types ───────────────────────────────────────────────────────────────────────

export type UniverseSchedulerResult = {
  mode: UniverseMode;
  rankedRecords: UniverseTopEntryRecord[];
  runtimeStatus: UniverseRuntimeStatus;
  assets: Map<string, UniverseAsset>;
  eligibility: Map<string, UniverseEligibilityRecord>;
  tiers: Map<string, UniverseTierAssignment>;
  hydration: Map<string, UniverseAssetHydration>;
  isMockMode: boolean;
  mockModeNotice: string | null;
};

function makeInitialRuntimeStatus(): UniverseRuntimeStatus {
  return {
    discoveredAssets: 0,
    eligibleAssets: 0,
    tierCounts: { tier1: 0, tier2: 0, tier3: 0, excluded: 0 },
    activelyHydrated: 0,
    recomputeQueueDepth: 0,
    skippedDueToBudget: 0,
    lastDiscoveryRefreshAt: null,
    lastRankingRefreshAt: null,
    discoveryPhase: "IDLE",
    discoveryError: null,
    tier1RecomputeIntervalMs: TIER_1_RECOMPUTE_MS,
    tier2PollIntervalMs: TIER_2_POLL_MS,
    tier3PollIntervalMs: TIER_3_POLL_MS,
    discoveryRefreshIntervalMs: DISCOVERY_REFRESH_MS,
  };
}

// ─── Anchor bootstrap helpers ─────────────────────────────────────────────────────
// These produce minimal but valid entries for all 8 anchors.
// Used to seed maps at startup AND to fill gaps after discovery.

const ANCHOR_ASSET_SET = new Set<string>(CANONICAL_ANCHOR_ASSETS);

function buildAnchorBootstrapTiers(): Map<string, UniverseTierAssignment> {
  const now = Date.now();
  const map = new Map<string, UniverseTierAssignment>();
  for (const asset of CANONICAL_ANCHOR_ASSETS) {
    map.set(asset, {
      asset,
      tier: "TIER_1",
      assignedAt: now,
      reasons: ["Canonical anchor asset — bootstrap TIER_1"],
      promotionEligible: false,
      demotionWarning: false,
    });
  }
  return map;
}

function buildAnchorBootstrapEligibility(): Map<
  string,
  UniverseEligibilityRecord
> {
  const map = new Map<string, UniverseEligibilityRecord>();
  for (const asset of CANONICAL_ANCHOR_ASSETS) {
    map.set(asset, {
      asset,
      eligibility: "ELIGIBLE",
      reasonsIncluded: ["Canonical anchor asset"],
      reasonsLimited: [],
      reasonsExcluded: [],
      liquidityScore: 100,
      coverageScore: 100,
      runtimeQualityScore: 100,
      mappingIntegrityScore: 100,
      overallEligibilityScore: 100,
    });
  }
  return map;
}

function buildAnchorBootstrapAssets(): Map<string, UniverseAsset> {
  const now = Date.now();
  const map = new Map<string, UniverseAsset>();
  // Known symbols for the 8 canonical anchors
  const knownSymbols: Record<
    string,
    {
      bs: string;
      bf: string;
      cb: string;
    }
  > = {
    BTC: { bs: "BTCUSDT", bf: "BTCUSDT", cb: "BTC-USD" },
    ETH: { bs: "ETHUSDT", bf: "ETHUSDT", cb: "ETH-USD" },
    SOL: { bs: "SOLUSDT", bf: "SOLUSDT", cb: "SOL-USD" },
    XRP: { bs: "XRPUSDT", bf: "XRPUSDT", cb: "XRP-USD" },
    DOGE: { bs: "DOGEUSDT", bf: "DOGEUSDT", cb: "DOGE-USD" },
    ADA: { bs: "ADAUSDT", bf: "ADAUSDT", cb: "ADA-USD" },
    LINK: { bs: "LINKUSDT", bf: "LINKUSDT", cb: "LINK-USD" },
    AVAX: { bs: "AVAXUSDT", bf: "AVAXUSDT", cb: "AVAX-USD" },
  };
  for (const asset of CANONICAL_ANCHOR_ASSETS) {
    const sym = knownSymbols[asset];
    map.set(asset, {
      asset,
      binanceSpotSymbol: sym?.bs ?? `${asset}USDT`,
      binanceFuturesSymbol: sym?.bf ?? `${asset}USDT`,
      coinbaseSpotProduct: sym?.cb ?? `${asset}-USD`,
      availability: {
        binanceSpot: true,
        binanceFutures: true,
        coinbaseSpot: true,
      },
      discovery: {
        discoveredAt: now,
        active: true,
        reasonExcluded: null,
      },
      volumeUsd: {
        binanceSpot: null,
        binanceFutures: null,
        coinbaseSpot: null,
      },
    });
  }
  return map;
}

/**
 * Merges discovery results with the anchor bootstrap.
 * Anchor entries in assets/eligibility/tiers are NEVER replaced by discovery —
 * they can only be enriched (e.g. volume data added).
 * Non-anchor assets from discovery are merged in normally.
 */
function mergeWithAnchorBootstrap(
  discovered: Map<string, UniverseAsset>,
  eligibilityMap: Map<string, UniverseEligibilityRecord>,
  tierMap: Map<string, UniverseTierAssignment>,
): {
  assets: Map<string, UniverseAsset>;
  eligibility: Map<string, UniverseEligibilityRecord>;
  tiers: Map<string, UniverseTierAssignment>;
} {
  // Start with anchor bootstraps
  const anchorAssets = buildAnchorBootstrapAssets();
  const anchorEligibility = buildAnchorBootstrapEligibility();
  const anchorTiers = buildAnchorBootstrapTiers();

  // Merge: discovered assets enrich/extend the map (anchors are protected)
  const mergedAssets = new Map<string, UniverseAsset>(discovered);
  const mergedEligibility = new Map<string, UniverseEligibilityRecord>(
    eligibilityMap,
  );
  const mergedTiers = new Map<string, UniverseTierAssignment>(tierMap);

  // Always inject anchor bootstrap entries — they cannot be removed by discovery
  for (const [asset, anchorAsset] of anchorAssets) {
    if (!mergedAssets.has(asset)) {
      mergedAssets.set(asset, anchorAsset);
    } else {
      // Enrich existing discovered entry with known symbols if missing
      const existing = mergedAssets.get(asset)!;
      mergedAssets.set(asset, {
        ...existing,
        binanceSpotSymbol:
          existing.binanceSpotSymbol ?? anchorAsset.binanceSpotSymbol,
        binanceFuturesSymbol:
          existing.binanceFuturesSymbol ?? anchorAsset.binanceFuturesSymbol,
        coinbaseSpotProduct:
          existing.coinbaseSpotProduct ?? anchorAsset.coinbaseSpotProduct,
      });
    }
  }
  for (const [asset, anchorElig] of anchorEligibility) {
    if (!mergedEligibility.has(asset)) {
      mergedEligibility.set(asset, anchorElig);
    }
    // If discovery found the anchor but eligibility was somehow EXCLUDED, protect it
    else if (mergedEligibility.get(asset)?.eligibility === "EXCLUDED") {
      mergedEligibility.set(asset, anchorElig);
    }
  }
  for (const [asset, anchorTier] of anchorTiers) {
    if (!mergedTiers.has(asset)) {
      mergedTiers.set(asset, anchorTier);
    }
    // If discovery somehow excluded an anchor, protect it
    else if (mergedTiers.get(asset)?.tier === "EXCLUDED") {
      mergedTiers.set(asset, anchorTier);
    }
  }

  return {
    assets: mergedAssets,
    eligibility: mergedEligibility,
    tiers: mergedTiers,
  };
}

// ─── REST polling helpers ──────────────────────────────────────────────────────────

async function fetchBinanceSpotBatch(
  symbols: string[],
): Promise<Array<{ symbol: string; snapshot: PerMarketState | null }>> {
  if (symbols.length === 0) return [];
  try {
    const symParam = encodeURIComponent(JSON.stringify(symbols));
    const resp = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${symParam}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!resp.ok) return [];
    const data: Array<{
      symbol: string;
      priceChange: string;
      priceChangePercent: string;
      lastPrice: string;
      volume: string;
      quoteVolume: string;
      highPrice: string;
      lowPrice: string;
    }> = await resp.json();

    return data.map((item) => {
      const price = Number.parseFloat(item.lastPrice);
      if (!Number.isFinite(price) || price <= 0)
        return { symbol: item.symbol, snapshot: null };
      const snap = normalizeSnapshot(
        {
          asset: stripUsdtSuffix(item.symbol),
          market: "BINANCE_SPOT",
          symbol: item.symbol,
          price,
          priceChange24h: Number.parseFloat(item.priceChange),
          priceChangePct24h: Number.parseFloat(item.priceChangePercent),
          volume24h: Number.parseFloat(item.quoteVolume),
          high24h: Number.parseFloat(item.highPrice),
          low24h: Number.parseFloat(item.lowPrice),
          openInterest: null,
          fundingRate: null,
          receivedAt: Date.now(),
          sequenceId: Date.now(),
        },
        80,
      );
      return { symbol: item.symbol, snapshot: snap };
    });
  } catch {
    return [];
  }
}

async function fetchBinanceFuturesBatch(
  symbols: string[],
): Promise<Array<{ symbol: string; snapshot: PerMarketState | null }>> {
  if (symbols.length === 0) return [];
  try {
    const symParam = encodeURIComponent(JSON.stringify(symbols));
    const resp = await fetch(
      `https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${symParam}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!resp.ok) return [];
    const data: Array<{
      symbol: string;
      priceChange: string;
      priceChangePercent: string;
      lastPrice: string;
      volume: string;
      quoteVolume: string;
      highPrice: string;
      lowPrice: string;
    }> = await resp.json();

    return data.map((item) => {
      const price = Number.parseFloat(item.lastPrice);
      if (!Number.isFinite(price) || price <= 0)
        return { symbol: item.symbol, snapshot: null };
      const snap = normalizeSnapshot(
        {
          asset: stripUsdtSuffix(item.symbol),
          market: "BINANCE_FUTURES",
          symbol: item.symbol,
          price,
          priceChange24h: Number.parseFloat(item.priceChange),
          priceChangePct24h: Number.parseFloat(item.priceChangePercent),
          volume24h: Number.parseFloat(item.quoteVolume),
          high24h: Number.parseFloat(item.highPrice),
          low24h: Number.parseFloat(item.lowPrice),
          openInterest: null,
          fundingRate: null,
          receivedAt: Date.now(),
          sequenceId: Date.now(),
        },
        75,
      );
      return { symbol: item.symbol, snapshot: snap };
    });
  } catch {
    return [];
  }
}

async function fetchCoinbaseSpotBatch(
  productIds: string[],
): Promise<Array<{ productId: string; snapshot: PerMarketState | null }>> {
  if (productIds.length === 0) return [];
  const results = await Promise.allSettled(
    productIds.slice(0, 30).map(async (productId) => {
      try {
        const resp = await fetch(
          `https://api.exchange.coinbase.com/products/${encodeURIComponent(productId)}/ticker`,
          { signal: AbortSignal.timeout(8_000) },
        );
        if (!resp.ok) return { productId, snapshot: null };
        const data: {
          price?: string;
          volume?: string;
          high?: string;
          low?: string;
        } = await resp.json();
        const price = Number.parseFloat(data.price ?? "0");
        if (!Number.isFinite(price) || price <= 0)
          return { productId, snapshot: null };
        const canonical = productId.split("-")[0] ?? productId;
        const snap = normalizeSnapshot(
          {
            asset: canonical,
            market: "COINBASE_SPOT",
            symbol: productId,
            price,
            priceChange24h: 0,
            priceChangePct24h: 0,
            volume24h: Number.parseFloat(data.volume ?? "0"),
            high24h: Number.parseFloat(data.high ?? String(price)),
            low24h: Number.parseFloat(data.low ?? String(price)),
            openInterest: null,
            fundingRate: null,
            receivedAt: Date.now(),
            sequenceId: Date.now(),
          },
          70,
        );
        return { productId, snapshot: snap };
      } catch {
        return { productId, snapshot: null };
      }
    }),
  );
  return results
    .filter(
      (
        r,
      ): r is PromiseFulfilledResult<{
        productId: string;
        snapshot: PerMarketState | null;
      }> => r.status === "fulfilled",
    )
    .map((r) => r.value);
}

// ─── Mock universe: build from existing 8 canonical mock states ─────────────────────

function buildMockUniverseRecords(): UniverseTopEntryRecord[] {
  return HYBRID_ASSET_STATES.map((assetState) => {
    const hybrid = resolveHybridCorrelation(assetState);
    const entry = resolveEntryEngine(assetState, hybrid);

    const hydration: UniverseAssetHydration = {
      asset: assetState.asset,
      tier: "TIER_1",
      binanceSpotState: assetState.binanceSpot,
      binanceFuturesState: assetState.binanceFutures,
      coinbaseSpotState: assetState.coinbaseSpot,
      hybridState: hybrid,
      entryState: entry,
      hydratedMarkets: [
        assetState.binanceSpot,
        assetState.binanceFutures,
        assetState.coinbaseSpot,
      ].filter(Boolean).length,
      lastHydratedAt: Date.now(),
      isStale: false,
      staleSince: null,
    };

    const tierAssignment: UniverseTierAssignment = {
      asset: assetState.asset,
      tier: "TIER_1",
      assignedAt: Date.now(),
      reasons: ["Canonical anchor asset"],
      promotionEligible: false,
      demotionWarning: false,
    };

    const eligRecord: UniverseEligibilityRecord = {
      asset: assetState.asset,
      eligibility: "ELIGIBLE",
      reasonsIncluded: ["Canonical anchor asset"],
      reasonsLimited: [],
      reasonsExcluded: [],
      liquidityScore: 100,
      coverageScore: 100,
      runtimeQualityScore: 100,
      mappingIntegrityScore: 100,
      overallEligibilityScore: 100,
    };

    const record = buildRankedRecord(hydration, tierAssignment, eligRecord);
    return record!;
  }).sort((a, b) => b.overallRankScore - a.overallRankScore);
}

// ─── Main Hook ──────────────────────────────────────────────────────────────────────

export function useUniverseScheduler(
  engineMode: EngineMode,
  getLiveNormalizedState?: (
    market: LiveMarketId,
    asset: string,
  ) => PerMarketState | null,
  _precisionMetrics?: PrecisionMetrics | null,
): UniverseSchedulerResult {
  const isMockMode = engineMode === "MOCK";

  // ─ Universe state ─
  // Assets, eligibility, and tiers are bootstrapped with the 8 canonical anchors.
  // Discovery MERGES into these maps — it never replaces/destroys anchor entries.
  const [assets, setAssets] = useState<Map<string, UniverseAsset>>(() =>
    buildAnchorBootstrapAssets(),
  );
  const [eligibility, setEligibility] = useState<
    Map<string, UniverseEligibilityRecord>
  >(() => buildAnchorBootstrapEligibility());
  const [tiers, setTiers] = useState<Map<string, UniverseTierAssignment>>(() =>
    buildAnchorBootstrapTiers(),
  );
  const [hydration, setHydration] = useState<
    Map<string, UniverseAssetHydration>
  >(new Map());
  const [rankedRecords, setRankedRecords] = useState<UniverseTopEntryRecord[]>(
    () => buildMockUniverseRecords(),
  );
  const [runtimeStatus, setRuntimeStatus] = useState<UniverseRuntimeStatus>(
    makeInitialRuntimeStatus,
  );

  // Refs for mutable state used in intervals
  const tiersRef = useRef<Map<string, UniverseTierAssignment>>(
    buildAnchorBootstrapTiers(),
  );
  const eligibilityRef = useRef<Map<string, UniverseEligibilityRecord>>(
    buildAnchorBootstrapEligibility(),
  );
  const hydrationRef = useRef<Map<string, UniverseAssetHydration>>(new Map());
  const assetsRef = useRef<Map<string, UniverseAsset>>(
    buildAnchorBootstrapAssets(),
  );
  const _recomputeQueueRef = useRef<string[]>([]);
  const _skippedRef = useRef(0);

  // Stable refs for polling functions to avoid circular deps in runDiscovery
  const pollTier1ExpandedRef = useRef<() => Promise<void>>(() =>
    Promise.resolve(),
  );
  const pollTier2Ref = useRef<() => Promise<void>>(() => Promise.resolve());

  // Stable ref for the live normalized state getter
  const getLiveNormalizedStateRef = useRef(getLiveNormalizedState);
  useEffect(() => {
    getLiveNormalizedStateRef.current = getLiveNormalizedState;
  }, [getLiveNormalizedState]);

  // Sync refs to state
  useEffect(() => {
    tiersRef.current = tiers;
  }, [tiers]);
  useEffect(() => {
    eligibilityRef.current = eligibility;
  }, [eligibility]);
  useEffect(() => {
    hydrationRef.current = hydration;
  }, [hydration]);
  useEffect(() => {
    assetsRef.current = assets;
  }, [assets]);

  // ─ Apply live normalized states to hydration map for anchor assets ─
  // INVARIANT: This MUST work even if tiersRef.current is sparse.
  // If an anchor asset is not in the tier map (e.g. from a previous discovery
  // failure), we synthesize a TIER_1 entry so hydration proceeds.
  const applyAnchorLiveStates = useCallback(() => {
    const getter = getLiveNormalizedStateRef.current;
    if (!getter) return;

    const now = Date.now();
    let changed = false;

    for (const asset of CANONICAL_ANCHOR_ASSETS) {
      const bsState = getter("BINANCE_SPOT", asset);
      const bfState = getter("BINANCE_FUTURES", asset);
      const cbState = getter("COINBASE_SPOT", asset);

      // Only update if we have at least one market hydrated
      if (!bsState && !bfState && !cbState) continue;

      // Get tier — synthesize if missing (anchor bootstrap invariant)
      let tier = tiersRef.current.get(asset);
      if (!tier) {
        tier = {
          asset,
          tier: "TIER_1",
          assignedAt: now,
          reasons: ["Canonical anchor — synthesized tier"],
          promotionEligible: false,
          demotionWarning: false,
        };
        // Re-inject into the tier maps so future reads find it
        tiersRef.current.set(asset, tier);
        setTiers((prev) => {
          const next = new Map(prev);
          next.set(asset, tier!);
          return next;
        });
      }

      // Also inject eligibility if missing
      if (!eligibilityRef.current.has(asset)) {
        const syntheticElig: UniverseEligibilityRecord = {
          asset,
          eligibility: "ELIGIBLE",
          reasonsIncluded: ["Canonical anchor — synthesized eligibility"],
          reasonsLimited: [],
          reasonsExcluded: [],
          liquidityScore: 100,
          coverageScore: 100,
          runtimeQualityScore: 100,
          mappingIntegrityScore: 100,
          overallEligibilityScore: 100,
        };
        eligibilityRef.current.set(asset, syntheticElig);
        setEligibility((prev) => {
          const next = new Map(prev);
          next.set(asset, syntheticElig);
          return next;
        });
      }

      const existing = hydrationRef.current.get(asset) ?? {
        asset,
        tier: "TIER_1" as const,
        binanceSpotState: null,
        binanceFuturesState: null,
        coinbaseSpotState: null,
        hybridState: null,
        entryState: null,
        hydratedMarkets: 0,
        lastHydratedAt: null,
        isStale: false,
        staleSince: null,
      };

      const updated: UniverseAssetHydration = {
        ...existing,
        tier: tier.tier,
        binanceSpotState: bsState ?? existing.binanceSpotState,
        binanceFuturesState: bfState ?? existing.binanceFuturesState,
        coinbaseSpotState: cbState ?? existing.coinbaseSpotState,
        lastHydratedAt: now,
        isStale: false,
        staleSince: null,
      };
      updated.hydratedMarkets = [
        updated.binanceSpotState,
        updated.binanceFuturesState,
        updated.coinbaseSpotState,
      ].filter(Boolean).length;

      hydrationRef.current.set(asset, updated);
      changed = true;
    }

    if (changed) {
      setHydration(new Map(hydrationRef.current));
    }
  }, []);

  // ─ Recompute rankings ─
  const recomputeRankings = useCallback(() => {
    if (isMockMode) {
      setRankedRecords(buildMockUniverseRecords());
      return;
    }

    // Pull fresh anchor live states before ranking
    applyAnchorLiveStates();

    const records = rankUniverse(
      hydrationRef.current,
      tiersRef.current,
      eligibilityRef.current,
    );
    setRankedRecords(records);
    setRuntimeStatus((prev) => ({
      ...prev,
      lastRankingRefreshAt: Date.now(),
      activelyHydrated: hydrationRef.current.size,
    }));
  }, [isMockMode, applyAnchorLiveStates]);

  // ─ Update hydration for a single asset/market ─
  const updateHydration = useCallback(
    (
      asset: string,
      market: "BINANCE_SPOT" | "BINANCE_FUTURES" | "COINBASE_SPOT",
      state: PerMarketState,
    ) => {
      const existing = hydrationRef.current.get(asset) ?? {
        asset,
        tier: (tiersRef.current.get(asset)?.tier ??
          "TIER_3") as UniverseAssetHydration["tier"],
        binanceSpotState: null,
        binanceFuturesState: null,
        coinbaseSpotState: null,
        hybridState: null,
        entryState: null,
        hydratedMarkets: 0,
        lastHydratedAt: null,
        isStale: false,
        staleSince: null,
      };
      const updated: UniverseAssetHydration = { ...existing };
      if (market === "BINANCE_SPOT") updated.binanceSpotState = state;
      if (market === "BINANCE_FUTURES") updated.binanceFuturesState = state;
      if (market === "COINBASE_SPOT") updated.coinbaseSpotState = state;
      updated.hydratedMarkets = [
        updated.binanceSpotState,
        updated.binanceFuturesState,
        updated.coinbaseSpotState,
      ].filter(Boolean).length;
      updated.lastHydratedAt = Date.now();
      updated.isStale = false;
      updated.staleSince = null;
      hydrationRef.current.set(asset, updated);
      setHydration((prev) => {
        const next = new Map(prev);
        next.set(asset, updated);
        return next;
      });
      setRuntimeStatus((prev) => ({
        ...prev,
        activelyHydrated: hydrationRef.current.size,
      }));
    },
    [],
  );

  // ─ Universe discovery phase ─
  const runDiscovery = useCallback(async () => {
    if (isMockMode) return;

    setRuntimeStatus((prev) => ({
      ...prev,
      discoveryPhase: "FETCHING",
      discoveryError: null,
    }));

    try {
      const discovered = await discoverFullUniverse();

      setRuntimeStatus((prev) => ({ ...prev, discoveryPhase: "MAPPING" }));

      const eligibilityMap = computeAllEligibility(discovered);
      setRuntimeStatus((prev) => ({ ...prev, discoveryPhase: "FILTERING" }));

      const existingTiers = tiersRef.current;
      const tierMap = assignAllTiers(discovered, eligibilityMap, existingTiers);
      setRuntimeStatus((prev) => ({ ...prev, discoveryPhase: "TIERING" }));

      // CRITICAL FIX: Merge discovery results with anchor bootstrap.
      // This ensures the 8 anchor TIER_1 assets survive regardless of whether
      // discovery found them (CORS failures, API gaps, etc.).
      const merged = mergeWithAnchorBootstrap(
        discovered,
        eligibilityMap,
        tierMap,
      );

      // Count tiers from the MERGED map (which always includes anchors)
      let t1 = 0;
      let t2 = 0;
      let t3 = 0;
      let excl = 0;
      for (const ta of merged.tiers.values()) {
        if (ta.tier === "TIER_1") t1++;
        else if (ta.tier === "TIER_2") t2++;
        else if (ta.tier === "TIER_3") t3++;
        else excl++;
      }
      const eligibleCount = Array.from(merged.eligibility.values()).filter(
        (e) => e.eligibility !== "EXCLUDED",
      ).length;

      setAssets(merged.assets);
      setEligibility(merged.eligibility);
      setTiers(merged.tiers);

      // Also sync refs immediately so applyAnchorLiveStates() called right after
      // this block sees the fresh merged data
      assetsRef.current = merged.assets;
      eligibilityRef.current = merged.eligibility;
      tiersRef.current = merged.tiers;

      setRuntimeStatus((prev) => ({
        ...prev,
        discoveryPhase: "COMPLETE",
        // discoveredAssets shows the FULL discovered count (excluding anchor-only bootstraps)
        discoveredAssets: merged.assets.size,
        eligibleAssets: eligibleCount,
        tierCounts: { tier1: t1, tier2: t2, tier3: t3, excluded: excl },
        lastDiscoveryRefreshAt: Date.now(),
      }));

      // Immediately apply anchor live states after discovery
      applyAnchorLiveStates();

      // Trigger immediate first-pass hydration for expanded tiers
      void pollTier1ExpandedRef.current();
      void pollTier2Ref.current();
    } catch (err) {
      console.warn("[D16 Universe] runDiscovery error:", err);
      // On error, ensure anchor bootstrap is still intact
      const anchorAssets = buildAnchorBootstrapAssets();
      const anchorEligibility = buildAnchorBootstrapEligibility();
      const anchorTiers = buildAnchorBootstrapTiers();
      // Merge with existing to preserve any prior discovery data
      for (const [asset, val] of anchorAssets) {
        if (!assetsRef.current.has(asset)) assetsRef.current.set(asset, val);
      }
      for (const [asset, val] of anchorEligibility) {
        if (!eligibilityRef.current.has(asset))
          eligibilityRef.current.set(asset, val);
      }
      for (const [asset, val] of anchorTiers) {
        if (!tiersRef.current.has(asset)) tiersRef.current.set(asset, val);
      }
      setAssets(new Map(assetsRef.current));
      setEligibility(new Map(eligibilityRef.current));
      setTiers(new Map(tiersRef.current));
      setRuntimeStatus((prev) => ({
        ...prev,
        discoveryPhase: "ERROR",
        discoveryError:
          err instanceof Error ? err.message : "Unknown discovery error",
      }));
    }
  }, [isMockMode, applyAnchorLiveStates]);

  // ─ TIER_1 expanded REST polling (non-anchor TIER_1 assets) ─
  const pollTier1Expanded = useCallback(async () => {
    if (isMockMode) return;

    const tier1ExpandedAssets = Array.from(tiersRef.current.entries())
      .filter(
        ([asset, ta]) => ta.tier === "TIER_1" && !ANCHOR_ASSET_SET.has(asset),
      )
      .map(([asset]) => asset)
      .slice(0, MAX_TIER_1_EXPANDED_CONCURRENT);

    if (tier1ExpandedAssets.length === 0) return;

    const assetMap = assetsRef.current;
    const bsSymbols = tier1ExpandedAssets
      .map((a) => assetMap.get(a)?.binanceSpotSymbol)
      .filter((s): s is string => !!s);
    const bfSymbols = tier1ExpandedAssets
      .map((a) => assetMap.get(a)?.binanceFuturesSymbol)
      .filter((s): s is string => !!s);

    const [bsResults, bfResults] = await Promise.all([
      fetchBinanceSpotBatch(bsSymbols.slice(0, 50)),
      fetchBinanceFuturesBatch(bfSymbols.slice(0, 50)),
    ]);

    // Build symbol→canonical reverse lookup
    const symbolToCanonical = new Map<string, string>();
    for (const [canonicalId, universeAsset] of assetsRef.current) {
      if (universeAsset.binanceSpotSymbol)
        symbolToCanonical.set(universeAsset.binanceSpotSymbol, canonicalId);
      if (universeAsset.binanceFuturesSymbol)
        symbolToCanonical.set(universeAsset.binanceFuturesSymbol, canonicalId);
    }

    for (const { symbol, snapshot } of bsResults) {
      if (!snapshot) continue;
      const asset = symbolToCanonical.get(symbol) ?? stripUsdtSuffix(symbol);
      updateHydration(asset, "BINANCE_SPOT", snapshot);
    }
    for (const { symbol, snapshot } of bfResults) {
      if (!snapshot) continue;
      const asset = symbolToCanonical.get(symbol) ?? stripUsdtSuffix(symbol);
      updateHydration(asset, "BINANCE_FUTURES", snapshot);
    }

    const cbProductIds = tier1ExpandedAssets
      .map((a) => assetsRef.current.get(a)?.coinbaseSpotProduct)
      .filter((p): p is string => !!p);
    if (cbProductIds.length > 0) {
      const cbResults = await fetchCoinbaseSpotBatch(cbProductIds);
      for (const { productId, snapshot } of cbResults) {
        if (!snapshot) continue;
        const canonical = productId.split("-")[0];
        if (canonical) updateHydration(canonical, "COINBASE_SPOT", snapshot);
      }
    }
  }, [isMockMode, updateHydration]);

  // ─ TIER_2 REST polling ─
  const pollTier2 = useCallback(async () => {
    if (isMockMode) return;
    const tier2Assets = Array.from(tiersRef.current.entries())
      .filter(([, ta]) => ta.tier === "TIER_2")
      .map(([asset]) => asset)
      .slice(0, MAX_TIER_2_CONCURRENT);

    if (tier2Assets.length === 0) return;

    const assetMap = assetsRef.current;
    const bsSymbols = tier2Assets
      .map((a) => assetMap.get(a)?.binanceSpotSymbol)
      .filter((s): s is string => !!s);
    const bfSymbols = tier2Assets
      .map((a) => assetMap.get(a)?.binanceFuturesSymbol)
      .filter((s): s is string => !!s);

    const [bsResults, bfResults] = await Promise.all([
      fetchBinanceSpotBatch(bsSymbols.slice(0, 50)),
      fetchBinanceFuturesBatch(bfSymbols.slice(0, 50)),
    ]);

    const symbolToCanonical = new Map<string, string>();
    for (const [canonicalId, universeAsset] of assetsRef.current) {
      if (universeAsset.binanceSpotSymbol)
        symbolToCanonical.set(universeAsset.binanceSpotSymbol, canonicalId);
      if (universeAsset.binanceFuturesSymbol)
        symbolToCanonical.set(universeAsset.binanceFuturesSymbol, canonicalId);
    }

    for (const { symbol, snapshot } of bsResults) {
      if (!snapshot) continue;
      const asset = symbolToCanonical.get(symbol) ?? stripUsdtSuffix(symbol);
      updateHydration(asset, "BINANCE_SPOT", snapshot);
    }
    for (const { symbol, snapshot } of bfResults) {
      if (!snapshot) continue;
      const asset = symbolToCanonical.get(symbol) ?? stripUsdtSuffix(symbol);
      updateHydration(asset, "BINANCE_FUTURES", snapshot);
    }

    const cbProductIds = tier2Assets
      .map((a) => assetsRef.current.get(a)?.coinbaseSpotProduct)
      .filter((p): p is string => !!p);
    if (cbProductIds.length > 0) {
      const cbResults = await fetchCoinbaseSpotBatch(cbProductIds);
      for (const { productId, snapshot } of cbResults) {
        if (!snapshot) continue;
        const canonical = productId.split("-")[0];
        if (canonical) updateHydration(canonical, "COINBASE_SPOT", snapshot);
      }
    }
  }, [isMockMode, updateHydration]);

  // ─ TIER_3 REST polling (subset) ─
  const pollTier3 = useCallback(async () => {
    if (isMockMode) return;
    const tier3Assets = Array.from(tiersRef.current.entries())
      .filter(([, ta]) => ta.tier === "TIER_3")
      .map(([asset]) => asset)
      .slice(0, MAX_TIER_3_CONCURRENT);

    if (tier3Assets.length === 0) return;

    const assetMap = assetsRef.current;
    const bsSymbols = tier3Assets
      .map((a) => assetMap.get(a)?.binanceSpotSymbol)
      .filter((s): s is string => !!s)
      .slice(0, 100);

    const bsResults = await fetchBinanceSpotBatch(bsSymbols);

    const symbolToCanonical = new Map<string, string>();
    for (const [canonicalId, universeAsset] of assetsRef.current) {
      if (universeAsset.binanceSpotSymbol)
        symbolToCanonical.set(universeAsset.binanceSpotSymbol, canonicalId);
      if (universeAsset.binanceFuturesSymbol)
        symbolToCanonical.set(universeAsset.binanceFuturesSymbol, canonicalId);
    }

    for (const { symbol, snapshot } of bsResults) {
      if (!snapshot) continue;
      const asset = symbolToCanonical.get(symbol) ?? stripUsdtSuffix(symbol);
      updateHydration(asset, "BINANCE_SPOT", snapshot);
    }

    const cbProductIds = tier3Assets
      .map((a) => assetsRef.current.get(a)?.coinbaseSpotProduct)
      .filter((p): p is string => !!p);
    if (cbProductIds.length > 0) {
      const cbResults = await fetchCoinbaseSpotBatch(cbProductIds.slice(0, 20));
      for (const { productId, snapshot } of cbResults) {
        if (!snapshot) continue;
        const canonical = productId.split("-")[0];
        if (canonical) updateHydration(canonical, "COINBASE_SPOT", snapshot);
      }
    }
  }, [isMockMode, updateHydration]);

  // Keep polling function refs in sync
  useEffect(() => {
    pollTier1ExpandedRef.current = pollTier1Expanded;
  }, [pollTier1Expanded]);

  useEffect(() => {
    pollTier2Ref.current = pollTier2;
  }, [pollTier2]);

  // ─ Effect: MOCK mode ─
  useEffect(() => {
    if (isMockMode) {
      setRankedRecords(buildMockUniverseRecords());
      setRuntimeStatus(makeInitialRuntimeStatus);
      return;
    }
  }, [isMockMode]);

  // ─ Effect: LIVE mode — immediate anchor recompute before discovery completes ─
  // This effect fires as soon as LIVE mode is active. It sets up a fast recompute
  // loop that will produce live-ranked output for the 8 anchors as soon as the
  // WebSocket adapters deliver their first snapshots — without waiting for the
  // (potentially slow or CORS-failing) full universe discovery to complete.
  useEffect(() => {
    if (isMockMode) return;

    // Clear mock records immediately when entering LIVE mode
    setRankedRecords([]);

    // Start an immediate recompute so we pick up any anchor live states
    // that were already available when LIVE mode was activated
    recomputeRankings();

    // Fast recompute loop — fires every 2s
    const rankInterval = setInterval(
      () => recomputeRankings(),
      TIER_1_RECOMPUTE_MS,
    );

    return () => {
      clearInterval(rankInterval);
    };
  }, [isMockMode, recomputeRankings]);

  // ─ Effect: LIVE mode — discovery + tier polling ─
  // Separated from the rank loop effect so discovery failures/delays don't
  // interfere with anchor recompute timing.
  useEffect(() => {
    if (isMockMode) return;

    // Initial discovery
    void runDiscovery();

    // Discovery refresh every 10 minutes
    const discoveryInterval = setInterval(
      () => void runDiscovery(),
      DISCOVERY_REFRESH_MS,
    );

    // TIER_1 expanded REST polling every 10s
    const tier1ExpandedInterval = setInterval(
      () => void pollTier1Expanded(),
      TIER_1_EXPANDED_POLL_MS,
    );

    // TIER_2 polling every 30s
    const tier2Interval = setInterval(() => void pollTier2(), TIER_2_POLL_MS);

    // TIER_3 polling every 2 minutes
    const tier3Interval = setInterval(() => void pollTier3(), TIER_3_POLL_MS);

    return () => {
      clearInterval(discoveryInterval);
      clearInterval(tier1ExpandedInterval);
      clearInterval(tier2Interval);
      clearInterval(tier3Interval);
    };
  }, [isMockMode, runDiscovery, pollTier1Expanded, pollTier2, pollTier3]);

  return {
    mode: isMockMode ? "MOCK" : "LIVE",
    rankedRecords,
    runtimeStatus,
    assets,
    eligibility,
    tiers,
    hydration,
    isMockMode,
    mockModeNotice: isMockMode
      ? "Full universe discovery requires LIVE mode. Showing 8 canonical mock assets ranked through the universe engine."
      : null,
  };
}
