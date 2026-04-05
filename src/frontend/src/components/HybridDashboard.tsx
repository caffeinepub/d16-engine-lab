// D16 Hybrid Branch — Hybrid Dashboard
// Phase H9 + v0.7.1 Mobile Adaptation

import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";
import { useIsMobile } from "../hooks/use-mobile";
import type { HybridAssetBundle } from "../hybridTypes";
import type {
  DivergenceType,
  HybridPermission,
  MarketDirection,
  MarketMaturity,
  MarketTrustClass,
} from "../hybridTypes";

type HybridDashboardProps = {
  bundles: HybridAssetBundle[];
  onSelectAsset: (asset: string) => void;
  selectedAsset: string | null;
  _dataSource?: "MOCK" | "LIVE";
};

// ─── Badge components ───────────────────────────────────────────────────

export function DirectionMini({ direction }: { direction: MarketDirection }) {
  if (direction === "LONG")
    return <span className="text-[10px] font-mono text-[#22C55E]">▲ L</span>;
  if (direction === "SHORT")
    return <span className="text-[10px] font-mono text-[#EF4444]">▼ S</span>;
  return <span className="text-[10px] font-mono text-[#9AA3AD]">— N</span>;
}

export function MaturityMini({ maturity }: { maturity: MarketMaturity }) {
  const COLORS: Record<MarketMaturity, string> = {
    EARLY: "text-[#9AA3AD]",
    BREWING: "text-[#6B8FBF]",
    FORMING: "text-[#5B9BD5]",
    ACTIVE: "text-[#4DA6FF]",
    ARMED: "text-[#86EFAC]",
    READY: "text-[#22C55E]",
    LIVE: "text-[#10b981]",
    DECAY: "text-[#FACC15]",
    CANCELLED: "text-[#EF4444]",
  };
  return (
    <span className={`text-[9px] font-mono ${COLORS[maturity]}`}>
      {maturity}
    </span>
  );
}

export function TrustDot({ trust }: { trust: MarketTrustClass }) {
  const COLORS: Record<MarketTrustClass, string> = {
    HIGH_TRUST: "#22C55E",
    GOOD_TRUST: "#86EFAC",
    REDUCED_TRUST: "#FACC15",
    LOW_TRUST: "#F87171",
    INVALID_RUNTIME: "#EF4444",
  };
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{ background: COLORS[trust] }}
      title={trust}
    />
  );
}

export function DivergenceBadge({ type }: { type: DivergenceType }) {
  const MAP: Record<DivergenceType, { label: string; cls: string }> = {
    NONE: {
      label: "NONE",
      cls: "bg-[#052010] text-[#22C55E] border-[#0f5030]",
    },
    FUTURES_LEADS_SPOT: {
      label: "FUT LEADS",
      cls: "bg-[#1a1a10] text-[#FACC15] border-[#3a3010]",
    },
    BINANCE_SPOT_LEADS_COINBASE: {
      label: "BN LEADS CB",
      cls: "bg-[#1a1a10] text-[#FACC15] border-[#3a3010]",
    },
    COINBASE_LEADS_BINANCE_SPOT: {
      label: "CB LEADS BN",
      cls: "bg-[#1a1a10] text-[#FACC15] border-[#3a3010]",
    },
    SPOT_CONFIRMS_FUTURES: {
      label: "SPOT CONFIRMS",
      cls: "bg-[#0d2540] text-[#67E8F9] border-[#1a4080]",
    },
    FUTURES_OVEREXTENDED: {
      label: "FUT OVEREXT",
      cls: "bg-[#2a1400] text-[#FB923C] border-[#4a2a00]",
    },
    SPOT_WEAKNESS_VS_FUTURES: {
      label: "SPOT WEAK",
      cls: "bg-[#2a1400] text-[#FB923C] border-[#4a2a00]",
    },
    DIRECTION_CONFLICT: {
      label: "DIR CONFLICT",
      cls: "bg-[#200a0a] text-[#EF4444] border-[#4a1010]",
    },
    TRUST_CONFLICT: {
      label: "TRUST CONFLICT",
      cls: "bg-[#200a0a] text-[#F87171] border-[#4a1010]",
    },
    MATURITY_CONFLICT: {
      label: "MAT CONFLICT",
      cls: "bg-[#200a0a] text-[#F87171] border-[#4a1010]",
    },
  };
  const { label, cls } = MAP[type];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono border ${cls}`}
    >
      {label}
    </span>
  );
}

export function HybridPermBadge({ perm }: { perm: HybridPermission }) {
  const MAP: Record<HybridPermission, { label: string; cls: string }> = {
    EXACT_ENTRY_ALLOWED: {
      label: "EXACT",
      cls: "bg-[#052010] text-[#22C55E] border-[#0f5030]",
    },
    PROVISIONAL_ENTRY_ALLOWED: {
      label: "PROVISIONAL",
      cls: "bg-[#0d2540] text-[#67E8F9] border-[#1a4080]",
    },
    PROJECTED_ENTRY_ONLY: {
      label: "PROJECTED",
      cls: "bg-[#0d1a40] text-[#93C5FD] border-[#1a3080]",
    },
    WATCH_ONLY: {
      label: "WATCH ONLY",
      cls: "bg-[#1a1a10] text-[#FACC15] border-[#3a3010]",
    },
    BLOCKED: {
      label: "BLOCKED",
      cls: "bg-[#200a0a] text-[#EF4444] border-[#4a1010]",
    },
  };
  const { label, cls } = MAP[perm];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono border font-bold ${cls}`}
    >
      {label}
    </span>
  );
}

