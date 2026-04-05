// D16 Hybrid v0.8 — Universe Discovery
// Fetches full tradable universe from Binance Spot, Binance Futures, Coinbase Spot.
// Normalizes all symbols to canonical asset IDs.
// Output: Map<canonicalAssetId, UniverseAsset>

import type { UniverseAsset } from "./universeTypes";

// ─── Symbol normalization ─────────────────────────────────────────────────────────────
// Strip quote currency from Binance USDT/BUSD/USDC/BTC/ETH/BNB pairs.
// Return null if the pair does not match a clean canonical base.

const BINANCE_QUOTE_CURRENCIES = [
  "USDT",
  "USDC",
  "BUSD",
  "TUSD",
  "DAI",
  "FDUSD",
  "BNB",
  "BTC",
  "ETH",
  "EUR",
  "GBP",
  "TRY",
  "AUD",
  "BRL",
];

// Symbols that look valid but are not directional crypto assets
const EXCLUDED_BASE_SYMBOLS = new Set([
  "USDC",
  "USDT",
  "BUSD",
  "TUSD",
  "DAI",
  "FDUSD",
  "USDP",
  "PAXG", // gold-backed
  "WBTC", // wrapped
]);

export function normalizeBinanceSymbol(symbol: string): string | null {
  for (const quote of BINANCE_QUOTE_CURRENCIES) {
    if (symbol.endsWith(quote)) {
      const base = symbol.slice(0, -quote.length);
      if (
        base.length >= 2 &&
        base.length <= 12 &&
        !EXCLUDED_BASE_SYMBOLS.has(base)
      ) {
        return base;
      }
    }
  }
  return null;
}

export function normalizeCoinbaseProduct(productId: string): string | null {
  // Format: BASE-QUOTE (e.g. BTC-USD, ETH-EUR)
  const parts = productId.split("-");
  if (parts.length !== 2) return null;
  const base = parts[0];
  if (
    base.length >= 2 &&
    base.length <= 12 &&
    !EXCLUDED_BASE_SYMBOLS.has(base)
  ) {
    return base;
  }
  return null;
}

// ─── Binance Spot Discovery ──────────────────────────────────────────────────────────
// Returns: Map<canonicalAsset, { symbol, volume24hUsd }>

type BinanceTickerItem = {
  symbol: string;
  quoteVolume: string; // USDT volume
  lastPrice: string;
};

type BinanceSpotDiscovered = {
  usdtSymbol: string; // e.g. BTCUSDT
  volume24hUsd: number;
};

export async function discoverBinanceSpot(): Promise<
  Map<string, BinanceSpotDiscovered>
