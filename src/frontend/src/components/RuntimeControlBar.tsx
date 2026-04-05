// D16 Hybrid v0.6 — Runtime Control Bar
// v0.7.1 Mobile Adaptation: compact headline row on mobile, expand toggle.

import { useState } from "react";
import { useIsMobile } from "../hooks/use-mobile";
import type { EngineMode, RuntimeState } from "../liveAdapterTypes";

type Props = {
  runtimeState: RuntimeState;
  dataSource: "MOCK" | "LIVE";
  onSetMode: (mode: EngineMode) => void;
};

const MODE_LABELS: Record<EngineMode, string> = {
  MOCK: "MOCK",
  LIVE: "LIVE",
  HYBRID_LIVE: "HYBRID",
};

function getViewSourceLabel(
  mode: EngineMode,
  dataSource: "MOCK" | "LIVE",
): string {
  if (mode === "MOCK") return "Scenario";
  if (dataSource === "LIVE") return "Live Hybrid";
  return "Mock Hybrid";
}

const TRUST_COLORS: Record<string, string> = {
  FULL: "#22C55E",
  REDUCED: "#FACC15",
  PARTIAL: "#F97316",
  BLOCKED: "#EF4444",
};

const TRUST_BG: Record<string, string> = {
  FULL: "bg-[#052010] border-[#0f5030]",
  REDUCED: "bg-[#1a1400] border-[#40340a]",
  PARTIAL: "bg-[#1a0d00] border-[#401800]",
  BLOCKED: "bg-[#1a0505] border-[#401010]",
};

function timeSince(ts: number | null): string {
  if (!ts) return "--";
  const diff = Date.now() - ts;
  if (diff < 1000) return "<1s";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  return `${Math.floor(diff / 60_000)}m ago`;
}

