// D16 Hybrid v0.8.1 — Surveillance Tab
// v0.9 UX: Card tap → CandidateDetailSheet (unified detail surface).
//          Diagnostics / source legend collapsed behind [DIAGNOSTICS ▼] toggle.
//          QuickPinInput moved just above filter row.
//          Compact header: title + mode badge + monitored count on one line.
// v0.8.2+: MOCK badge replaced with [DEV] chip. EmptyState mode-aware.

import { ScrollArea } from "@/components/ui/scroll-area";
import { useRef, useState } from "react";
import { useIsMobile } from "../hooks/use-mobile";
import type { EntryEngineOutput } from "../hybridTypes";
import type { SurveillanceCandidate } from "../surveillanceTypes";
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
import { CandidateDetailSheet } from "./CandidateDetailSheet";
import { SurveillanceCard } from "./SurveillanceCard";

// ─── Bucket types ──────────────────────────────────────────────────────

const BUCKET_ALL = "ALL" as const;
type BucketFilter = SurveillanceBucket | typeof BUCKET_ALL;

// ─── Build EntryEngineOutput from SurveillanceCandidate ───────────────────────────
// Type bridge: maps candidate.currentRecord fields to EntryEngineOutput shape.

function buildEntryFromCandidate(
  candidate: SurveillanceCandidate,
): EntryEngineOutput {
  const { currentRecord } = candidate;
  return {
    asset: candidate.asset,
    permitted:
      currentRecord.permissionLevel === "EXACT" ||
      currentRecord.permissionLevel === "PROVISIONAL",
    side: currentRecord.side,
    permissionLevel:
      currentRecord.permissionLevel as EntryEngineOutput["permissionLevel"],
    entryClass: currentRecord.entryClass as EntryEngineOutput["entryClass"],
    confirmationStrength: currentRecord.crossMarketConfirmation,
    invalidationClarity: currentRecord.runtimeTrust,
    rewardFeasibility: currentRecord.runtimeTrust,
    strongestConfirmingMarket:
      currentRecord.leadMarket as EntryEngineOutput["strongestConfirmingMarket"],
    laggingOrBlockingMarket:
      "NONE" as EntryEngineOutput["laggingOrBlockingMarket"],
    mainBlocker: currentRecord.mainBlocker ?? null,
    nextUnlockCondition: currentRecord.mainBlocker
      ? null
      : "Continue monitoring",
    reasoningSummary:
      candidate.lastImportantChange ??
      `${currentRecord.permissionLevel} — ${currentRecord.entryClass}`,
  };
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ engineMode }: { engineMode: string }) {
  const isDevMode = engineMode === "MOCK";
  return (
    <div
      className="flex flex-col items-center justify-center py-16 text-center"
      data-ocid="surveillance.empty_state"
    >
      <span className="text-[11px] font-mono text-muted-foreground/40">
        No candidates under surveillance yet.
      </span>
      <span className="text-[9px] font-mono text-muted-foreground/25 mt-2 max-w-[260px] leading-relaxed">
        {isDevMode
          ? "Switch to LIVE or HYBRID mode and open the UNIVERSE tab to begin discovery and ranking."
          : "Universe ranking will auto-add the top candidates. You can also pin any asset from the UNIVERSE tab."}
      </span>
    </div>
  );
}

// ─── Quick pin input ──────────────────────────────────────────────────────────

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
        placeholder="PIN ASSET (e.g. SUI, TIA...)"
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

// ─── Diagnostics panel ───────────────────────────────────────────────────────────

function DiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: UseSurveillanceResult["diagnostics"];
}) {
  if (diagnostics.total === 0) return null;
  return (
    <div className="px-0 py-1.5 space-y-1.5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-widest">
          Coverage
        </span>
        <span className="text-[8px] font-mono text-muted-foreground/50">
          {diagnostics.total} total
        </span>
        <span className="text-[8px] font-mono text-[#67E8F9]/60">
          ▦ {diagnostics.fromOriginal8} anchor
        </span>
        <span
          className="text-[8px] font-mono"
          style={{
            color:
              diagnostics.beyondOriginal8 > 0
                ? "#a78bfa"
                : "rgba(156,163,175,0.4)",
          }}
        >
          ◉ {diagnostics.beyondOriginal8} universe
        </span>
        {diagnostics.stubsAwaitingHydration > 0 && (
          <span className="text-[8px] font-mono text-[#F97316]/60">
            ⧗ {diagnostics.stubsAwaitingHydration} awaiting
          </span>
        )}
        {diagnostics.hydrated > 0 && (
          <span className="text-[8px] font-mono text-[#22C55E]/50">
            ✓ {diagnostics.hydrated} hydrated
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-widest">
          Source
        </span>
        <span className="text-[8px] font-mono text-[#67E8F9]/60">▦ AUTO</span>
        <span className="text-[8px] font-mono text-[#FACC15]/60">★ PINNED</span>
        <span className="text-[8px] font-mono text-[#a78bfa]/60">● BOTH</span>
      </div>
    </div>
  );
}

// ─── Runtime mode badge ───────────────────────────────────────────────────────

function ModeBadge({ engineMode }: { engineMode: string }) {
  if (engineMode === "LIVE") {
    return (
      <span
        className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
        style={{
          color: "#22C55E",
          background: "#052010",
          borderColor: "#0f5030",
        }}
      >
        LIVE
      </span>
    );
  }
  if (engineMode === "HYBRID_LIVE") {
    return (
      <span
        className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
        style={{
          color: "#67E8F9",
          background: "#0d1f30",
          borderColor: "#1a4a6a",
        }}
      >
        HYBRID
      </span>
    );
  }
  // DEV/MOCK — small, muted, unobtrusive
  return (
    <span
      className="text-[8px] font-mono px-1 py-0.5 rounded border opacity-60"
      style={{
        color: "#92400e",
        background: "#1a0d00",
        borderColor: "#3a2000",
      }}
    >
      [DEV]
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────────────

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
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  // Detail sheet state
  const [detailSheetAsset, setDetailSheetAsset] = useState<string | null>(null);

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

  const visibleBuckets: BucketFilter[] = [
    BUCKET_ALL,
    ...SURVEILLANCE_BUCKET_ORDER.filter((b) => (bucketCounts[b] ?? 0) > 0),
  ];

  // Build detail sheet data for selected candidate
  const detailSheetCandidate = detailSheetAsset
    ? (surveillance.candidates.find((c) => c.asset === detailSheetAsset) ??
      null)
    : null;

  const detailSheetEntry = detailSheetCandidate
    ? buildEntryFromCandidate(detailSheetCandidate)
    : null;

  const detailSheetEvents = detailSheetCandidate
    ? detailSheetCandidate.events.slice(-5)
    : [];

  const detailSheetPriceData =
    detailSheetCandidate?.currentRecord?.priceData ?? null;

  return (
    <div
      className="flex flex-col h-full min-h-0"
      data-ocid="surveillance.tab.panel"
    >
      {/* ── Compact Header ── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
        {/* Title row — all on one line */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-foreground">
              SURVEILLANCE
            </span>
            <ModeBadge engineMode={engineMode} />
            <span className="text-[9px] font-mono text-muted-foreground/50">
              {surveillance.totalMonitored} monitored
            </span>
            <span className="text-[8px] font-mono text-[#67E8F9]/50">
              {surveillance.autoSelectedCount} auto
            </span>
            <span className="text-[8px] font-mono text-[#FACC15]/50">
              {surveillance.pinnedCount} pinned
            </span>
            {surveillance.lastEventAt && (
              <span className="text-[8px] font-mono text-muted-foreground/30">
                ·
                {new Date(surveillance.lastEventAt).toLocaleTimeString(
                  "en-US",
                  { hour: "2-digit", minute: "2-digit", hour12: false },
                )}
              </span>
            )}
          </div>

          {/* Diagnostics toggle */}
          <button
            type="button"
            onClick={() => setShowDiagnostics((v) => !v)}
            className={`text-[8px] font-mono px-2 py-1 rounded border transition-colors flex-shrink-0 ${
              showDiagnostics
                ? "bg-accent/30 text-foreground border-primary/30"
                : "text-muted-foreground border-border/40 hover:text-foreground"
            }`}
            data-ocid="surveillance.diagnostics.toggle"
          >
            DIAG {showDiagnostics ? "▲" : "▼"}
          </button>
        </div>

        {/* Collapsed diagnostics panel */}
        {showDiagnostics && (
          <div className="mb-2 pb-2 border-b border-border/20">
            <DiagnosticsPanel diagnostics={surveillance.diagnostics} />
          </div>
        )}

        {/* Quick pin input — just above filter */}
        <div className="mb-2">
          <QuickPinInput onPin={surveillance.pinAsset} />
        </div>

        {/* Bucket selector */}
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

      {/* ── Content ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          {displayedCandidates.length === 0 ? (
            <EmptyState engineMode={engineMode} />
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
                  onOpenDetail={(asset) => setDetailSheetAsset(asset)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Candidate Detail Sheet ── */}
      <CandidateDetailSheet
        asset={detailSheetAsset}
        entryOutput={detailSheetEntry}
        correlation={null}
        surveillanceEvents={detailSheetEvents}
        hybridBundle={null}
        priceData={detailSheetPriceData}
        isWatched={true}
        engineMode={engineMode}
        onClose={() => setDetailSheetAsset(null)}
        onWatch={() => {
          /* already watched */
        }}
      />
    </div>
  );
}
