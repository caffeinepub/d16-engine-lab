// D16 Hybrid v0.6 — Live Adapter Type System
// Layer 0: Transport / Runtime / Hydration types
// These types are canonical. Do not flatten or merge with hybrid layer types.

// ─── Engine Mode ─────────────────────────────────────────────────────────────

/**
 * MOCK: All data is seeded deterministic. No network calls. Lab testing.
 * LIVE: All hybrid data driven by live market adapters.
 * HYBRID_LIVE: Live adapters active; falls back to mock for disconnected markets
 *              but surfaces the fallback explicitly — no silent substitution.
 */
export type EngineMode = "MOCK" | "LIVE" | "HYBRID_LIVE";

// ─── Adapter Connection Status ───────────────────────────────────────────────

export type AdapterStatus =
  | "INITIALIZING"
  | "BOOTSTRAPPING"
  | "CONNECTED"
  | "STALE"
  | "DISCONNECTED"
  | "RECONNECTING"
  | "ERROR";

// ─── Market Identifier ───────────────────────────────────────────────────────

export type LiveMarketId = "BINANCE_SPOT" | "BINANCE_FUTURES" | "COINBASE_SPOT";

// ─── Raw Snapshot from Transport Layer ───────────────────────────────────────
// This is the raw data from the exchange. It must not feed directly into hybrid outputs.
// It must pass through liveNormalizer.ts first.

export type LiveMarketSnapshot = {
  asset: string; // canonical (BTC, ETH, etc.)
  market: LiveMarketId;
  symbol: string; // exchange-specific (BTCUSDT, BTC-USD, etc.)

  // Ticker data
  price: number;
  priceChange24h: number; // absolute change
  priceChangePct24h: number; // percentage change
  volume24h: number; // quote volume
  high24h: number;
  low24h: number;

  // Futures-specific (null for spot)
  openInterest: number | null;
  fundingRate: number | null;

  // Transport metadata
  receivedAt: number; // unix ms
  sequenceId: number; // monotonically increasing per market
};

// ─── Per-Market Adapter State ─────────────────────────────────────────────────
// Tracks the runtime health of each exchange adapter.

export type MarketAdapterState = {
  marketId: LiveMarketId;
  status: AdapterStatus;

  // Heartbeat
  lastHeartbeatAt: number | null; // unix ms, null if never received
  heartbeatIntervalMs: number; // expected interval
  isHeartbeatHealthy: boolean;

  // Data freshness
  lastUpdateAt: number | null; // unix ms of last data tick
  isStale: boolean; // true if >staleness threshold with no update
  stalenessThresholdMs: number; // configurable, defaults vary per market

  // Bootstrap
  bootstrapComplete: boolean;
  bootstrapProgress: number; // 0–100
  bootstrapStartedAt: number | null;

  // Reliability
  reconnectCount: number;
  totalTicksReceived: number;
  lastError: string | null;

  // Runtime trust contribution (0–100)
  // Reduced when stale, disconnected, or bootstrapping.
  runtimeTrustContribution: number;
};

// ─── Canonical Asset Hydration State ──────────────────────────────────────────
// For each canonical asset, tracks which markets have live data ready.

export type AssetHydrationState = {
  asset: string;

  // Per-market readiness
  binanceSpotHydrated: boolean;
  binanceFuturesHydrated: boolean;
  coinbaseSpotHydrated: boolean;

  // Derived
  hydratedMarketCount: number; // 0–3
  missingMarkets: LiveMarketId[];

  // Hybrid readiness: all 3 markets hydrated + none stale
  hybridReady: boolean;

  // Trust impact
  // If a key market is missing/stale, this reflects the reduced hybrid trust.
  hybridTrustImpact: "FULL" | "REDUCED" | "PARTIAL" | "BLOCKED";

  // Timing
  lastFullRecomputeAt: number | null; // unix ms
  lastPartialUpdateAt: number | null;
};

// ─── Runtime State (top-level) ────────────────────────────────────────────────
// Aggregated runtime truth across all adapters.

export type RuntimeState = {
  mode: EngineMode;

  // Adapter states (one per market)
  adapters: Record<LiveMarketId, MarketAdapterState>;

  // Asset hydration states (one per canonical asset)
  assets: Record<string, AssetHydrationState>;

  // Aggregate trust
  connectedMarketCount: number; // 0–3
  staleMarketCount: number;
  disconnectedMarketCount: number;

  // Trust summary
  overallTrustClass: "FULL" | "REDUCED" | "PARTIAL" | "BLOCKED";

  // Recompute timing
  lastHybridRecomputeAt: number | null;
  recomputeIntervalMs: number;

  // Mode activation
  liveActivatedAt: number | null;
};

// ─── Adapter Callback ────────────────────────────────────────────────────────

export type SnapshotCallback = (snapshot: LiveMarketSnapshot) => void;
export type AdapterStateCallback = (state: MarketAdapterState) => void;

// ─── Adapter Interface ───────────────────────────────────────────────────────
// Each exchange adapter must implement this contract.

export interface IMarketAdapter {
  readonly marketId: LiveMarketId;
  readonly state: MarketAdapterState;

  bootstrap(
    onSnapshot: SnapshotCallback,
    onState: AdapterStateCallback,
  ): Promise<void>;
  connect(onSnapshot: SnapshotCallback, onState: AdapterStateCallback): void;
  disconnect(): void;
  getState(): MarketAdapterState;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const STALE_THRESHOLD_MS: Record<LiveMarketId, number> = {
  BINANCE_SPOT: 10_000, // 10s
  BINANCE_FUTURES: 10_000, // 10s
  COINBASE_SPOT: 15_000, // 15s (Coinbase can be slightly slower)
};

export const HEARTBEAT_INTERVAL_MS: Record<LiveMarketId, number> = {
  BINANCE_SPOT: 20_000,
  BINANCE_FUTURES: 20_000,
  COINBASE_SPOT: 30_000,
};

export const RECONNECT_DELAY_MS = 3_000;
export const MAX_RECONNECT_DELAY_MS = 30_000;

// ─── Initial adapter state factory ───────────────────────────────────────────

export function makeInitialAdapterState(
  marketId: LiveMarketId,
): MarketAdapterState {
  return {
    marketId,
    status: "INITIALIZING",
    lastHeartbeatAt: null,
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS[marketId],
    isHeartbeatHealthy: false,
    lastUpdateAt: null,
    isStale: false,
    stalenessThresholdMs: STALE_THRESHOLD_MS[marketId],
    bootstrapComplete: false,
    bootstrapProgress: 0,
    bootstrapStartedAt: null,
    reconnectCount: 0,
    totalTicksReceived: 0,
    lastError: null,
    runtimeTrustContribution: 0,
  };
}

export function makeInitialAssetHydration(asset: string): AssetHydrationState {
  return {
    asset,
    binanceSpotHydrated: false,
    binanceFuturesHydrated: false,
    coinbaseSpotHydrated: false,
    hydratedMarketCount: 0,
    missingMarkets: ["BINANCE_SPOT", "BINANCE_FUTURES", "COINBASE_SPOT"],
    hybridReady: false,
    hybridTrustImpact: "BLOCKED",
    lastFullRecomputeAt: null,
    lastPartialUpdateAt: null,
  };
}