export function RuntimeControlBar({
  runtimeState,
  dataSource,
  onSetMode,
}: Props) {
  const {
    mode,
    connectedMarketCount,
    staleMarketCount,
    disconnectedMarketCount,
    overallTrustClass,
    lastHybridRecomputeAt,
  } = runtimeState;
  const isMobile = useIsMobile();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const trustColor = TRUST_COLORS[overallTrustClass] ?? "#9AA3AD";
  const trustBg = TRUST_BG[overallTrustClass] ?? "bg-card border-border";

  if (isMobile) {
    return (
      <div className="flex-shrink-0 border-b border-border bg-[#0a0d14]">
        {/* Compact headline row */}
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          {/* Runtime mode */}
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest">
              Runtime
            </span>
            <span
              className={`px-2 py-0.5 text-[10px] font-mono font-semibold rounded border ${
                mode === "MOCK"
                  ? "bg-[#1a1a2a] text-[#a78bfa] border-[#3d2f6b]"
                  : mode === "LIVE"
                    ? "bg-[#052010] text-[#22C55E] border-[#0f5030]"
                    : "bg-[#0d1f30] text-[#67E8F9] border-[#1a4a6a]"
              }`}
            >
              {MODE_LABELS[mode]}
            </span>
          </div>

          {/* View source */}
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-widest">
              View
            </span>
            <span
              className={`text-[10px] font-mono font-semibold ${
                dataSource === "LIVE" ? "text-[#22C55E]" : "text-[#a78bfa]"
              }`}
            >
              {getViewSourceLabel(mode, dataSource)}
            </span>
          </div>

          {/* Live trust — only show if not MOCK mode */}
          {mode !== "MOCK" && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-muted-foreground/50">
                {connectedMarketCount}/3
              </span>
              <div
                className={`px-2 py-0.5 rounded border text-[9px] font-mono font-semibold ${trustBg}`}
                style={{ color: trustColor }}
              >
                {overallTrustClass}
              </div>
            </div>
          )}

          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => setMobileExpanded((p) => !p)}
            className="text-[9px] font-mono text-muted-foreground/60 hover:text-foreground border border-border/30 px-2 py-0.5 rounded transition-colors"
            data-ocid="runtime.mobile.toggle"
          >
            {mobileExpanded ? "▲" : "▼"}
          </button>
        </div>

        {/* Expanded: mode selector + full controls */}
        {mobileExpanded && (
          <div className="px-3 pb-2 space-y-2 border-t border-border/30 pt-2">
            {/* Mode selector */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
                MODE
              </span>
              <div className="flex items-center gap-1">
                {(["MOCK", "LIVE", "HYBRID_LIVE"] as EngineMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onSetMode(m)}
                    className={`px-2.5 py-1 text-[10px] font-mono font-semibold rounded border transition-all ${
                      mode === m
                        ? m === "MOCK"
                          ? "bg-[#1a1a2a] text-[#a78bfa] border-[#3d2f6b]"
                          : m === "LIVE"
                            ? "bg-[#052010] text-[#22C55E] border-[#0f5030]"
                            : "bg-[#0d1f30] text-[#67E8F9] border-[#1a4a6a]"
                        : "bg-transparent text-muted-foreground/50 border-border/30 hover:text-foreground/80"
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            {/* Counts */}
            <div className="flex items-center gap-4">
              <Metric
                label="CONN"
                value={connectedMarketCount}
                max={3}
                color={
                  connectedMarketCount === 3
                    ? "#22C55E"
                    : connectedMarketCount > 0
                      ? "#FACC15"
                      : "#EF4444"
                }
              />
              <Metric
                label="STALE"
                value={staleMarketCount}
                max={3}
                color={staleMarketCount === 0 ? "#9AA3AD" : "#F97316"}
              />
              <Metric
                label="OFFLINE"
                value={disconnectedMarketCount}
                max={3}
                color={disconnectedMarketCount === 0 ? "#9AA3AD" : "#EF4444"}
              />
            </div>
          </div>
        )}

        {/* Warning bar */}
        {mode !== "MOCK" && connectedMarketCount < 3 && (
          <div className="mx-3 mb-2 px-2 py-1 rounded bg-[#1a0d00] border border-[#401800] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] flex-shrink-0" />
            <span className="text-[10px] font-mono text-[#F97316] line-clamp-1">
              {disconnectedMarketCount > 0
                ? `${disconnectedMarketCount} market(s) offline — hybrid trust reduced.`
                : staleMarketCount > 0
                  ? `${staleMarketCount} market(s) stale — data freshness degraded.`
                  : "Adapters initializing — hybrid not yet ready."}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Desktop
  return (
    <div className="flex-shrink-0 border-b border-border bg-[#0a0d14] px-4 py-2">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left: Mode selector */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest">
            ENGINE MODE
          </span>
          <div className="flex items-center gap-1">
            {(["MOCK", "LIVE", "HYBRID_LIVE"] as EngineMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onSetMode(m)}
                className={`px-2.5 py-0.5 text-[10px] font-mono font-semibold rounded border transition-all ${
                  mode === m
                    ? m === "MOCK"
                      ? "bg-[#1a1a2a] text-[#a78bfa] border-[#3d2f6b]"
                      : m === "LIVE"
                        ? "bg-[#052010] text-[#22C55E] border-[#0f5030]"
                        : "bg-[#0d1f30] text-[#67E8F9] border-[#1a4a6a]"
                    : "bg-transparent text-muted-foreground/50 border-border/30 hover:text-foreground/80"
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Live status indicators */}
        <div className="flex items-center gap-4">
          {/* View source badge */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
              View
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                dataSource === "LIVE" ? "bg-[#22C55E]" : "bg-[#a78bfa]"
              }`}
              style={
                dataSource === "LIVE" ? { animation: "pulse 2s infinite" } : {}
              }
            />
            <span
              className={`text-[10px] font-mono font-semibold ${
                dataSource === "LIVE" ? "text-[#22C55E]" : "text-[#a78bfa]"
              }`}
            >
              {getViewSourceLabel(mode, dataSource)}
            </span>
          </div>

          {/* Market connection counts — hidden in MOCK mode */}
          {mode === "MOCK" ? (
            <span className="text-[9px] font-mono text-muted-foreground/30 italic">
              Live adapters inactive
            </span>
          ) : (
            <div className="flex items-center gap-3">
              <Metric
                label="CONNECTED"
                value={connectedMarketCount}
                max={3}
                color={
                  connectedMarketCount === 3
                    ? "#22C55E"
                    : connectedMarketCount > 0
                      ? "#FACC15"
                      : "#EF4444"
                }
              />
              <Metric
                label="STALE"
                value={staleMarketCount}
                max={3}
                color={staleMarketCount === 0 ? "#9AA3AD" : "#F97316"}
              />
              <Metric
                label="OFFLINE"
                value={disconnectedMarketCount}
                max={3}
                color={disconnectedMarketCount === 0 ? "#9AA3AD" : "#EF4444"}
              />
            </div>
          )}

          {/* Last recompute */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground/50 font-mono uppercase tracking-widest">
              RECOMPUTE
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              {timeSince(lastHybridRecomputeAt)}
            </span>
          </div>
        </div>

        {/* Right: Trust summary */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded border text-[10px] font-mono ${trustBg}`}
        >
          <span className="text-muted-foreground/60 uppercase tracking-widest text-[9px]">
            TRUST
          </span>
          <span className="font-semibold" style={{ color: trustColor }}>
            {overallTrustClass}
          </span>
        </div>
      </div>

      {/* Warning bar */}
      {mode !== "MOCK" && connectedMarketCount < 3 && (
        <div className="mt-1.5 px-2 py-1 rounded bg-[#1a0d00] border border-[#401800] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] flex-shrink-0" />
          <span className="text-[10px] font-mono text-[#F97316]">
            {disconnectedMarketCount > 0
              ? `${disconnectedMarketCount} market(s) offline — hybrid trust reduced. No fake confirmation.`
              : staleMarketCount > 0
                ? `${staleMarketCount} market(s) stale — data freshness degraded.`
                : "Adapters initializing — hybrid not yet ready."}
          </span>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
        {label}
      </span>
      <span className="text-[11px] font-mono font-bold" style={{ color }}>
        {value}
        <span className="text-muted-foreground/30">/{max}</span>
      </span>
    </div>
  );
}
