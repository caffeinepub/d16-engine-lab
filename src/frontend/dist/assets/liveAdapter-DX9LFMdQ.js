var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { m as makeInitialAdapterState, S as STALE_THRESHOLD_MS, R as RECONNECT_DELAY_MS } from "./index-B3Quswfl.js";
const BINANCE_SPOT_SYMBOLS = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  DOGE: "DOGEUSDT",
  ADA: "ADAUSDT",
  LINK: "LINKUSDT",
  AVAX: "AVAXUSDT"
};
const BINANCE_FUTURES_SYMBOLS = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  DOGE: "DOGEUSDT",
  ADA: "ADAUSDT",
  LINK: "LINKUSDT",
  AVAX: "AVAXUSDT"
};
const COINBASE_SPOT_PRODUCTS = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
  XRP: "XRP-USD",
  DOGE: "DOGE-USD",
  ADA: "ADA-USD",
  LINK: "LINK-USD",
  AVAX: "AVAX-USD"
};
class BaseAdapter {
  constructor() {
    __publicField(this, "_state");
    __publicField(this, "_ws", null);
    __publicField(this, "_staleTimer", null);
    __publicField(this, "_reconnectTimer", null);
    __publicField(this, "_onSnapshot", null);
    __publicField(this, "_onState", null);
    __publicField(this, "_sequenceCounter", 0);
    __publicField(this, "_reconnectAttempts", 0);
    this._state = makeInitialAdapterState(this.getMarketId());
  }
  get state() {
    return this._state;
  }
  getState() {
    return this._state;
  }
  updateState(patch) {
    var _a;
    this._state = { ...this._state, ...patch };
    (_a = this._onState) == null ? void 0 : _a.call(this, this._state);
  }
  markTick(_asset) {
    const now = Date.now();
    this.updateState({
      lastUpdateAt: now,
      isStale: false,
      totalTicksReceived: this._state.totalTicksReceived + 1,
      runtimeTrustContribution: this._computeTrust()
    });
  }
  _computeTrust() {
    const s = this._state;
    if (s.status === "DISCONNECTED" || s.status === "ERROR") return 0;
    if (s.status === "RECONNECTING") return 10;
    if (s.isStale) return 30;
    if (s.status === "BOOTSTRAPPING")
      return Math.round(s.bootstrapProgress * 0.5);
    if (!s.bootstrapComplete) return 40;
    const penalty = Math.min(s.reconnectCount * 5, 30);
    return Math.max(100 - penalty, 70);
  }
  _startStaleDetection() {
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
            10
          )
        });
      }
    }, 5e3);
  }
  _stopTimers() {
    if (this._staleTimer) {
      clearInterval(this._staleTimer);
      this._staleTimer = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }
  _scheduleReconnect(onSnapshot, onState) {
    this._reconnectAttempts++;
    const delay = Math.min(
      RECONNECT_DELAY_MS * this._reconnectAttempts,
      3e4
    );
    this.updateState({
      status: "RECONNECTING",
      reconnectCount: this._state.reconnectCount + 1,
      runtimeTrustContribution: 10
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
      }
      this._ws = null;
    }
    this.updateState({
      status: "DISCONNECTED",
      isStale: false,
      runtimeTrustContribution: 0
    });
  }
}
class BinanceSpotAdapter extends BaseAdapter {
  constructor() {
    super(...arguments);
    __publicField(this, "marketId", "BINANCE_SPOT");
  }
  getMarketId() {
    return "BINANCE_SPOT";
  }
  async bootstrap(onSnapshot, onState) {
    this._onSnapshot = onSnapshot;
    this._onState = onState;
    this.updateState({
      status: "BOOTSTRAPPING",
      bootstrapProgress: 0,
      bootstrapStartedAt: Date.now()
    });
    const symbols = Object.values(BINANCE_SPOT_SYMBOLS);
    try {
      const symbolsParam = encodeURIComponent(JSON.stringify(symbols));
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`;
      const resp = await fetch(url);
      if (!resp.ok)
        throw new Error(`Binance Spot bootstrap HTTP ${resp.status}`);
      const tickers = await resp.json();
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
        lastError: null
      });
    } catch (err) {
      this.updateState({
        status: "ERROR",
        lastError: err instanceof Error ? err.message : String(err),
        runtimeTrustContribution: 0
      });
      throw err;
    }
  }
  connect(onSnapshot, onState) {
    this._onSnapshot = onSnapshot;
    this._onState = onState;
    const streams = Object.values(BINANCE_SPOT_SYMBOLS).map((s) => `${s.toLowerCase()}@ticker`).join("/");
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
        isHeartbeatHealthy: true
      });
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const ticker = msg.data;
        if (!(ticker == null ? void 0 : ticker.s)) return;
        const asset = this._symbolToAsset(ticker.s);
        if (!asset) return;
        const snapshot = this._tickerToSnapshot(asset, ticker);
        onSnapshot(snapshot);
        this.markTick(asset);
        this.updateState({
          lastHeartbeatAt: Date.now(),
          isHeartbeatHealthy: true
        });
      } catch {
      }
    };
    ws.onerror = () => {
      this.updateState({
        lastError: "WebSocket error",
        status: "ERROR",
        runtimeTrustContribution: 0
      });
    };
    ws.onclose = (e) => {
      if (e.code !== 1e3) {
        this._scheduleReconnect(onSnapshot, onState);
      } else {
        this.updateState({
          status: "DISCONNECTED",
          runtimeTrustContribution: 0
        });
      }
    };
  }
  _symbolToAsset(symbol) {
    const entry = Object.entries(BINANCE_SPOT_SYMBOLS).find(
      ([, sym]) => sym === symbol
    );
    return entry ? entry[0] : null;
  }
  _tickerToSnapshot(asset, t) {
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
      sequenceId: ++this._sequenceCounter
    };
  }
}
class BinanceFuturesAdapter extends BaseAdapter {
  constructor() {
    super(...arguments);
    __publicField(this, "marketId", "BINANCE_FUTURES");
    __publicField(this, "_openInterestMap", /* @__PURE__ */ new Map());
    __publicField(this, "_fundingRateMap", /* @__PURE__ */ new Map());
  }
  getMarketId() {
    return "BINANCE_FUTURES";
  }
  async bootstrap(onSnapshot, onState) {
    this._onSnapshot = onSnapshot;
    this._onState = onState;
    this.updateState({
      status: "BOOTSTRAPPING",
      bootstrapProgress: 0,
      bootstrapStartedAt: Date.now()
    });
    const symbols = Object.values(BINANCE_FUTURES_SYMBOLS);
    try {
      const symbolsParam = encodeURIComponent(JSON.stringify(symbols));
      const tickerResp = await fetch(
        `https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${symbolsParam}`
      );
      if (!tickerResp.ok)
        throw new Error(`Binance Futures bootstrap HTTP ${tickerResp.status}`);
      const tickers = await tickerResp.json();
      this.updateState({ bootstrapProgress: 30 });
      const oiResults = await Promise.allSettled(
        symbols.map(
          (s) => fetch(
            `https://fapi.binance.com/fapi/v1/openInterest?symbol=${s}`
          ).then(
            (r) => r.json()
          )
        )
      );
      for (const r of oiResults) {
        if (r.status === "fulfilled" && r.value.symbol) {
          this._openInterestMap.set(
            r.value.symbol,
            Number.parseFloat(r.value.openInterest || "0")
          );
        }
      }
      this.updateState({ bootstrapProgress: 60 });
      const frResp = await fetch(
        "https://fapi.binance.com/fapi/v1/premiumIndex"
      );
      if (frResp.ok) {
        const frData = await frResp.json();
        for (const fr of frData) {
          if (symbols.includes(fr.symbol)) {
            this._fundingRateMap.set(
              fr.symbol,
              Number.parseFloat(fr.lastFundingRate || "0")
            );
          }
        }
      }
      this.updateState({ bootstrapProgress: 80 });
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
        lastError: null
      });
    } catch (err) {
      this.updateState({
        status: "ERROR",
        lastError: err instanceof Error ? err.message : String(err),
        runtimeTrustContribution: 0
      });
      throw err;
    }
  }
  connect(onSnapshot, onState) {
    this._onSnapshot = onSnapshot;
    this._onState = onState;
    const streams = Object.values(BINANCE_FUTURES_SYMBOLS).map((s) => `${s.toLowerCase()}@ticker`).join("/");
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
        isHeartbeatHealthy: true
      });
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const ticker = msg.data;
        if (!(ticker == null ? void 0 : ticker.s)) return;
        const asset = this._symbolToAsset(ticker.s);
        if (!asset) return;
        const snapshot = this._tickerToSnapshot(asset, ticker);
        onSnapshot(snapshot);
        this.markTick(asset);
        this.updateState({
          lastHeartbeatAt: Date.now(),
          isHeartbeatHealthy: true
        });
      } catch {
      }
    };
    ws.onerror = () => {
      this.updateState({
        lastError: "WebSocket error",
        status: "ERROR",
        runtimeTrustContribution: 0
      });
    };
    ws.onclose = (e) => {
      if (e.code !== 1e3) {
        this._scheduleReconnect(onSnapshot, onState);
      } else {
        this.updateState({
          status: "DISCONNECTED",
          runtimeTrustContribution: 0
        });
      }
    };
  }
  _symbolToAsset(symbol) {
    const entry = Object.entries(BINANCE_FUTURES_SYMBOLS).find(
      ([, sym]) => sym === symbol
    );
    return entry ? entry[0] : null;
  }
  _tickerToSnapshot(asset, t) {
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
      sequenceId: ++this._sequenceCounter
    };
  }
}
class CoinbaseSpotAdapter extends BaseAdapter {
  constructor() {
    super(...arguments);
    __publicField(this, "marketId", "COINBASE_SPOT");
    // Channel subscription is per-product
    __publicField(this, "_subscriptionMap", /* @__PURE__ */ new Map());
  }
  // asset -> product_id
  getMarketId() {
    return "COINBASE_SPOT";
  }
  async bootstrap(onSnapshot, onState) {
    this._onSnapshot = onSnapshot;
    this._onState = onState;
    this.updateState({
      status: "BOOTSTRAPPING",
      bootstrapProgress: 0,
      bootstrapStartedAt: Date.now()
    });
    try {
      const products = Object.values(COINBASE_SPOT_PRODUCTS);
      const results = await Promise.allSettled(
        products.map(
          (p) => fetch(`https://api.coinbase.com/api/v3/brokerage/products/${p}`).then(
            (r) => r.json()
          )
        )
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
          bootstrapProgress: 60 + Math.round(++i / products.length * 40)
        });
      }
      this.updateState({
        bootstrapProgress: 100,
        bootstrapComplete: true,
        status: "CONNECTED",
        lastUpdateAt: Date.now(),
        runtimeTrustContribution: 100,
        lastError: null
      });
    } catch (err) {
      this.updateState({
        status: "ERROR",
        lastError: err instanceof Error ? err.message : String(err),
        runtimeTrustContribution: 0
      });
      throw err;
    }
  }
  connect(onSnapshot, onState) {
    this._onSnapshot = onSnapshot;
    this._onState = onState;
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
        isHeartbeatHealthy: true
      });
      const subscribeMsg = {
        type: "subscribe",
        product_ids: Object.values(COINBASE_SPOT_PRODUCTS),
        channel: "ticker"
      };
      ws.send(JSON.stringify(subscribeMsg));
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
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
            isHeartbeatHealthy: true
          });
        } else if (msg.channel === "heartbeats") {
          this.updateState({
            lastHeartbeatAt: Date.now(),
            isHeartbeatHealthy: true
          });
        }
      } catch {
      }
    };
    ws.onerror = () => {
      this.updateState({
        lastError: "WebSocket error",
        status: "ERROR",
        runtimeTrustContribution: 0
      });
    };
    ws.onclose = (e) => {
      if (e.code !== 1e3) {
        this._scheduleReconnect(onSnapshot, onState);
      } else {
        this.updateState({
          status: "DISCONNECTED",
          runtimeTrustContribution: 0
        });
      }
    };
  }
  _productToAsset(productId) {
    const entry = Object.entries(COINBASE_SPOT_PRODUCTS).find(
      ([, p]) => p === productId
    );
    return entry ? entry[0] : null;
  }
  _productToSnapshot(asset, p) {
    return {
      asset,
      market: "COINBASE_SPOT",
      symbol: p.product_id,
      price: Number.parseFloat(p.price || "0"),
      priceChange24h: Number.parseFloat(p.price_percentage_change_24h || "0"),
      priceChangePct24h: Number.parseFloat(
        p.price_percentage_change_24h || "0"
      ),
      volume24h: Number.parseFloat(p.volume_24h || "0"),
      high24h: 0,
      // Not available in product REST response
      low24h: 0,
      openInterest: null,
      fundingRate: null,
      receivedAt: Date.now(),
      sequenceId: ++this._sequenceCounter
    };
  }
  _wsTickerToSnapshot(asset, t) {
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
      sequenceId: ++this._sequenceCounter
    };
  }
}
function createAdapters() {
  return {
    binanceSpot: new BinanceSpotAdapter(),
    binanceFutures: new BinanceFuturesAdapter(),
    coinbaseSpot: new CoinbaseSpotAdapter()
  };
}
export {
  BinanceFuturesAdapter,
  BinanceSpotAdapter,
  CoinbaseSpotAdapter,
  createAdapters
};
