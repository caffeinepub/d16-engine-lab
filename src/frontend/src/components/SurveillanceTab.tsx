// D16 Hybrid v0.8.1 — Surveillance Tab
// Top-level operator surface for priority candidate monitoring.
// Bucket filter + candidate cards. Mobile-first.
//
// v0.8.1 fix: Shows diagnostics breakdown (original-8 vs beyond-8 watched assets).
// Any asset from the broader universe can now be pinned and tracked.

import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef, useState } from "react";
import { useIsMobile } from "../hooks/use-mobile";
import type { UseSurveillanceResult } from "../surveillanceTypes";
import type {
  SurveillanceBucket,
  SurveillancePriorityLevel,
} from "../surveillanceTypes";
import {
  SURVEILLANCE_BUCKET_COLORS,
  SURVEILLANCE_BUCKET_LABELS,
  SURVEILLANCE_BUCKET_ORDER,
} from "../surveillanceTypes";
import { SurveillanceCard } from "./SurveillanceCard";

// ─── Bucket counts ───────────────────────────────────────────────────

const BUCKET_ALL = "ALL" as const;
type BucketFilter = SurveillanceBucket | typeof BUCKET_ALL;

// ─── Empty state ────────────────────────────────────────────────────

function EmptyState({ isLive }: { isLive: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-[11px] font-mono text-muted-foreground/40">
        No candidates under surveillance yet.
      </span>
      <span className="text-[9px] font-mono text-muted-foreground/25 mt-2 max-w-[260px] leading-relaxed">
        {isLive
          ? "Universe ranking will auto-add the top candidates. You can also pin any asset from the UNIVERSE tab."
          : "Switch to LIVE mode and open the UNIVERSE tab to begin discovery and ranking."}
      </span>
    </div>
  );
}

// ─── Quick pin input ───────────────────────────────────────────────────

function QuickPinInput({ onPin }: { onPin: (asset: string) => void }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = value.trim().toUpperCase();
    if (trimmed.length > 0) {
      onPin(trimmed);
      setValue("");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="PIN ASSET (e.g. SUI, TIA, WIF...)"
        className="flex-1 bg-[#0d1218] border border-border/40 rounded px-2 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-[#FACC15]/50 min-w-0"
        data-ocid="surveillance.pin.input"
      />
      <button
        type="button"
        onClick={submit}
        disabled={value.trim().length === 0}
        className="px-2.5 py-1.5 text-[9px] font-mono rounded border border-[#FACC15]/40 text-[#FACC15] bg-[#1a1000] hover:bg-[#2a1800] transition-colors disabled:opacity-30"
        data-ocid="surveillance.pin.button"
      >
        PIN
      </button>
    </div>
  );
}

// ─── Diagnostics strip ──────────────────────────────────────────────
// Shows universe coverage: original-8 vs beyond-8 watched assets.

