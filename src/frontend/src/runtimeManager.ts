// D16 Hybrid v0.6 — Runtime Manager
// Orchestrates: mode selection, adapter lifecycle, asset hydration, live trust model,
// per-asset hybrid recompute pipeline.
//
// This is a React hook. Import and use once at App root level.
// It is the single authority on live vs mock state.

import { useCallback, useEffect, useRef, useState } from "react";
import { resolveEntryEngine } from "./entryEngine";
import { resolveHybridCorrelation } from "./hybridEngine";
import {
  CANONICAL_ASSET_MAPPINGS,
  HYBRID_ASSET_STATES,
} from "./hybridMockData";
import type {
  CanonicalAssetState,
  HybridAssetBundle,
  PerMarketState,
} from "./hybridTypes";
import type {
  BinanceFuturesAdapter,
  BinanceSpotAdapter,
  CoinbaseSpotAdapter,
} from "./liveAdapter";
import {
  type AdapterStateCallback,
  type AssetHydrationState,
  type EngineMode,
  type LiveMarketId,
  type LiveMarketSnapshot,
  type MarketAdapterState,
  type RuntimeState,
  type SnapshotCallback,
  makeInitialAdapterState,
  makeInitialAssetHydration,
} from "./liveAdapterTypes";
import { normalizeSnapshot } from "./liveNormalizer";

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_ASSETS = [
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "DOGE",
  "ADA",
  "LINK",
  "AVAX",
] as const;

const RECOMPUTE_INTERVAL_MS = 2_000; // recompute hybrid every 2s when live

// ─── Initial runtime state ────────────────────────────────────────────────────

