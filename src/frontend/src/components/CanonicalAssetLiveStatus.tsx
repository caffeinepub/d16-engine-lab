// D16 Hybrid v0.6 — Canonical Asset Live Status
// Per-asset hydration and trust impact grid.
// Shows: Binance Spot/Futures/Coinbase ready, hybrid-ready, trust impact.

import type { AssetHydrationState, RuntimeState } from "../liveAdapterTypes";

type Props = {
  runtimeState: RuntimeState;
};

const CANONICAL_ASSETS = [
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "DOGE",
  "ADA",
  "LINK",
  "AVAX",
];

const TRUST_IMPACT_COLOR: Record<string, string> = {
  FULL: "#22C55E",
  REDUCED: "#FACC15",
  PARTIAL: "#F97316",
  BLOCKED: "#EF4444",
};

const TRUST_IMPACT_BG: Record<string, string> = {
  FULL: "bg-[#052010] border-[#0f5030]",
  REDUCED: "bg-[#1a1400] border-[#40340a]",
  PARTIAL: "bg-[#1a0d00] border-[#401800]",
  BLOCKED: "bg-[#1a0505] border-[#401010]",
};

function ReadyFlag({ ready, label }: { ready: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          ready ? "bg-[#22C55E]" : "bg-[#EF4444]/60"
        }`}
      />
      <span
        className={`text-[9px] font-mono ${
          ready ? "text-muted-foreground" : "text-[#EF4444]/70"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function AssetRow({ hydration }: { hydration: AssetHydrationState }) {
  const trustColor =
    TRUST_IMPACT_COLOR[hydration.hybridTrustImpact] ?? "#9AA3AD";
  const trustBg =
    TRUST_IMPACT_BG[hydration.hybridTrustImpact] ?? "bg-card border-border";

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded hover:border-border/80 transition-colors overflow-x-auto">
      {/* Asset name */}
      <span className="w-10 text-[11px] font-mono font-bold text-foreground flex-shrink-0">
        {hydration.asset}
      </span>

      {/* Market ready flags */}
      <div className="flex items-center gap-3 flex-1">
        <ReadyFlag ready={hydration.binanceSpotHydrated} label="BS" />
        <ReadyFlag ready={hydration.binanceFuturesHydrated} label="BF" />
        <ReadyFlag ready={hydration.coinbaseSpotHydrated} label="CB" />
      </div>

      {/* Hybrid ready */}
      <div className="flex items-center gap-1">
        <span
          className={`w-2 h-2 rounded-sm ${
            hydration.hybridReady ? "bg-[#22C55E]" : "bg-muted/40"
          }`}
        />
        <span
          className={`text-[9px] font-mono font-semibold ${
            hydration.hybridReady
              ? "text-[#22C55E]"
              : "text-muted-foreground/50"
          }`}
        >
          {hydration.hybridReady ? "HYBRID OK" : "NOT READY"}
        </span>
      </div>

      {/* Trust impact */}
      <div
        className={`px-2 py-0.5 rounded border text-[9px] font-mono font-semibold ${trustBg}`}
        style={{ color: trustColor }}
      >
        {hydration.hybridTrustImpact}
      </div>

      {/* Missing markets */}
      {hydration.missingMarkets.length > 0 && (
        <div className="flex items-center gap-1">
          {hydration.missingMarkets.map((m) => (
            <span
              key={m}
              className="text-[8px] font-mono text-[#EF4444]/60 bg-[#1a0505] border border-[#401010] px-1.5 py-0.5 rounded"
            >
              {m === "BINANCE_SPOT"
                ? "BS"
                : m === "BINANCE_FUTURES"
                  ? "BF"
                  : "CB"}{" "}
              MISSING
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function CanonicalAssetLiveStatus({ runtimeState }: Props) {
  const hydratedCount = CANONICAL_ASSETS.filter(
    (a) => runtimeState.assets[a]?.hybridReady,
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
          Canonical Asset Live Status
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono text-muted-foreground/50">
            <span className="text-[#22C55E] font-semibold">
              {hydratedCount}
            </span>
            /{CANONICAL_ASSETS.length} hybrid-ready
          </span>
          <span className="text-[8px] font-mono text-muted-foreground/30">
            BS=Binance Spot · BF=Binance Futures · CB=Coinbase
          </span>
        </div>
      </div>
      <div className="space-y-1">
        {CANONICAL_ASSETS.map((asset) => {
          const hydration = runtimeState.assets[asset];
          if (!hydration) return null;
          return <AssetRow key={asset} hydration={hydration} />;
        })}
      </div>
    </div>
  );
}
