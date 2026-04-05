// D16 Hybrid v0.6 — Live Market Adapters
// Layer 0: Exchange transport — Binance Spot, Binance Futures, Coinbase Spot
//
// DOCTRINE:
// - Raw data from this layer must NEVER feed directly into hybrid outputs.
// - It must pass through liveNormalizer.ts first.
// - Each adapter is independent. Failure in one does not cascade to others.
// - Adapters surface their health state explicitly. No silent fallback.

import type {
  AdapterStateCallback,
  IMarketAdapter,
  LiveMarketId,
  LiveMarketSnapshot,
  MarketAdapterState,
  SnapshotCallback,
} from "./liveAdapterTypes";
import {
  RECONNECT_DELAY_MS,
  STALE_THRESHOLD_MS,
  makeInitialAdapterState,
} from "./liveAdapterTypes";

// ─── Canonical asset symbol maps ──────────────────────────────────────────────

const BINANCE_SPOT_SYMBOLS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  DOGE: "DOGEUSDT",
  ADA: "ADAUSDT",
  LINK: "LINKUSDT",
  AVAX: "AVAXUSDT",
};

const BINANCE_FUTURES_SYMBOLS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  DOGE: "DOGEUSDT",
  ADA: "ADAUSDT",
  LINK: "LINKUSDT",
  AVAX: "AVAXUSDT",
};

const COINBASE_SPOT_PRODUCTS: Record<string, string> = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
  XRP: "XRP-USD",
  DOGE: "DOGE-USD",
  ADA: "ADA-USD",
  LINK: "LINK-USD",
  AVAX: "AVAX-USD",
};

const CANONICAL_ASSETS = Object.keys(BINANCE_SPOT_SYMBOLS);

// ─── Base Adapter ─────────────────────────────────────────────────────────────

abstract class BaseAdapter implements IMarketAdapter {
  abstract readonly marketId: LiveMarketId;
  protected _state: MarketAdapterState;
  protected _ws: WebSocket | null = null;
  protected _staleTimer: ReturnType<typeof setInterval> | null = null;
  protected _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  protected _onSnapshot: SnapshotCallback | null = null;
  protected _onState: AdapterStateCallback | null = null;
  protected _sequenceCounter = 0;
  protected _reconnectAttempts = 0;

  constructor() {
    this._state = makeInitialAdapterState(this.getMarketId());
  }

  // Subclasses declare their ID via this method (used in constructor).
  protected abstract getMarketId(): LiveMarketId;

  get state(): MarketAdapterState {
    return this._state;
  }

  getState(): MarketAdapterState {
    return this._state;
  }

  protected updateState(patch: Partial<MarketAdapterState>) {
    this._state = { ...this._state, ...patch };
    this._onState?.(this._state);
  }

  protected markTick(_asset: string) {
    const now = Date.now();
    this.updateState({
      lastUpdateAt: now,
      isStale: false,
      totalTicksReceived: this._state.totalTicksReceived + 1,
      runtimeTrustContribution: this._computeTrust(),
    });
  }

  protected _computeTrust(): number {
    const s = this._state;
    if (s.status === "DISCONNECTED" || s.status === "ERROR") return 0;
    if (s.status === "RECONNECTING") return 10;
    if (s.isStale) return 30;
    if (s.status === "BOOTSTRAPPING")
      return Math.round(s.bootstrapProgress * 0.5);
    if (!s.bootstrapComplete) return 40;
    // Full connection, healthy
    const penalty = Math.min(s.reconnectCount * 5, 30);
    return Math.max(100 - penalty, 70);
  }

  protected _startStaleDetection() {
    if (this._staleTimer) clearInterval(this._staleTimer);
    this._staleTimer = setInterval(() => {
      const threshold = STALE_THRESHOLD_MS[this._state.marketId];
      const lastUpdate = this._state.lastUpdateAt;
      const now = Date.now();
      if (lastUpdate !== null && now - lastUpdate > threshold) {
        this.updateState({
          isStale: true,
          runtimeTrustContribution: Math.max(
            this._state.runtimeTrustContribution - 20,
            10,
          ),
        });
      }
    }, 5_000);
  }