function makeInitialRuntimeState(mode: EngineMode): RuntimeState {
  const adapters: RuntimeState["adapters"] = {
    BINANCE_SPOT: makeInitialAdapterState("BINANCE_SPOT"),
    BINANCE_FUTURES: makeInitialAdapterState("BINANCE_FUTURES"),
    COINBASE_SPOT: makeInitialAdapterState("COINBASE_SPOT"),
  };
  const assets: RuntimeState["assets"] = {};
  for (const asset of CANONICAL_ASSETS) {
    assets[asset] = makeInitialAssetHydration(asset);
  }
  return {
    mode,
    adapters,
    assets,
    connectedMarketCount: 0,
    staleMarketCount: 0,
    disconnectedMarketCount: 0,
    overallTrustClass: "BLOCKED",
    lastHybridRecomputeAt: null,
    recomputeIntervalMs: RECOMPUTE_INTERVAL_MS,
    liveActivatedAt: null,
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export type RuntimeManagerResult = {
  runtimeState: RuntimeState;
  liveBundles: HybridAssetBundle[] | null; // null when in MOCK mode
  mockBundles: HybridAssetBundle[]; // always available
  activeBundles: HybridAssetBundle[]; // live bundles if available, else mock
  setMode: (mode: EngineMode) => void;
  isLiveMode: boolean;
  dataSource: "MOCK" | "LIVE";
  // v0.8: exposes live normalized state for universe scheduler TIER_1 hydration.
  // Reads from normalizedStoreRef — no side effects, no new state.
  getNormalizedState: (
    market: LiveMarketId,
    asset: string,
  ) => PerMarketState | null;
};

export function useRuntimeManager(): RuntimeManagerResult {
  const [mode, setModeState] = useState<EngineMode>("MOCK");
  const [runtimeState, setRuntimeState] = useState<RuntimeState>(() =>
    makeInitialRuntimeState("MOCK"),
  );

  // Live snapshot store: market → asset → latest snapshot
  const snapshotStoreRef = useRef<
    Map<LiveMarketId, Map<string, LiveMarketSnapshot>>
  >(new Map());

  // Normalized per-market states (output of normalizer)
  const normalizedStoreRef = useRef<
    Map<LiveMarketId, Map<string, PerMarketState>>
  >(new Map());

  // Adapters (lazy-loaded)
  const adaptersRef = useRef<{
    binanceSpot: BinanceSpotAdapter;
    binanceFutures: BinanceFuturesAdapter;
    coinbaseSpot: CoinbaseSpotAdapter;
  } | null>(null);

  // Live bundles (recomputed on schedule)
  const [liveBundles, setLiveBundles] = useState<HybridAssetBundle[] | null>(
    null,
  );

  // Mock bundles are static
  const mockBundles: HybridAssetBundle[] = HYBRID_ASSET_STATES.map(
    (assetState) => {
      const correlation = resolveHybridCorrelation(assetState);
      const entry = resolveEntryEngine(assetState, correlation);
      const mapping = CANONICAL_ASSET_MAPPINGS.find(
        (m) => m.asset === assetState.asset,
      )!;
      return { mapping, assetState, correlation, entry };
    },
  );

  // ── Adapter state update handler ──
  const handleAdapterState = useCallback((adapterState: MarketAdapterState) => {
    setRuntimeState((prev) => {
      const adapters = {
        ...prev.adapters,
        [adapterState.marketId]: adapterState,
      };
      return {
        ...prev,
        adapters,
        ...computeAggregateTrust(adapters),
      };
    });
  }, []);

  // ── Snapshot handler ──
  const handleSnapshot = useCallback(
    (snapshot: LiveMarketSnapshot, adapterTrust: number) => {
      // Store raw snapshot
      let marketMap = snapshotStoreRef.current.get(snapshot.market);
      if (!marketMap) {
        marketMap = new Map();
        snapshotStoreRef.current.set(snapshot.market, marketMap);
      }
      marketMap.set(snapshot.asset, snapshot);

      // Normalize immediately
      const normalizedState = normalizeSnapshot(snapshot, adapterTrust);
      let normalizedMarket = normalizedStoreRef.current.get(snapshot.market);
      if (!normalizedMarket) {
        normalizedMarket = new Map();
        normalizedStoreRef.current.set(snapshot.market, normalizedMarket);
      }
      normalizedMarket.set(snapshot.asset, normalizedState);

      // Update asset hydration state
      setRuntimeState((prev) => {
        const assetHydration = updateAssetHydration(
          prev.assets[snapshot.asset] ??
            makeInitialAssetHydration(snapshot.asset),
          snapshot.market,
          prev.adapters,
        );
        return {
          ...prev,
          assets: { ...prev.assets, [snapshot.asset]: assetHydration },
        };
      });
    },
    [],
  );

  // ── Recompute pipeline ──
  const recomputeLiveBundles = useCallback(() => {
    const bundles: HybridAssetBundle[] = [];

    for (const asset of CANONICAL_ASSETS) {
      const bsState =
        normalizedStoreRef.current.get("BINANCE_SPOT")?.get(asset) ?? null;
      const bfState =
        normalizedStoreRef.current.get("BINANCE_FUTURES")?.get(asset) ?? null;
      const cbState =
        normalizedStoreRef.current.get("COINBASE_SPOT")?.get(asset) ?? null;

      const assetState: CanonicalAssetState = {
        asset,
        binanceSpot: bsState,
        binanceFutures: bfState,
        coinbaseSpot: cbState,
      };

      const correlation = resolveHybridCorrelation(assetState);
      const entry = resolveEntryEngine(assetState, correlation);
      const mapping = CANONICAL_ASSET_MAPPINGS.find((m) => m.asset === asset)!;

      bundles.push({ mapping, assetState, correlation, entry });
    }

    setLiveBundles(bundles);
    setRuntimeState((prev) => ({
      ...prev,
      lastHybridRecomputeAt: Date.now(),
    }));
  }, []);

  // ── Mode transition ──
  const setMode = useCallback(
    async (newMode: EngineMode) => {
      if (newMode === "MOCK") {
        // Disconnect all adapters if active
        if (adaptersRef.current) {
          adaptersRef.current.binanceSpot.disconnect();
          adaptersRef.current.binanceFutures.disconnect();
          adaptersRef.current.coinbaseSpot.disconnect();
        }
        setModeState("MOCK");
        setLiveBundles(null);
        setRuntimeState(makeInitialRuntimeState("MOCK"));
        return;
      }

      // LIVE or HYBRID_LIVE — start adapters
      setModeState(newMode);
      setRuntimeState((prev) => ({
        ...prev,
        mode: newMode,
        liveActivatedAt: Date.now(),
      }));

      // Lazy-load adapter classes to avoid any cost in MOCK mode
      const { createAdapters } = await import("./liveAdapter");
      if (!adaptersRef.current) {
        adaptersRef.current = createAdapters();
      }

      const { binanceSpot, binanceFutures, coinbaseSpot } = adaptersRef.current;

      // Bootstrap each adapter, then start WebSocket stream
      // Errors in one adapter do not block others.
      const startAdapter = async (
        adapter:
          | typeof binanceSpot
          | typeof binanceFutures
          | typeof coinbaseSpot,
        marketId: LiveMarketId,
      ) => {
        const onSnap: SnapshotCallback = (snap) => {
          const trust = adapter.state.runtimeTrustContribution;
          handleSnapshot(snap, trust);
        };
        const onState: AdapterStateCallback = handleAdapterState;

        try {
          await adapter.bootstrap(onSnap, onState);
          adapter.connect(onSnap, onState);
        } catch (err) {
          console.warn(`[D16 Runtime] ${marketId} bootstrap failed:`, err);
          // Adapter will self-report ERROR status — no cascade needed.
        }
      };

      void startAdapter(binanceSpot, "BINANCE_SPOT");
      void startAdapter(binanceFutures, "BINANCE_FUTURES");
      void startAdapter(coinbaseSpot, "COINBASE_SPOT");
    },
    [handleSnapshot, handleAdapterState],
  );

  // ── Recompute interval (only in LIVE/HYBRID_LIVE mode) ──
  const recomputeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  useEffect(() => {
    if (mode === "MOCK") {
      if (recomputeIntervalRef.current) {
        clearInterval(recomputeIntervalRef.current);
        recomputeIntervalRef.current = null;
      }
      return;
    }
    recomputeIntervalRef.current = setInterval(
      recomputeLiveBundles,
      RECOMPUTE_INTERVAL_MS,
    );
    return () => {
      if (recomputeIntervalRef.current) {
        clearInterval(recomputeIntervalRef.current);
        recomputeIntervalRef.current = null;
      }
    };
  }, [mode, recomputeLiveBundles]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (adaptersRef.current) {
        adaptersRef.current.binanceSpot.disconnect();
        adaptersRef.current.binanceFutures.disconnect();
        adaptersRef.current.coinbaseSpot.disconnect();
      }
      if (recomputeIntervalRef.current) {
        clearInterval(recomputeIntervalRef.current);
      }
    };
  }, []);

  // ── v0.8: normalized state accessor for universe scheduler ──
  // Stable ref-based function — does not cause re-renders.
  const getNormalizedState = useCallback(
    (market: LiveMarketId, asset: string): PerMarketState | null => {
      return normalizedStoreRef.current.get(market)?.get(asset) ?? null;
    },
    [],
  );

  const isLiveMode = mode !== "MOCK";
  const dataSource = isLiveMode && liveBundles !== null ? "LIVE" : "MOCK";
  const activeBundles =
    isLiveMode && liveBundles !== null ? liveBundles : mockBundles;

  return {
    runtimeState,
    liveBundles,
    mockBundles,
    activeBundles,
    setMode,
    isLiveMode,
    dataSource,
    getNormalizedState,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeAggregateTrust(
  adapters: RuntimeState["adapters"],
): Pick<
  RuntimeState,
  | "connectedMarketCount"
  | "staleMarketCount"
  | "disconnectedMarketCount"
  | "overallTrustClass"
> {
  const values = Object.values(adapters);
  const connected = values.filter(
    (a) => a.status === "CONNECTED" && !a.isStale,
  ).length;
  const stale = values.filter((a) => a.isStale).length;
  const disconnected = values.filter(
    (a) => a.status === "DISCONNECTED" || a.status === "ERROR",
  ).length;

  let overallTrustClass: RuntimeState["overallTrustClass"];
  if (connected === 3) overallTrustClass = "FULL";
  else if (connected === 2 && stale === 0) overallTrustClass = "REDUCED";
  else if (connected >= 1) overallTrustClass = "PARTIAL";
  else overallTrustClass = "BLOCKED";

  return {
    connectedMarketCount: connected,
    staleMarketCount: stale,
    disconnectedMarketCount: disconnected,
    overallTrustClass,
  };
}

function updateAssetHydration(
  current: AssetHydrationState,
  marketId: LiveMarketId,
  adapters: RuntimeState["adapters"],
): AssetHydrationState {
  const updated = { ...current };

  if (marketId === "BINANCE_SPOT") updated.binanceSpotHydrated = true;
  if (marketId === "BINANCE_FUTURES") updated.binanceFuturesHydrated = true;
  if (marketId === "COINBASE_SPOT") updated.coinbaseSpotHydrated = true;

  const hydratedCount = [
    updated.binanceSpotHydrated,
    updated.binanceFuturesHydrated,
    updated.coinbaseSpotHydrated,
  ].filter(Boolean).length;

  const missingMarkets: LiveMarketId[] = [];
  if (!updated.binanceSpotHydrated) missingMarkets.push("BINANCE_SPOT");
  if (!updated.binanceFuturesHydrated) missingMarkets.push("BINANCE_FUTURES");
  if (!updated.coinbaseSpotHydrated) missingMarkets.push("COINBASE_SPOT");

  const anyStale =
    adapters.BINANCE_SPOT.isStale ||
    adapters.BINANCE_FUTURES.isStale ||
    adapters.COINBASE_SPOT.isStale;

  const hybridReady = hydratedCount === 3 && !anyStale;

  let hybridTrustImpact: AssetHydrationState["hybridTrustImpact"];
  if (hybridReady) hybridTrustImpact = "FULL";
  else if (hydratedCount === 3 && anyStale) hybridTrustImpact = "REDUCED";
  else if (hydratedCount >= 1) hybridTrustImpact = "PARTIAL";
  else hybridTrustImpact = "BLOCKED";

  return {
    ...updated,
    hydratedMarketCount: hydratedCount,
    missingMarkets,
    hybridReady,
    hybridTrustImpact,
    lastPartialUpdateAt: Date.now(),
    lastFullRecomputeAt: hybridReady ? Date.now() : current.lastFullRecomputeAt,
  };
}
