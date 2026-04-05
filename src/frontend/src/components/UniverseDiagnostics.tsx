// D16 Hybrid v0.8 — Universe Diagnostics Panel
// Shows full diagnostic state: discovery, eligibility, tier distribution, hydration, queue.

import { useState } from "react";
import type {
  UniverseAsset,
  UniverseEligibilityRecord,
  UniverseRuntimeStatus,
  UniverseTierAssignment,
} from "../universeTypes";

function timeSince(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  if (diff < 1000) return "<1s";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

function PhaseLabel({ phase }: { phase: string }) {
  const colors: Record<string, string> = {
    IDLE: "text-muted-foreground",
    FETCHING: "text-[#4DA6FF] animate-pulse",
    MAPPING: "text-[#67E8F9] animate-pulse",
    FILTERING: "text-[#a78bfa] animate-pulse",
    TIERING: "text-[#86EFAC] animate-pulse",
    COMPLETE: "text-[#22C55E]",
    ERROR: "text-[#EF4444]",
  };
  return (
    <span
      className={`text-[10px] font-mono ${colors[phase] ?? "text-muted-foreground"}`}
    >
      {phase}
    </span>
  );
}

type ExclusionReason = { reason: string; count: number };

function topExclusionReasons(
  eligibility: Map<string, UniverseEligibilityRecord>,
): ExclusionReason[] {
  const counts = new Map<string, number>();
  for (const record of eligibility.values()) {
    if (record.eligibility === "EXCLUDED") {
      for (const r of record.reasonsExcluded) {
        counts.set(r, (counts.get(r) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));
}

type UniverseDiagnosticsProps = {
  runtimeStatus: UniverseRuntimeStatus;
  assets: Map<string, UniverseAsset>;
  eligibility: Map<string, UniverseEligibilityRecord>;
  tiers: Map<string, UniverseTierAssignment>;
  isMockMode: boolean;
};

export function UniverseDiagnostics({
  runtimeStatus,
  assets: _assets,
  eligibility,
  tiers: _tiers,
  isMockMode,
}: UniverseDiagnosticsProps) {
  const [expanded, setExpanded] = useState(false);

  const exclusionReasons = topExclusionReasons(eligibility);
  const { tierCounts, discoveredAssets, eligibleAssets } = runtimeStatus;
  const excludedCount = discoveredAssets - eligibleAssets;

  return (
    <div
      className="border border-border/40 rounded-lg bg-[#080c10]"
      data-ocid="universe.diagnostics.panel"
    >
      {/* Header row — always visible */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setExpanded((e) => !e)}
        data-ocid="universe.diagnostics.toggle"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
            UNIVERSE DIAGNOSTICS
          </span>
          {isMockMode && (
            <span className="text-[9px] font-mono text-[#FACC15] bg-[#1a1000] border border-[#3a2800] px-1.5 py-0.5 rounded">
              MOCK — LIVE REQUIRED
            </span>
          )}
          {!isMockMode && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-[#22C55E]">
                {discoveredAssets} discovered
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/50">
                ·
              </span>
              <span className="text-[9px] font-mono text-[#4DA6FF]">
                {eligibleAssets} eligible
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/50">
                ·
              </span>
              <span className="text-[9px] font-mono text-[#EF4444]/80">
                {excludedCount} excluded
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isMockMode && <PhaseLabel phase={runtimeStatus.discoveryPhase} />}
          <span className="text-[9px] font-mono text-muted-foreground/40">
            {expanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-border/20">
          {isMockMode ? (
            <div className="pt-3">
              <p className="text-[10px] font-mono text-[#FACC15]/80 leading-relaxed">
                Full universe discovery, eligibility filtering, and tier
                assignment are only available in LIVE mode. The Universe board
                currently shows the 8 canonical mock assets ranked through the
                v0.8 ranking engine.
              </p>
              <p className="text-[9px] font-mono text-muted-foreground/40 mt-2">
                Switch to LIVE mode via the Runtime tab to begin full-universe
                discovery.
              </p>
            </div>
          ) : (
            <div className="pt-3 space-y-4">
              {/* Tier distribution */}
              <div>
                <div className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">
                  TIER DISTRIBUTION
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      {
                        label: "TIER_1",
                        value: tierCounts.tier1,
                        color: "#67E8F9",
                      },
                      {
                        label: "TIER_2",
                        value: tierCounts.tier2,
                        color: "#a78bfa",
                      },
                      {
                        label: "TIER_3",
                        value: tierCounts.tier3,
                        color: "#9AA3AD",
                      },
                      {
                        label: "EXCL",
                        value: tierCounts.excluded,
                        color: "#EF4444",
                      },
                    ] as const
                  ).map(({ label, value, color }) => (
                    <div
                      key={label}
                      className="bg-[#0d1218] border border-border/30 rounded p-2"
                    >
                      <div
                        className="text-[9px] font-mono mb-0.5"
                        style={{ color }}
                      >
                        {label}
                      </div>
                      <div
                        className="text-[18px] font-bold font-mono"
                        style={{ color }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hydration + queue */}
              <div>
                <div className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">
                  HYDRATION
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="bg-[#0d1218] border border-border/30 rounded p-2">
                    <div className="text-[8px] font-mono text-muted-foreground/50 mb-0.5">
                      ACTIVE
                    </div>
                    <div className="text-[15px] font-bold font-mono text-[#22C55E]">
                      {runtimeStatus.activelyHydrated}
                    </div>
                  </div>
                  <div className="bg-[#0d1218] border border-border/30 rounded p-2">
                    <div className="text-[8px] font-mono text-muted-foreground/50 mb-0.5">
                      QUEUE
                    </div>
                    <div className="text-[15px] font-bold font-mono text-[#FACC15]">
                      {runtimeStatus.recomputeQueueDepth}
                    </div>
                  </div>
                  <div className="bg-[#0d1218] border border-border/30 rounded p-2">
                    <div className="text-[8px] font-mono text-muted-foreground/50 mb-0.5">
                      SKIPPED
                    </div>
                    <div className="text-[15px] font-bold font-mono text-muted-foreground">
                      {runtimeStatus.skippedDueToBudget}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cadence */}
              <div>
                <div className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">
                  REFRESH CADENCE
                </div>
                <div className="space-y-1.5">
                  {(
                    [
                      {
                        label: "Discovery refresh",
                        ms: runtimeStatus.discoveryRefreshIntervalMs,
                        last: runtimeStatus.lastDiscoveryRefreshAt,
                      },
                      {
                        label: "TIER_1 recompute",
                        ms: runtimeStatus.tier1RecomputeIntervalMs,
                        last: runtimeStatus.lastRankingRefreshAt,
                      },
                      {
                        label: "TIER_2 polling",
                        ms: runtimeStatus.tier2PollIntervalMs,
                        last: null,
                      },
                      {
                        label: "TIER_3 polling",
                        ms: runtimeStatus.tier3PollIntervalMs,
                        last: null,
                      },
                    ] as const
                  ).map(({ label, ms, last }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between"
                    >
                      <span className="text-[9px] font-mono text-muted-foreground/60">
                        {label}
                      </span>
                      <span className="text-[9px] font-mono text-[#4DA6FF]/70">
                        {ms >= 60_000 ? `${ms / 60_000}m` : `${ms / 1000}s`}
                        {last !== null ? ` · ${timeSince(last)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top exclusion reasons */}
              {exclusionReasons.length > 0 && (
                <div>
                  <div className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-2">
                    TOP EXCLUSION REASONS
                  </div>
                  <div className="space-y-1">
                    {exclusionReasons.map(({ reason, count }) => (
                      <div
                        key={reason}
                        className="flex items-center justify-between"
                      >
                        <span className="text-[9px] font-mono text-muted-foreground/60">
                          {reason}
                        </span>
                        <span className="text-[9px] font-mono text-[#EF4444]/70">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discovery error */}
              {runtimeStatus.discoveryError && (
                <div className="border border-[#401010] rounded p-2 bg-[#1a0505]">
                  <span className="text-[9px] font-mono text-[#EF4444]">
                    Discovery error: {runtimeStatus.discoveryError}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