  protected _stopTimers() {
    if (this._staleTimer) {
      clearInterval(this._staleTimer);
      this._staleTimer = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  protected _scheduleReconnect(
    onSnapshot: SnapshotCallback,
    onState: AdapterStateCallback,
  ) {
    this._reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_DELAY_MS * this._reconnectAttempts,
      30_000,
    );
    this.updateState({
      status: "RECONNECTING",
      reconnectCount: this._state.reconnectCount + 1,
      runtimeTrustContribution: 10,
    });
    this._reconnectTimer = setTimeout(() => {
      this.connect(onSnapshot, onState);
    }, delay);
  }

  disconnect() {
    this._stopTimers();
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.onerror = null;
      this._ws.onmessage = null;
      try {
        this._ws.close();
      } catch {
        /* noop */
      }
      this._ws = null;
    }
    this.updateState({
      status: "DISCONNECTED",
      isStale: false,
      runtimeTrustContribution: 0,
    });
  }

  abstract bootstrap(
    onSnapshot: SnapshotCallback,
    onState: AdapterStateCallback,
  ): Promise<void>;
  abstract connect(
    onSnapshot: SnapshotCallback,
    onState: AdapterStateCallback,
  ): void;
}

// ─── Binance Spot Adapter ──────────────────────────────────────────────────────

export class BinanceSpotAdapter extends BaseAdapter {
  readonly marketId: LiveMarketId = "BINANCE_SPOT";

  protected getMarketId(): LiveMarketId {
    return "BINANCE_SPOT";
  }

