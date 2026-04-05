// D16 Hybrid Branch — Hybrid Detail Inspector
// Phase H9 + v0.7.1 Mobile Adaptation

import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  HybridAssetBundle,
  MarketExecutionPermission,
  MarketMaturity,
  MarketTrustClass,
  PerMarketState,
} from "../hybridTypes";
import {
  DirectionMini,
  DivergenceBadge,
  HybridPermBadge,
  MaturityMini,
  TrustDot,
} from "./HybridDashboard";

type HybridDetailInspectorProps = {
  bundle: HybridAssetBundle | null;
  allBundles: HybridAssetBundle[];
  onSelectAsset: (asset: string) => void;
};

// ─── Sub-components ────────────────────────────────────────────────

function MetricBar({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  const color =
    value >= 75
      ? "#22C55E"
      : value >= 60
        ? "#67E8F9"
        : value >= 40
          ? "#FACC15"
          : "#EF4444";
  return (
    <div
      className={`space-y-1 ${accent ? "bg-secondary/30 p-3 rounded border border-border" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[11px] font-mono font-bold" style={{ color }}>
          {Math.round(value)}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full"
        style={{ background: "oklch(0.21 0.009 240)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

function ExecBadge({ perm }: { perm: MarketExecutionPermission }) {
  const MAP: Record<MarketExecutionPermission, string> = {
    NO_PLAN: "text-[#9AA3AD] bg-[#1a1010] border-[#2A3038]",
    PROJECTED_ONLY: "text-[#FACC15] bg-[#1a1a10] border-[#3a3010]",
    PROVISIONAL_PLAN: "text-[#67E8F9] bg-[#102020] border-[#104040]",
    EXACT_PLAN: "text-[#22C55E] bg-[#052010] border-[#0f5030]",
    LIVE_MANAGEMENT: "text-[#10b981] bg-[#051a10] border-[#0f4030]",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono border ${MAP[perm]}`}
    >
      {perm.replace(/_/g, " ")}
    </span>
  );
}

function TrustBadge({ trust }: { trust: MarketTrustClass }) {
  const MAP: Record<MarketTrustClass, string> = {
    HIGH_TRUST: "text-[#22C55E]",
    GOOD_TRUST: "text-[#86EFAC]",
    REDUCED_TRUST: "text-[#FACC15]",
    LOW_TRUST: "text-[#F87171]",
    INVALID_RUNTIME: "text-[#EF4444]",
  };
  return (
    <span className={`text-[9px] font-mono font-medium ${MAP[trust]}`}>
      {trust.replace(/_/g, " ")}
    </span>
  );
}

function MaturityBadgeFull({ maturity }: { maturity: MarketMaturity }) {
  const COLORS: Record<MarketMaturity, string> = {
    EARLY: "bg-[#1a1a2e] text-[#9AA3AD] border-[#2A3038]",
    BREWING: "bg-[#1a1a2e] text-[#6B8FBF] border-[#2a3a54]",
    FORMING: "bg-[#1a2530] text-[#5B9BD5] border-[#2a4060]",
    ACTIVE: "bg-[#0d2540] text-[#4DA6FF] border-[#1a4080]",
    ARMED: "bg-[#1a2a10] text-[#86EFAC] border-[#2a5020]",
    READY: "bg-[#0d2010] text-[#22C55E] border-[#1a5020]",
    LIVE: "bg-[#052010] text-[#10b981] border-[#0f5030]",
    DECAY: "bg-[#2a1a00] text-[#FACC15] border-[#4a3000]",
    CANCELLED: "bg-[#200a0a] text-[#EF4444] border-[#4a1010]",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono border font-medium ${COLORS[maturity]}`}
    >
      {maturity}
    </span>
  );
}

function MarketCard({
  label,
  market,
}: {
  label: string;
  market: PerMarketState | null;
}) {
  if (!market) {
    return (
      <div className="bg-card border border-border rounded p-4">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {label}
        </div>
        <div className="text-[10px] text-muted-foreground">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded p-4 space-y-3">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </div>

      {/* Direction + Maturity */}
      <div className="flex items-center gap-2 flex-wrap">
        <DirectionMini direction={market.direction} />
        <MaturityBadgeFull maturity={market.maturity} />
      </div>

      {/* Trust + Execution */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <TrustDot trust={market.trustClass} />
          <TrustBadge trust={market.trustClass} />
        </div>
        <ExecBadge perm={market.executionPermission} />
      </div>

      {/* Score bars */}
      <div className="space-y-2">
        <MetricBar label="Structural" value={market.structuralScore} />
        <MetricBar label="Activation" value={market.activationScore} />
        <MetricBar label="Entry Ready" value={market.entryReadiness} />
        <MetricBar label="Runtime Trust" value={market.runtimeTrust} />
      </div>

      {/* Blocker */}
      {market.mainBlocker && (
        <div className="bg-[#1a0a0a] border border-[#3a1010] rounded px-2 py-1.5">
          <p className="text-[9px] text-[#F87171] font-mono">
            ■ {market.mainBlocker}
          </p>
        </div>
      )}
    </div>
  );
}

function LeadMarketLabel({ market }: { market: string }) {
  const MAP: Record<string, string> = {
    BINANCE_FUTURES: "Binance Futures",
    BINANCE_SPOT: "Binance Spot",
    COINBASE_SPOT: "Coinbase Spot",
    NONE: "—",
    MULTIPLE: "Multiple",
  };
  const color =
    market === "BINANCE_FUTURES"
      ? "#67E8F9"
      : market === "BINANCE_SPOT" || market === "COINBASE_SPOT"
        ? "#86EFAC"
        : market === "MULTIPLE"
          ? "#FACC15"
          : "#9AA3AD";
  return (
    <span className="text-[11px] font-mono font-bold" style={{ color }}>
      {MAP[market] ?? market}
    </span>
  );
}

function EntryClassBadge({ cls }: { cls: string }) {
  const MAP: Record<string, string> = {
    NONE: "text-[#9AA3AD] bg-[#1a1a2e] border-[#2A3038]",
    BREAKOUT: "text-[#22C55E] bg-[#052010] border-[#0f5030]",
    RECLAIM: "text-[#67E8F9] bg-[#0d2540] border-[#1a4080]",
    PULLBACK: "text-[#FACC15] bg-[#1a1a10] border-[#3a3010]",
    CONTINUATION: "text-[#10b981] bg-[#051a10] border-[#0f4030]",
    REVERSAL: "text-[#FB923C] bg-[#1a0a00] border-[#3a2000]",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-mono border font-bold ${MAP[cls] ?? MAP.NONE}`}
    >
      {cls}
    </span>
  );
}

