// D16 Hybrid v0.6 — Live Diagnostics Panel
// Full-width diagnostics tab content: adapter diagnostics + asset live status.

import { ScrollArea } from "@/components/ui/scroll-area";
import type { EngineMode, RuntimeState } from "../liveAdapterTypes";
import { CanonicalAssetLiveStatus } from "./CanonicalAssetLiveStatus";
import { MarketAdapterDiagnostics } from "./MarketAdapterDiagnostics";

type Props = {
  runtimeState: RuntimeState;
  dataSource: "MOCK" | "LIVE";
  onSetMode: (mode: EngineMode) => void;
};

export function LiveDiagnosticsPanel({
  runtimeState,
  dataSource,
  onSetMode: _onSetMode,
}: Props) {
  const { mode } = runtimeState;

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="px-5 py-4 space-y-6">
        {/* Mode summary header */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-[13px] font-mono font-semibold text-foreground">
              Live Runtime Diagnostics
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Transport health, adapter state, and canonical asset hydration.
            </p>
          </div>
          {mode === "MOCK" && (
            <div className="px-3 py-1.5 rounded bg-[#1a1a2a] border border-[#3d2f6b] text-[10px] font-mono text-[#a78bfa]">
              MOCK MODE — No live connections. Switch to LIVE or HYBRID to
              activate adapters.
            </div>
          )}
        </div>

        {/* Doctrine reminder (only shown in live mode when not all markets connected) */}
        {mode !== "MOCK" && runtimeState.connectedMarketCount < 3 && (
          <div className="px-4 py-3 rounded bg-[#1a0d00] border border-[#401800] space-y-1">
            <div className="text-[10px] font-mono font-semibold text-[#F97316]">
              DOCTRINE: PARTIAL LIVE DATA
            </div>
            <div className="text-[10px] font-mono text-[#F97316]/70 leading-relaxed">
              {runtimeState.disconnectedMarketCount > 0
                ? `${runtimeState.disconnectedMarketCount} market(s) offline. Hybrid trust is reduced. No fake confirmation is generated for missing markets.`
                : `${runtimeState.staleMarketCount} market(s) stale. Data freshness degraded. Trust is reduced until fresh ticks resume.`}
            </div>
          </div>
        )}

        {/* Market Adapter Diagnostics */}
        <MarketAdapterDiagnostics runtimeState={runtimeState} />

        {/* Canonical Asset Live Status */}
        <CanonicalAssetLiveStatus runtimeState={runtimeState} />

        {/* Runtime stats footer */}
        <div className="border-t border-border pt-4 flex items-center gap-6 flex-wrap">
          <Stat
            label="Mode"
            value={mode}
            color={
              mode === "LIVE"
                ? "#22C55E"
                : mode === "HYBRID_LIVE"
                  ? "#67E8F9"
                  : "#a78bfa"
            }
          />
          <Stat
            label="Data Source"
            value={dataSource}
            color={dataSource === "LIVE" ? "#22C55E" : "#a78bfa"}
          />
          <Stat
            label="Overall Trust"
            value={runtimeState.overallTrustClass}
            color={
              runtimeState.overallTrustClass === "FULL"
                ? "#22C55E"
                : runtimeState.overallTrustClass === "REDUCED"
                  ? "#FACC15"
                  : runtimeState.overallTrustClass === "PARTIAL"
                    ? "#F97316"
                    : "#EF4444"
            }
          />
          {runtimeState.liveActivatedAt && (
            <Stat
              label="Live Since"
              value={new Date(
                runtimeState.liveActivatedAt,
              ).toLocaleTimeString()}
              color="#9AA3AD"
            />
          )}
          <Stat
            label="Recompute Interval"
            value={`${runtimeState.recomputeIntervalMs / 1000}s`}
            color="#9AA3AD"
          />
        </div>
      </div>
    </ScrollArea>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
        {label}
      </span>
      <span className="text-[11px] font-mono font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
