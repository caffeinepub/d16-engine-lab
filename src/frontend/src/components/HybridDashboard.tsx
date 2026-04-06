// D16 Hybrid Branch — Hybrid Dashboard
// Phase H9 + v0.7.1 Mobile Adaptation
// v0.9+ UX: Old 8-symbol fixed list replaced by TopHybridCandidatesBar.
// Primary candidate navigation is now live top-opportunity-driven.

import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState } from "react";
import { useIsMobile } from "../hooks/use-mobile";
import type { HybridAssetBundle } from "../hybridTypes";
import type {
  DivergenceType,
  HybridPermission,
  MarketDirection,
  MarketMaturity,
  MarketTrustClass,
} from "../hybridTypes";
import type { SurveillanceCandidate } from "../surveillanceTypes";
import type { UniverseTopEntryRecord } from "../universeTypes";
import { HybridDetailInspector } from "./HybridDetailInspector";
import { TopHybridCandidatesBar } from "./TopHybridCandidatesBar";

type HybridDashboardProps = {
  bundles: HybridAssetBundle[]; // 8 anchor bundles, used for detail lookup
  rankedRecords?: UniverseTopEntryRecord[]; // full universe ranked records for top bar
  surveillanceCandidates?: SurveillanceCandidate[]; // surveillance priority candidates for top bar
  onSelectAsset: (asset: string) => void; // kept for external navigation compatibility
  selectedAsset: string | null;
  _dataSource?: "MOCK" | "LIVE";
};

// ─── Badge components (re-exported for use by other components) ─────────────────────

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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function HybridDashboard({
  bundles,
  rankedRecords = [],
  surveillanceCandidates = [],
  onSelectAsset,
  selectedAsset,
  _dataSource = "MOCK",
}: HybridDashboardProps) {
  const isMobile = useIsMobile();

  // Internal selected asset (for inspector panel below the bar)
  const [localSelected, setLocalSelected] = useState<string | null>(
    selectedAsset,
  );

  const handleSelect = (asset: string) => {
    setLocalSelected(asset);
    onSelectAsset(asset); // keep parent in sync for external navigation
  };

  // Determine the active asset to display in the inspector
  const activeAsset = localSelected ?? selectedAsset;

  // Find hybrid bundle for the selected asset (from 8 anchor bundles if available)
  const selectedBundle = useMemo(() => {
    if (!activeAsset) return bundles[0] ?? null;
    return bundles.find((b) => b.assetState.asset === activeAsset) ?? null;
  }, [activeAsset, bundles]);

  // Summary stats from ranked records (preferred) or bundles
  const totalCandidates =
    rankedRecords.length > 0 ? rankedRecords.length : bundles.length;
  const exactCount = rankedRecords.filter(
    (r) => r.permissionLevel === "EXACT",
  ).length;
  const provisionalCount = rankedRecords.filter(
    (r) => r.permissionLevel === "PROVISIONAL",
  ).length;
  const blockedCount =
    rankedRecords.length > 0
      ? rankedRecords.filter((r) => r.permissionLevel === "BLOCKED").length
      : bundles.filter((b) => b.correlation.hybridPermission === "BLOCKED")
          .length;

  // Determine max chips based on viewport (fewer on small mobile)
  const maxChips = isMobile ? 6 : 8;

  return (
    <div className="flex flex-col h-full" data-ocid="hybrid.dashboard.panel">
      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-5 py-3 border-b border-border bg-background/60">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-[13px] font-semibold text-foreground">
              Hybrid Inspector
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {totalCandidates > 0
                ? `${totalCandidates} candidates — top opportunities shown below`
                : "Awaiting universe ranking"}
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
            {exactCount > 0 && (
              <span>
                <span className="text-[#22C55E] font-bold">{exactCount}</span>{" "}
                exact
              </span>
            )}
            {provisionalCount > 0 && (
              <span>
                <span className="text-[#67E8F9] font-bold">
                  {provisionalCount}
                </span>{" "}
                provisional
              </span>
            )}
            {blockedCount > 0 && (
              <>
                <span className="text-border">|</span>
                <span>
                  <span className="text-[#EF4444] font-bold">
                    {blockedCount}
                  </span>{" "}
                  blocked
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top Hybrid Candidates Bar */}
      <div
        className="flex-shrink-0 border-b border-border/50 bg-background/40"
        data-ocid="hybrid.top_bar.container"
      >
        <TopHybridCandidatesBar
          rankedRecords={rankedRecords}
          surveillanceCandidates={surveillanceCandidates}
          hybridBundles={bundles}
          selectedAsset={activeAsset}
          onSelectAsset={handleSelect}
          maxChips={maxChips}
        />
      </div>

      {/* Detail Inspector for selected candidate */}
      <div className="flex-1 overflow-hidden">
        {activeAsset ? (
          <HybridDetailInspector bundle={selectedBundle} />
        ) : (
          <div
            className="flex items-center justify-center h-full text-muted-foreground text-sm"
            data-ocid="hybrid.dashboard.empty_state"
          >
            <div className="text-center space-y-2">
              <p className="text-[13px]">
                Select a candidate from the bar above
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/50">
                or switch to LIVE mode to see top opportunities
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