function PermissionBadgeFull({ level }: { level: string }) {
  const MAP: Record<string, string> = {
    EXACT: "bg-[#052010] text-[#22C55E] border-[#0f5030]",
    PROVISIONAL: "bg-[#0d2540] text-[#67E8F9] border-[#1a4080]",
    PROJECTED_ONLY: "bg-[#0d1a40] text-[#93C5FD] border-[#1a3080]",
    WATCH_ONLY: "bg-[#1a1a10] text-[#FACC15] border-[#3a3010]",
    BLOCKED: "bg-[#200a0a] text-[#EF4444] border-[#4a1010]",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1.5 rounded text-[12px] font-mono border font-bold ${MAP[level] ?? MAP.BLOCKED}`}
    >
      {level}
    </span>
  );
}

// ─── Main Inspector ───────────────────────────────────────────────────

export function HybridDetailInspector({
  bundle,
  allBundles,
  onSelectAsset,
}: HybridDetailInspectorProps) {
  if (!bundle) {
    return (
      <div
        className="flex items-center justify-center h-full text-muted-foreground text-sm"
        data-ocid="hybrid.inspector.empty_state"
      >
        Select an asset to inspect
      </div>
    );
  }

  const { assetState, correlation, entry } = bundle;

  return (
    <div className="flex flex-col h-full" data-ocid="hybrid.inspector.panel">
      {/* Asset selector — horizontally scrollable on mobile */}
      <div className="flex-shrink-0 px-3 md:px-5 py-2.5 border-b border-border bg-background/60 overflow-x-auto">
        <div className="flex items-center gap-2 flex-nowrap min-w-max">
          {allBundles.map((b) => (
            <button
              type="button"
              key={b.assetState.asset}
              onClick={() => onSelectAsset(b.assetState.asset)}
              className={`px-2.5 py-1.5 text-[10px] font-mono rounded transition-colors min-h-[36px] ${
                b.assetState.asset === assetState.asset
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30 border border-transparent"
              }`}
              data-ocid="hybrid.inspector.asset.tab"
            >
              {b.assetState.asset}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 md:px-5 py-4 space-y-5">
          {/* 1. Asset Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-mono font-bold text-foreground">
                {assetState.asset}
              </span>
              <HybridPermBadge perm={correlation.hybridPermission} />
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">
              Cross-market:{" "}
              <span className="text-foreground font-bold">
                {Math.round(correlation.crossMarketConfirmation)}%
              </span>
            </div>
          </div>

          {/* 2. Per-Market State Panel */}
          <section>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Per-Market State
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <MarketCard
                label="Binance Spot"
                market={assetState.binanceSpot}
              />
              <MarketCard
                label="Coinbase Spot"
                market={assetState.coinbaseSpot}
              />
              <MarketCard
                label="Binance Futures"
                market={assetState.binanceFutures}
              />
            </div>
          </section>

          {/* 3. Agreement Metrics */}
          <section>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Agreement Metrics
            </h3>
            <div className="bg-card border border-border rounded p-4 space-y-3">
              <MetricBar
                label="Direction Agreement"
                value={correlation.directionAgreement}
              />
              <MetricBar
                label="Maturity Agreement"
                value={correlation.maturityAgreement}
              />
              <MetricBar
                label="Trust Agreement"
                value={correlation.trustAgreement}
              />
              <MetricBar
                label="Structural Confirmation"
                value={correlation.structuralConfirmation}
              />
              <div className="pt-2 border-t border-border">
                <MetricBar
                  label="Cross-Market Confirmation (Composite)"
                  value={correlation.crossMarketConfirmation}
                  accent
                />
              </div>
            </div>
          </section>

          {/* 4. Lead/Lag + Divergence */}
          <section>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Lead / Lag + Divergence
            </h3>
            <div className="bg-card border border-border rounded p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                    Lead Market
                  </div>
                  <LeadMarketLabel market={correlation.leadMarket} />
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                    Lagging Market
                  </div>
                  <LeadMarketLabel market={correlation.laggingMarket} />
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                    Divergence
                  </div>
                  <DivergenceBadge type={correlation.divergenceType} />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground">
                  <span className="text-[#67E8F9] font-mono">Lead: </span>
                  {correlation.leadReason}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  <span className="text-[#FACC15] font-mono">Lag: </span>
                  {correlation.lagReason}
                </p>
              </div>
            </div>
          </section>

          {/* 5. Hybrid Resolution */}
          <section>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Hybrid Resolution
            </h3>
            <div className="bg-card border border-border rounded p-4 space-y-3">
              <HybridPermBadge perm={correlation.hybridPermission} />
              {correlation.mainBlocker && (
                <div className="bg-[#1a0a0a] border border-[#3a1010] rounded px-3 py-2">
                  <p className="text-[10px] font-mono text-[#F87171]">
                    ■ {correlation.mainBlocker}
                  </p>
                </div>
              )}
              {correlation.nextUnlockCondition && (
                <div className="bg-[#0a1a2a] border border-[#1a3060] rounded px-3 py-2 flex items-start gap-2">
                  <span className="text-[#67E8F9] mt-0.5">&#8593;</span>
                  <p className="text-[10px] font-mono text-[#67E8F9]">
                    {correlation.nextUnlockCondition}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 6. Entry Engine Output */}
          <section>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Entry Engine Output
            </h3>
            <div className="bg-card border border-border rounded p-4 space-y-4">
              {/* Top row: permitted + side + class */}
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                    Permitted
                  </div>
                  <span
                    className={`text-[12px] font-mono font-bold ${
                      entry.permitted ? "text-[#22C55E]" : "text-[#EF4444]"
                    }`}
                  >
                    {entry.permitted ? "YES" : "NO"}
                  </span>
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                    Side
                  </div>
                  <DirectionMini
                    direction={
                      entry.side === "LONG"
                        ? "LONG"
                        : entry.side === "SHORT"
                          ? "SHORT"
                          : "NEUTRAL"
                    }
                  />
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                    Entry Class
                  </div>
                  <EntryClassBadge cls={entry.entryClass} />
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                    Permission
                  </div>
                  <PermissionBadgeFull level={entry.permissionLevel} />
                </div>
              </div>

              {/* Score bars — stack on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <MetricBar
                  label="Confirmation"
                  value={entry.confirmationStrength}
                />
                <MetricBar
                  label="Invalidation Clarity"
                  value={entry.invalidationClarity}
                />
                <MetricBar
                  label="Reward Feasibility"
                  value={entry.rewardFeasibility}
                />
              </div>

              {/* Markets — stack on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                    Strongest Confirming
                  </div>
                  <LeadMarketLabel market={entry.strongestConfirmingMarket} />
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">
                    Lagging / Blocking
                  </div>
                  <LeadMarketLabel market={entry.laggingOrBlockingMarket} />
                </div>
              </div>

              {/* Reasoning summary */}
              <div className="bg-secondary/30 border border-border rounded px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground italic">
                  {entry.reasoningSummary}
                </p>
              </div>

              {/* Blocker / Unlock */}
              {entry.mainBlocker && (
                <div className="bg-[#1a0a0a] border border-[#3a1010] rounded px-3 py-2">
                  <p className="text-[10px] font-mono text-[#F87171]">
                    ■ {entry.mainBlocker}
                  </p>
                </div>
              )}
              {entry.nextUnlockCondition && (
                <div className="bg-[#0a1a2a] border border-[#1a3060] rounded px-3 py-2">
                  <p className="text-[10px] font-mono text-[#67E8F9]">
                    &#8593; {entry.nextUnlockCondition}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