> {
  const result = new Map<string, BinanceSpotDiscovered>();
  try {
    const resp = await fetch("https://api.binance.com/api/v3/ticker/24hr", {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`Binance Spot ticker HTTP ${resp.status}`);
    const data: BinanceTickerItem[] = await resp.json();
    for (const item of data) {
      // Only consider USDT pairs for USD-equivalent volume
      if (!item.symbol.endsWith("USDT")) continue;
      const canonical = normalizeBinanceSymbol(item.symbol);
      if (!canonical) continue;
      const volume = Number.parseFloat(item.quoteVolume);
      if (!Number.isFinite(volume) || volume <= 0) continue;
      // Keep the highest-volume USDT pair for each canonical asset
      const existing = result.get(canonical);
      if (!existing || volume > existing.volume24hUsd) {
        result.set(canonical, {
          usdtSymbol: item.symbol,
          volume24hUsd: volume,
        });
      }
    }
  } catch (err) {
    console.warn("[D16 Universe] Binance Spot discovery failed:", err);
  }
  return result;
}

// ─── Binance Futures Discovery ────────────────────────────────────────────────────────

type BinanceFuturesTickerItem = {
  symbol: string;
  quoteVolume: string;
};

type BinanceFuturesDiscovered = {
  usdtSymbol: string;
  volume24hUsd: number;
};

export async function discoverBinanceFutures(): Promise<
  Map<string, BinanceFuturesDiscovered>
> {
  const result = new Map<string, BinanceFuturesDiscovered>();
  try {
    const resp = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr", {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) throw new Error(`Binance Futures ticker HTTP ${resp.status}`);
    const data: BinanceFuturesTickerItem[] = await resp.json();
    for (const item of data) {
      if (!item.symbol.endsWith("USDT")) continue;
      const canonical = normalizeBinanceSymbol(item.symbol);
      if (!canonical) continue;
      const volume = Number.parseFloat(item.quoteVolume);
      if (!Number.isFinite(volume) || volume <= 0) continue;
      const existing = result.get(canonical);
      if (!existing || volume > existing.volume24hUsd) {
        result.set(canonical, {
          usdtSymbol: item.symbol,
          volume24hUsd: volume,
        });
      }
    }
  } catch (err) {
    console.warn("[D16 Universe] Binance Futures discovery failed:", err);
  }
  return result;
}

// ─── Coinbase Spot Discovery ───────────────────────────────────────────────────────────

type CoinbaseProduct = {
  product_id: string;
  quote_currency_id: string;
  base_currency_id: string;
  status: string;
  volume_24h: string;
};

type CoinbaseDiscovered = {
  productId: string;
  volume24hUsd: number;
};

export async function discoverCoinbaseSpot(): Promise<
  Map<string, CoinbaseDiscovered>
> {
  const result = new Map<string, CoinbaseDiscovered>();
  try {
    const resp = await fetch(
      "https://api.coinbase.com/api/v3/brokerage/products?product_type=SPOT&limit=500",
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!resp.ok) {
      // Fallback: try public products endpoint
      const fallbackResp = await fetch(
        "https://api.exchange.coinbase.com/products",
        { signal: AbortSignal.timeout(15_000) },
      );
      if (!fallbackResp.ok)
        throw new Error(`Coinbase products HTTP ${fallbackResp.status}`);
      const products: Array<{
        id: string;
        status: string;
        base_currency: string;
        quote_currency: string;
      }> = await fallbackResp.json();
      for (const p of products) {
        if (p.status !== "online") continue;
        if (p.quote_currency !== "USD") continue;
        const canonical = normalizeCoinbaseProduct(
          `${p.base_currency}-${p.quote_currency}`,
        );
        if (!canonical) continue;
        if (!result.has(canonical)) {
          result.set(canonical, {
            productId: `${p.base_currency}-USD`,
            volume24hUsd: 0,
          });
        }
      }
      return result;
    }
    const data: { products: CoinbaseProduct[] } = await resp.json();
    for (const p of data.products) {
      if (p.status !== "online") continue;
      if (p.quote_currency_id !== "USD" && p.quote_currency_id !== "USDT")
        continue;
      const canonical = normalizeCoinbaseProduct(p.product_id);
      if (!canonical) continue;
      const volume = Number.parseFloat(p.volume_24h || "0");
      const usdVolume = p.quote_currency_id === "USD" ? volume : volume * 0.9; // rough USDT->USD
      const existing = result.get(canonical);
      if (!existing || usdVolume > existing.volume24hUsd) {
        result.set(canonical, {
          productId: p.product_id,
          volume24hUsd: usdVolume,
        });
      }
    }
  } catch (err) {
    console.warn("[D16 Universe] Coinbase discovery failed:", err);
  }
  return result;
}

// ─── Full Universe Discovery ────────────────────────────────────────────────────────────
// Merges all three sources into a single canonical universe map.

export async function discoverFullUniverse(): Promise<
  Map<string, UniverseAsset>
> {
  const now = Date.now();

  // Fetch all three sources in parallel
  const [spotMap, futuresMap, coinbaseMap] = await Promise.all([
    discoverBinanceSpot(),
    discoverBinanceFutures(),
    discoverCoinbaseSpot(),
  ]);

  // Union of all discovered canonical assets
  const allAssets = new Set<string>([
    ...spotMap.keys(),
    ...futuresMap.keys(),
    ...coinbaseMap.keys(),
  ]);

  const universe = new Map<string, UniverseAsset>();

  for (const asset of allAssets) {
    const spot = spotMap.get(asset) ?? null;
    const futures = futuresMap.get(asset) ?? null;
    const coinbase = coinbaseMap.get(asset) ?? null;

    // Determine if active: at least one market available
    const hasAnyMarket = spot !== null || futures !== null || coinbase !== null;

    universe.set(asset, {
      asset,
      binanceSpotSymbol: spot?.usdtSymbol ?? null,
      binanceFuturesSymbol: futures?.usdtSymbol ?? null,
      coinbaseSpotProduct: coinbase?.productId ?? null,
      availability: {
        binanceSpot: spot !== null,
        binanceFutures: futures !== null,
        coinbaseSpot: coinbase !== null,
      },
      discovery: {
        discoveredAt: now,
        active: hasAnyMarket,
        reasonExcluded: hasAnyMarket ? null : "No active market found",
      },
      volumeUsd: {
        binanceSpot: spot?.volume24hUsd ?? null,
        binanceFutures: futures?.volume24hUsd ?? null,
        coinbaseSpot: coinbase?.volume24hUsd ?? null,
      },
    });
  }

  return universe;
}