  async bootstrap(
    onSnapshot: SnapshotCallback,
    onState: AdapterStateCallback,
  ): Promise<void> {
    this._onSnapshot = onSnapshot;
    this._onState = onState;
    this.updateState({
      status: "BOOTSTRAPPING",
      bootstrapProgress: 0,
      bootstrapStartedAt: Date.now(),
    });

    const symbols = Object.values(BINANCE_SPOT_SYMBOLS);
    try {
      // Binance allows multiple symbols in one call via the "symbols" query param
      const symbolsParam = encodeURIComponent(JSON.stringify(symbols));
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`;
      const resp = await fetch(url);
      if (!resp.ok)
        throw new Error(`Binance Spot bootstrap HTTP ${resp.status}`);
      const tickers: BinanceTicker[] = await resp.json();

      this.updateState({ bootstrapProgress: 50 });

      for (const ticker of tickers) {
        const asset = this._symbolToAsset(ticker.symbol ?? "");
        if (!asset) continue;
        const snapshot = this._tickerToSnapshot(asset, ticker);
        onSnapshot(snapshot);
      }

      this.updateState({
        bootstrapProgress: 100,
        bootstrapComplete: true,
        status: "CONNECTED",
        lastUpdateAt: Date.now(),
        runtimeTrustContribution: 100,
        lastError: null,
      });
    } catch (err) {
      this.updateState({
        status: "ERROR",
        lastError: err instanceof Error ? err.message : String(err),
        runtimeTrustContribution: 0,
      });
      throw err;
    }
  }

  connect(onSnapshot: SnapshotCallback, onState: AdapterStateCallback) {
    this._onSnapshot = onSnapshot;
    this._onState = onState;

    const streams = Object.values(BINANCE_SPOT_SYMBOLS)
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join("/");
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    this.updateState({ status: "CONNECTED" });
    this._startStaleDetection();

    const ws = new WebSocket(wsUrl);
    this._ws = ws;

    ws.onopen = () => {
      this._reconnectAttempts = 0;
      this.updateState({
        status: this._state.bootstrapComplete ? "CONNECTED" : "BOOTSTRAPPING",
        lastHeartbeatAt: Date.now(),
        isHeartbeatHealthy: true,
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          data?: BinanceTicker;
          stream?: string;
        };
        const ticker = msg.data as BinanceTicker;
        if (!ticker?.s) return;
        const asset = this._symbolToAsset(ticker.s);
        if (!asset) return;
        const snapshot = this._tickerToSnapshot(asset, ticker);
        onSnapshot(snapshot);
        this.markTick(asset);
        this.updateState({
          lastHeartbeatAt: Date.now(),
          isHeartbeatHealthy: true,
        });
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onerror = () => {
      this.updateState({
        lastError: "WebSocket error",
        status: "ERROR",
        runtimeTrustContribution: 0,
      });
    };

    ws.onclose = (e) => {
      if (e.code !== 1000) {
        // Abnormal close — schedule reconnect
        this._scheduleReconnect(onSnapshot, onState);
      } else {
        this.updateState({
          status: "DISCONNECTED",
          runtimeTrustContribution: 0,
        });
      }
    };
  }

  private _symbolToAsset(symbol: string): string | null {
    const entry = Object.entries(BINANCE_SPOT_SYMBOLS).find(
      ([, sym]) => sym === symbol,
    );
    return entry ? entry[0] : null;
  }

  private _tickerToSnapshot(
    asset: string,
    t: BinanceTicker,
  ): LiveMarketSnapshot {
    return {
      asset,
      market: "BINANCE_SPOT",
      symbol: t.symbol ?? t.s ?? "",
      price: Number.parseFloat(t.lastPrice || t.c || "0"),
      priceChange24h: Number.parseFloat(t.priceChange || "0"),
      priceChangePct24h: Number.parseFloat(t.priceChangePercent || "0"),
      volume24h: Number.parseFloat(t.quoteVolume || t.q || "0"),
      high24h: Number.parseFloat(t.highPrice || t.h || "0"),
      low24h: Number.parseFloat(t.lowPrice || t.l || "0"),
      openInterest: null,
      fundingRate: null,
      receivedAt: Date.now(),
      sequenceId: ++this._sequenceCounter,
    };
  }
}

// ─── Binance Futures Adapter ───────────────────────────────────────────────────

export class BinanceFuturesAdapter extends BaseAdapter {
  readonly marketId: LiveMarketId = "BINANCE_FUTURES";
  private _openInterestMap: Map<string, number> = new Map();
  private _fundingRateMap: Map<string, number> = new Map();

  protected getMarketId(): LiveMarketId {
    return "BINANCE_FUTURES";
  }

  async bootstrap(
    onSnapshot: SnapshotCallback,
    onState: AdapterStateCallback,
  ): Promise<void> {
    this._onSnapshot = onSnapshot;
    this._onState = onState;
    this.updateState({
      status: "BOOTSTRAPPING",
      bootstrapProgress: 0,
      bootstrapStartedAt: Date.now(),
    });

    const symbols = Object.values(BINANCE_FUTURES_SYMBOLS);
    try {
      // Step 1: 24hr tickers (25%)
      const symbolsParam = encodeURIComponent(JSON.stringify(symbols));
      const tickerResp = await fetch(
        `https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${symbolsParam}`,
      );
      if (!tickerResp.ok)
        throw new Error(`Binance Futures bootstrap HTTP ${tickerResp.status}`);
      const tickers: BinanceTicker[] = await tickerResp.json();

      this.updateState({ bootstrapProgress: 30 });

      // Step 2: Fetch open interest for all symbols (50%)
      const oiResults = await Promise.allSettled(
        symbols.map((s) =>
          fetch(
            `https://fapi.binance.com/fapi/v1/openInterest?symbol=${s}`,
          ).then(
            (r) =>
              r.json() as Promise<{ symbol: string; openInterest: string }>,
          ),
        ),
      );
      for (const r of oiResults) {
        if (r.status === "fulfilled" && r.value.symbol) {
          this._openInterestMap.set(
            r.value.symbol,
            Number.parseFloat(r.value.openInterest || "0"),
          );
        }
      }

      this.updateState({ bootstrapProgress: 60 });

      // Step 3: Funding rates (80%)
      const frResp = await fetch(
        "https://fapi.binance.com/fapi/v1/premiumIndex",
      );
      if (frResp.ok) {
        const frData: Array<{ symbol: string; lastFundingRate: string }> =
          await frResp.json();
        for (const fr of frData) {
          if (symbols.includes(fr.symbol)) {
            this._fundingRateMap.set(
              fr.symbol,
              Number.parseFloat(fr.lastFundingRate || "0"),
            );
          }
        }
      }

      this.updateState({ bootstrapProgress: 80 });

      // Emit snapshots
      for (const ticker of tickers) {
        const asset = this._symbolToAsset(ticker.symbol ?? ticker.s ?? "");
        if (!asset) continue;
        const snapshot = this._tickerToSnapshot(asset, ticker);
        onSnapshot(snapshot);
      }

      this.updateState({
        bootstrapProgress: 100,
        bootstrapComplete: true,
        status: "CONNECTED",
        lastUpdateAt: Date.now(),
        runtimeTrustContribution: 100,
        lastError: null,
      });
    } catch (err) {
      this.updateState({
        status: "ERROR",
        lastError: err instanceof Error ? err.message : String(err),
        runtimeTrustContribution: 0,
      });
      throw err;
    }
  }

  connect(onSnapshot: SnapshotCallback, onState: AdapterStateCallback) {
    this._onSnapshot = onSnapshot;
    this._onState = onState;

    const streams = Object.values(BINANCE_FUTURES_SYMBOLS)
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join("/");
    const wsUrl = `wss://fstream.binance.com/stream?streams=${streams}`;

    this.updateState({ status: "CONNECTED" });
    this._startStaleDetection();

    const ws = new WebSocket(wsUrl);
    this._ws = ws;

    ws.onopen = () => {
      this._reconnectAttempts = 0;
      this.updateState({
        status: "CONNECTED",
        lastHeartbeatAt: Date.now(),
        isHeartbeatHealthy: true,
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          data?: BinanceTicker;
        };
        const ticker = msg.data as BinanceTicker;
        if (!ticker?.s) return;
        const asset = this._symbolToAsset(ticker.s);
        if (!asset) return;
        const snapshot = this._tickerToSnapshot(asset, ticker);
        onSnapshot(snapshot);
        this.markTick(asset);
        this.updateState({
          lastHeartbeatAt: Date.now(),
          isHeartbeatHealthy: true,
        });
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onerror = () => {
      this.updateState({
        lastError: "WebSocket error",
        status: "ERROR",
        runtimeTrustContribution: 0,
      });
    };

    ws.onclose = (e) => {
      if (e.code !== 1000) {
        this._scheduleReconnect(onSnapshot, onState);
      } else {
        this.updateState({
          status: "DISCONNECTED",
          runtimeTrustContribution: 0,
        });
      }
    };
  }

  private _symbolToAsset(symbol: string): string | null {
    const entry = Object.entries(BINANCE_FUTURES_SYMBOLS).find(
      ([, sym]) => sym === symbol,
    );
    return entry ? entry[0] : null;
  }

  private _tickerToSnapshot(
    asset: string,
    t: BinanceTicker,
  ): LiveMarketSnapshot {
    const sym = t.symbol ?? t.s ?? "";
    return {
      asset,
      market: "BINANCE_FUTURES",
      symbol: sym,
      price: Number.parseFloat(t.lastPrice || t.c || "0"),
      priceChange24h: Number.parseFloat(t.priceChange || "0"),
      priceChangePct24h: Number.parseFloat(t.priceChangePercent || "0"),
      volume24h: Number.parseFloat(t.quoteVolume || t.q || "0"),
      high24h: Number.parseFloat(t.highPrice || t.h || "0"),
      low24h: Number.parseFloat(t.lowPrice || t.l || "0"),
      openInterest: this._openInterestMap.get(sym) ?? null,
      fundingRate: this._fundingRateMap.get(sym) ?? null,
      receivedAt: Date.now(),
      sequenceId: ++this._sequenceCounter,
    };
  }
}

// ─── Coinbase Spot Adapter ─────────────────────────────────────────────────────

export class CoinbaseSpotAdapter extends BaseAdapter {
  readonly marketId: LiveMarketId = "COINBASE_SPOT";
  // Channel subscription is per-product
  private _subscriptionMap: Map<string, string> = new Map(); // asset -> product_id

  protected getMarketId(): LiveMarketId {
    return "COINBASE_SPOT";
  }

  async bootstrap(
    onSnapshot: SnapshotCallback,
    onState: AdapterStateCallback,
  ): Promise<void> {
    this._onSnapshot = onSnapshot;
    this._onState = onState;
    this.updateState({
      status: "BOOTSTRAPPING",
      bootstrapProgress: 0,
      bootstrapStartedAt: Date.now(),
    });

    try {
      // Coinbase Advanced Trade API — fetch 24hr stats per product
      const products = Object.values(COINBASE_SPOT_PRODUCTS);
      const results = await Promise.allSettled(
        products.map((p) =>
          fetch(`https://api.coinbase.com/api/v3/brokerage/products/${p}`).then(
            (r) => r.json() as Promise<CoinbaseProduct>,
          ),
        ),
      );

      this.updateState({ bootstrapProgress: 60 });

      let i = 0;
      for (const result of results) {
        if (result.status === "fulfilled") {
          const product = result.value;
          const asset = this._productToAsset(product.product_id);
          if (asset) {
            const snapshot = this._productToSnapshot(asset, product);
            onSnapshot(snapshot);
          }
        }
        this.updateState({
          bootstrapProgress: 60 + Math.round((++i / products.length) * 40),
        });
      }

      this.updateState({
        bootstrapProgress: 100,
        bootstrapComplete: true,
        status: "CONNECTED",
        lastUpdateAt: Date.now(),
        runtimeTrustContribution: 100,
        lastError: null,
      });
    } catch (err) {
      this.updateState({
        status: "ERROR",
        lastError: err instanceof Error ? err.message : String(err),
        runtimeTrustContribution: 0,
      });
      throw err;
    }
  }

  connect(onSnapshot: SnapshotCallback, onState: AdapterStateCallback) {
    this._onSnapshot = onSnapshot;
    this._onState = onState;

    // Coinbase Advanced Trade WebSocket
    const wsUrl = "wss://advanced-trade-ws.coinbase.com";
    this.updateState({ status: "CONNECTED" });
    this._startStaleDetection();

    const ws = new WebSocket(wsUrl);
    this._ws = ws;

    ws.onopen = () => {
      this._reconnectAttempts = 0;
      this.updateState({
        status: "CONNECTED",
        lastHeartbeatAt: Date.now(),
        isHeartbeatHealthy: true,
      });
      // Subscribe to ticker channel for all products
      const subscribeMsg = {
        type: "subscribe",
        product_ids: Object.values(COINBASE_SPOT_PRODUCTS),
        channel: "ticker",
      };
      ws.send(JSON.stringify(subscribeMsg));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as CoinbaseWsMessage;
        if (msg.channel === "ticker" && msg.events) {
          for (const evt of msg.events) {
            if (evt.type === "update" && evt.tickers) {
              for (const ticker of evt.tickers) {
                const asset = this._productToAsset(ticker.product_id);
                if (!asset) continue;
                const snapshot = this._wsTickerToSnapshot(asset, ticker);
                onSnapshot(snapshot);
                this.markTick(asset);
              }
            }
          }
          this.updateState({
            lastHeartbeatAt: Date.now(),
            isHeartbeatHealthy: true,
          });
        } else if (msg.channel === "heartbeats") {
          this.updateState({
            lastHeartbeatAt: Date.now(),
            isHeartbeatHealthy: true,
          });
        }
      } catch {
        /* ignore parse errors */
      }
    };

    ws.onerror = () => {
      this.updateState({
        lastError: "WebSocket error",
        status: "ERROR",
        runtimeTrustContribution: 0,
      });
    };

    ws.onclose = (e) => {
      if (e.code !== 1000) {
        this._scheduleReconnect(onSnapshot, onState);
      } else {
        this.updateState({
          status: "DISCONNECTED",
          runtimeTrustContribution: 0,
        });
      }
    };
  }

  private _productToAsset(productId: string): string | null {
    const entry = Object.entries(COINBASE_SPOT_PRODUCTS).find(
      ([, p]) => p === productId,
    );
    return entry ? entry[0] : null;
  }

  private _productToSnapshot(
    asset: string,
    p: CoinbaseProduct,
  ): LiveMarketSnapshot {
    return {
      asset,
      market: "COINBASE_SPOT",
      symbol: p.product_id,
      price: Number.parseFloat(p.price || "0"),
      priceChange24h: Number.parseFloat(p.price_percentage_change_24h || "0"),
      priceChangePct24h: Number.parseFloat(
        p.price_percentage_change_24h || "0",
      ),
      volume24h: Number.parseFloat(p.volume_24h || "0"),
      high24h: 0, // Not available in product REST response
      low24h: 0,
      openInterest: null,
      fundingRate: null,
      receivedAt: Date.now(),
      sequenceId: ++this._sequenceCounter,
    };
  }

  private _wsTickerToSnapshot(
    asset: string,
    t: CoinbaseWsTicker,
  ): LiveMarketSnapshot {
    return {
      asset,
      market: "COINBASE_SPOT",
      symbol: t.product_id,
      price: Number.parseFloat(t.price || "0"),
      priceChange24h: Number.parseFloat(t.price_percent_chg_24h || "0"),
      priceChangePct24h: Number.parseFloat(t.price_percent_chg_24h || "0"),
      volume24h: Number.parseFloat(t.volume_24_h || "0"),
      high24h: Number.parseFloat(t.high_24_h || "0"),
      low24h: Number.parseFloat(t.low_24_h || "0"),
      openInterest: null,
      fundingRate: null,
      receivedAt: Date.now(),
      sequenceId: ++this._sequenceCounter,
    };
  }
}