function DiagnosticsStrip({
  diagnostics,
}: {
  diagnostics: UseSurveillanceResult["diagnostics"];
}) {
  if (diagnostics.total === 0) return null;
  return (
    <div className="flex-shrink-0 px-4 py-1 border-b border-border/20 flex items-center gap-3 flex-wrap">
      <span className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-widest">
        Coverage
      </span>
      <span className="text-[8px] font-mono text-muted-foreground/50">
        {diagnostics.total} total
      </span>
      <span className="text-[8px] font-mono">
        <span className="text-[#67E8F9]/60">
          ▦ {diagnostics.fromOriginal8} baseline
        </span>
      </span>
      <span className="text-[8px] font-mono">
        <span
          style={{
            color:
              diagnostics.beyondOriginal8 > 0
                ? "#a78bfa"
                : "rgba(156,163,175,0.4)",
          }}
        >
          ◉ {diagnostics.beyondOriginal8} beyond-8
        </span>
      </span>
      {diagnostics.stubsAwaitingHydration > 0 && (
        <span className="text-[8px] font-mono text-[#F97316]/60">
          ⧗ {diagnostics.stubsAwaitingHydration} awaiting hydration
        </span>
      )}
      {diagnostics.hydrated > 0 && (
        <span className="text-[8px] font-mono text-[#22C55E]/50">
          ✓ {diagnostics.hydrated} hydrated
        </span>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────

type SurveillanceTabProps = {
  surveillance: UseSurveillanceResult;
  engineMode: string;
};

export function SurveillanceTab({
  surveillance,
  engineMode,
}: SurveillanceTabProps) {
  const isMobile = useIsMobile();
  const [activeBucket, setActiveBucket] = useState<BucketFilter>(BUCKET_ALL);

  const isLive = engineMode !== "MOCK";

  // Build filtered list
  const displayedCandidates =
    activeBucket === BUCKET_ALL
      ? surveillance.candidates
      : (surveillance.buckets[activeBucket as SurveillanceBucket] ?? []);

  // Counts per bucket
  const bucketCounts: Record<BucketFilter, number> = {
    ALL: surveillance.totalMonitored,
    ...Object.fromEntries(
      SURVEILLANCE_BUCKET_ORDER.map((b) => [
        b,
        surveillance.buckets[b]?.length ?? 0,
      ]),
    ),
  } as Record<BucketFilter, number>;

  // Only show buckets with content (plus ALL)
  const visibleBuckets: BucketFilter[] = [
    BUCKET_ALL,
    ...SURVEILLANCE_BUCKET_ORDER.filter((b) => (bucketCounts[b] ?? 0) > 0),
  ];

  return (
    <div
      className="flex flex-col h-full min-h-0"
      data-ocid="surveillance.tab.panel"
    >
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[13px] font-semibold text-foreground">
                SURVEILLANCE
              </span>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                style={{
                  color: isLive ? "#22C55E" : "#FACC15",
                  background: isLive ? "#052010" : "#1a1000",
                  borderColor: isLive ? "#0f5030" : "#3a2800",
                }}
              >
                {isLive ? "LIVE" : "MOCK"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground/50">
              <span>{surveillance.totalMonitored} monitored</span>
              <span>•</span>
              <span>
                <span className="text-[#67E8F9]/60">
                  {surveillance.autoSelectedCount} auto
                </span>
              </span>
              <span>•</span>
              <span>
                <span className="text-[#FACC15]/60">
                  {surveillance.pinnedCount} pinned
                </span>
              </span>
              {surveillance.lastEventAt && (
                <>
                  <span>•</span>
                  <span className="text-muted-foreground/30">
                    Last event{" "}
                    {new Date(surveillance.lastEventAt).toLocaleTimeString(
                      "en-US",
                      { hour: "2-digit", minute: "2-digit", hour12: false },
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick pin input */}
        <div className="mb-2">
          <QuickPinInput onPin={surveillance.pinAsset} />
        </div>

        {/* Bucket selector — mobile: dropdown, desktop: pill bar */}
        {isMobile ? (
          <select
            value={activeBucket}
            onChange={(e) => setActiveBucket(e.target.value as BucketFilter)}
            className="w-full bg-[#0d1218] border border-border/40 rounded px-2 py-1.5 text-[10px] font-mono text-foreground"
            data-ocid="surveillance.bucket.selector"
          >
            <option value="ALL">All ({bucketCounts[BUCKET_ALL]})</option>
            {SURVEILLANCE_BUCKET_ORDER.map((b) => (
              <option key={b} value={b} disabled={(bucketCounts[b] ?? 0) === 0}>
                {SURVEILLANCE_BUCKET_LABELS[b]} ({bucketCounts[b] ?? 0})
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {visibleBuckets.map((b) => {
              const label =
                b === BUCKET_ALL
                  ? "All"
                  : SURVEILLANCE_BUCKET_LABELS[b as SurveillanceBucket];
              const count = bucketCounts[b] ?? 0;
              const isActive = activeBucket === b;
              const color =
                b === BUCKET_ALL
                  ? "#9CA3AF"
                  : SURVEILLANCE_BUCKET_COLORS[b as SurveillanceBucket];
              return (
                <button
                  type="button"
                  key={b}
                  onClick={() => setActiveBucket(b)}
                  className="px-2 py-0.5 text-[9px] font-mono rounded border transition-colors flex-shrink-0"
                  style={{
                    color: isActive ? color : "oklch(0.5 0.008 240)",
                    borderColor: isActive
                      ? `${color}60`
                      : "rgba(255,255,255,0.08)",
                    background: isActive ? `${color}14` : "transparent",
                  }}
                  data-ocid={`surveillance.bucket.tab.${b}`}
                >
                  {label} <span style={{ opacity: 0.6 }}>({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Diagnostics strip ── */}
      <DiagnosticsStrip diagnostics={surveillance.diagnostics} />

      {/* ── Source legend ── */}
      <div className="flex-shrink-0 px-4 py-1.5 border-b border-border/20 flex items-center gap-3 flex-wrap">
        <span className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-widest">
          Source
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[8px] font-mono text-[#67E8F9]/60">
            ▦ AUTO — auto-selected by engine
          </span>
          <span className="text-[8px] font-mono text-[#FACC15]/60">
            ★ PINNED — operator pinned
          </span>
          <span className="text-[8px] font-mono text-[#a78bfa]/60">
            ● BOTH — auto + pinned
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          {displayedCandidates.length === 0 ? (
            <EmptyState isLive={isLive} />
          ) : (
            <div className="space-y-2">
              {displayedCandidates.map((candidate) => (
                <SurveillanceCard
                  key={candidate.asset}
                  candidate={candidate}
                  onPin={surveillance.pinAsset}
                  onUnpin={surveillance.unpinAsset}
                  onSetPriority={(asset, level: SurveillancePriorityLevel) =>
                    surveillance.setPriorityOverride(asset, level)
                  }
                  onClearPriority={surveillance.clearPriorityOverride}
                  onDismiss={surveillance.dismissCandidate}
                  isPinned={surveillance.isPinned(candidate.asset)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