function EntryBadge({
  permissionLevel,
  side,
}: {
  permissionLevel: string;
  side: "LONG" | "SHORT" | "NONE";
}) {
  const sideColor =
    side === "LONG" ? "#22C55E" : side === "SHORT" ? "#EF4444" : "#9AA3AD";
  const sideText = side === "LONG" ? "▲ L" : side === "SHORT" ? "▼ S" : "—";
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-mono" style={{ color: sideColor }}>
        {sideText}
      </span>
      <span className="text-[9px] font-mono text-muted-foreground">
        {permissionLevel}
      </span>
    </div>
  );
}

function ConfirmationBar({ value }: { value: number }) {
  const color =
    value >= 75
      ? "#22C55E"
      : value >= 60
        ? "#67E8F9"
        : value >= 40
          ? "#FACC15"
          : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-1.5 rounded-full"
        style={{ background: "oklch(0.21 0.009 240)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-[9px] font-mono" style={{ color }}>
        {Math.round(value)}
      </span>
    </div>
  );
}

function LeadMarketBadge({ lead }: { lead: string }) {
  const MAP: Record<string, string> = {
    BINANCE_FUTURES: "FUT",
    BINANCE_SPOT: "BN-S",
    COINBASE_SPOT: "CB-S",
    NONE: "—",
  };
  const short = MAP[lead] ?? lead;
  const cls =
    lead === "BINANCE_FUTURES"
      ? "text-[#67E8F9]"
      : lead === "BINANCE_SPOT" || lead === "COINBASE_SPOT"
        ? "text-[#86EFAC]"
        : "text-[#9AA3AD]";
  return (
    <span className={`text-[9px] font-mono font-bold ${cls}`}>{short}</span>
  );
}

// ─── Mobile Card ──────────────────────────────────────────────────────

function MobileAssetCard({
  bundle,
  onSelectAsset,
  isSelected,
  index,
}: {
  bundle: HybridAssetBundle;
  onSelectAsset: (asset: string) => void;
  isSelected: boolean;
  index: number;
}) {
  const { assetState, correlation, entry } = bundle;

  return (
    <button
      type="button"
      onClick={() => onSelectAsset(assetState.asset)}
      onKeyDown={(e) => e.key === "Enter" && onSelectAsset(assetState.asset)}
      className={`w-full text-left bg-card border rounded-lg p-4 transition-colors ${
        isSelected
          ? "border-primary/50 bg-primary/5"
          : "border-border hover:border-border/80 hover:bg-secondary/20"
      }`}
      data-ocid={`hybrid.dashboard.item.${index + 1}`}
    >
      {/* Row 1: Asset + permission + entry side */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[16px] font-mono font-bold text-foreground">
          {assetState.asset}
        </span>
        <div className="flex items-center gap-2">
          <HybridPermBadge perm={correlation.hybridPermission} />
          {entry.side !== "NONE" && (
            <span
              className={`text-[11px] font-mono font-bold ${
                entry.side === "LONG" ? "text-[#22C55E]" : "text-[#EF4444]"
              }`}
            >
              {entry.side === "LONG" ? "▲ LONG" : "▼ SHORT"}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Market states */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: "BN-S", state: assetState.binanceSpot },
          { label: "CB-S", state: assetState.coinbaseSpot },
          { label: "FUT", state: assetState.binanceFutures },
        ].map(({ label, state }) => (
          <div key={label} className="bg-secondary/30 rounded p-1.5">
            <div className="text-[8px] font-mono text-muted-foreground/60 mb-1">
              {label}
            </div>
            {state ? (
              <div className="flex items-center gap-1 flex-wrap">
                <TrustDot trust={state.trustClass} />
                <DirectionMini direction={state.direction} />
                <MaturityMini maturity={state.maturity} />
              </div>
            ) : (
              <span className="text-[9px] text-muted-foreground/40">—</span>
            )}
          </div>
        ))}
      </div>

      {/* Row 3: Cross-market + Lead + Divergence */}
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-muted-foreground/50">
            CROSS:
          </span>
          <ConfirmationBar value={correlation.crossMarketConfirmation} />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono text-muted-foreground/50">
            LEAD:
          </span>
          <LeadMarketBadge lead={correlation.leadMarket} />
        </div>
        <DivergenceBadge type={correlation.divergenceType} />
      </div>

      {/* Row 4: Main blocker */}
      {correlation.mainBlocker && (
        <p className="text-[10px] font-mono text-[#F87171] truncate">
          ■ {correlation.mainBlocker}
        </p>
      )}

      {/* Navigate hint */}
      <div className="flex justify-end mt-2">
        <span className="text-[9px] font-mono text-muted-foreground/40">
          Tap to inspect →
        </span>
      </div>
    </button>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────

export function HybridDashboard({
  bundles,
  onSelectAsset,
  selectedAsset,
  _dataSource = "MOCK",
}: HybridDashboardProps) {
  const isMobile = useIsMobile();

  const sorted = useMemo(
    () =>
      [...bundles].sort(
        (a, b) =>
          b.correlation.crossMarketConfirmation -
          a.correlation.crossMarketConfirmation,
      ),
    [bundles],
  );

  const permittedCount = bundles.filter((b) => b.entry.permitted).length;
  const blockedCount = bundles.filter(
    (b) => b.correlation.hybridPermission === "BLOCKED",
  ).length;

  return (
    <div className="flex flex-col h-full" data-ocid="hybrid.dashboard.panel">
      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-5 py-3 border-b border-border bg-background/60">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-semibold text-foreground">
              Hybrid Dashboard
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {bundles.length} assets — ranked by cross-market confirmation
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
            <span>
              <span className="text-[#22C55E] font-bold">{permittedCount}</span>{" "}
              permitted
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="text-[#EF4444] font-bold">{blockedCount}</span>{" "}
              blocked
            </span>
          </div>
        </div>
      </div>

      {/* Mobile: card list */}
      {isMobile ? (
        <ScrollArea className="flex-1">
          <div className="px-3 py-3 space-y-3">
            {sorted.map((bundle, i) => (
              <MobileAssetCard
                key={bundle.assetState.asset}
                bundle={bundle}
                onSelectAsset={onSelectAsset}
                isSelected={bundle.assetState.asset === selectedAsset}
                index={i}
              />
            ))}
          </div>
        </ScrollArea>
      ) : (
        /* Desktop: table */
        <ScrollArea className="flex-1">
          <div className="px-5 py-3">
            <div className="border border-border rounded overflow-hidden">
              <table
                className="w-full text-[10px] font-mono"
                data-ocid="hybrid.dashboard.table"
              >
                <thead>
                  <tr className="bg-secondary border-b border-border text-muted-foreground">
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Asset
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      BN Spot
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      CB Spot
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      BN Fut
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold w-24">
                      Cross-Mkt
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Lead
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Divergence
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Hybrid
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Entry
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Blocker
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((bundle, i) => {
                    const { assetState, correlation, entry } = bundle;
                    const isSelected = assetState.asset === selectedAsset;
                    const bs = assetState.binanceSpot;
                    const cs = assetState.coinbaseSpot;
                    const fs = assetState.binanceFutures;

                    return (
                      <tr
                        key={assetState.asset}
                        onClick={() => onSelectAsset(assetState.asset)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && onSelectAsset(assetState.asset)
                        }
                        className={`border-b border-border/50 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/10 border-l-2 border-l-primary"
                            : "hover:bg-secondary/30"
                        }`}
                        data-ocid={`hybrid.dashboard.item.${i + 1}`}
                      >
                        <td className="px-3 py-2">
                          <span className="font-bold text-foreground text-[11px]">
                            {assetState.asset}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {bs ? (
                            <div className="flex items-center gap-1.5">
                              <TrustDot trust={bs.trustClass} />
                              <DirectionMini direction={bs.direction} />
                              <MaturityMini maturity={bs.maturity} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {cs ? (
                            <div className="flex items-center gap-1.5">
                              <TrustDot trust={cs.trustClass} />
                              <DirectionMini direction={cs.direction} />
                              <MaturityMini maturity={cs.maturity} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {fs ? (
                            <div className="flex items-center gap-1.5">
                              <TrustDot trust={fs.trustClass} />
                              <DirectionMini direction={fs.direction} />
                              <MaturityMini maturity={fs.maturity} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 w-24">
                          <ConfirmationBar
                            value={correlation.crossMarketConfirmation}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <LeadMarketBadge lead={correlation.leadMarket} />
                        </td>
                        <td className="px-3 py-2">
                          <DivergenceBadge type={correlation.divergenceType} />
                        </td>
                        <td className="px-3 py-2">
                          <HybridPermBadge
                            perm={correlation.hybridPermission}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <EntryBadge
                            permissionLevel={entry.permissionLevel}
                            side={entry.side}
                          />
                        </td>
                        <td className="px-3 py-2 max-w-[180px]">
                          {correlation.mainBlocker ? (
                            <span className="text-[#F87171] truncate block">
                              {correlation.mainBlocker.slice(0, 40)}
                              {correlation.mainBlocker.length > 40 ? "…" : ""}
                            </span>
                          ) : (
                            <span className="text-[#22C55E]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