// ─── Exchange-specific raw type helpers ───────────────────────────────────────
// These are internal to liveAdapter.ts. Do not export.

type BinanceTicker = {
  symbol?: string;
  s?: string; // WS stream field
  lastPrice?: string;
  c?: string; // WS stream field
  priceChange?: string;
  priceChangePercent?: string;
  quoteVolume?: string;
  q?: string; // WS stream field
  highPrice?: string;
  h?: string; // WS stream field
  lowPrice?: string;
  l?: string; // WS stream field
};

type CoinbaseProduct = {
  product_id: string;
  price: string;
  price_percentage_change_24h: string;
  volume_24h: string;
};

type CoinbaseWsTicker = {
  product_id: string;
  price: string;
  price_percent_chg_24h: string;
  volume_24_h: string;
  high_24_h: string;
  low_24_h: string;
};

type CoinbaseWsMessage = {
  channel: string;
  events?: Array<{
    type: string;
    tickers?: CoinbaseWsTicker[];
  }>;
};

// ─── Adapter factory ───────────────────────────────────────────────────────────

export function createAdapters(): {
  binanceSpot: BinanceSpotAdapter;
  binanceFutures: BinanceFuturesAdapter;
  coinbaseSpot: CoinbaseSpotAdapter;
} {
  return {
    binanceSpot: new BinanceSpotAdapter(),
    binanceFutures: new BinanceFuturesAdapter(),
    coinbaseSpot: new CoinbaseSpotAdapter(),
  };
}

export { CANONICAL_ASSETS };
