// D16 Engine Lab — Top Hybrid Candidates Bar
// Replaces the old fixed 8-symbol strip in the Hybrid section.
// Dynamically populated from: Universe ranked records + Surveillance candidates.
// Priority order: EXACT → high-quality PROVISIONAL → EXACT_NOW/NEAR_EXACT Surveillance → top Universe ranked.
// Tapping a chip opens CandidateDetailSheet.

import { useMemo, useState } from "react";
import type {
  DivergenceType,
  HybridAssetBundle,
  HybridPermission,
  LeadMarket,
} from "../hybridTypes";
import type { SurveillanceCandidate } from "../surveillanceTypes";
import type { UniverseTopEntryRecord } from "../universeTypes";
import { CandidateDetailSheet } from "./CandidateDetailSheet";
import { buildEntryFromRecord } from "./EntryDetailCard";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TopHybridChip = {
  asset: string;
  side: "LONG" | "SHORT" | "NONE";
  permissionLevel: string;
  entryClass: string;
  runtimeTrust: number;
  crossMarketConfirmation: number;
  mainBlocker: string | null;
  source: "EXACT" | "PROVISIONAL" | "SURVEILLANCE" | "RANKED";
  // Rank score for secondary sorting
  rankScore: number;
};

type TopHybridCandidatesBarProps = {
  rankedRecords: UniverseTopEntryRecord[];
  surveillanceCandidates: SurveillanceCandidate[];
  hybridBundles?: HybridAssetBundle[];
  selectedAsset: string | null;
  onSelectAsset: (asset: string) => void;
  maxChips?: number;
};

// ─── Priority utilities ───────────────────────────────────────────────────────

const PERMISSION_PRIORITY: Record<string, number> = {
  EXACT: 100,
  PROVISIONAL: 75,
  PROJECTED_ONLY: 40,
  WATCH_ONLY: 20,
  BLOCKED: 0,
};

const BUCKET_PRIORITY: Record<string, number> = {
  EXACT_NOW: 95,
  NEAR_EXACT: 70,
  ESCALATING: 50,
  STABLE_HIGH: 40,
  DEGRADING: 20,
  THESIS_BROKEN: 5,
  DROPPED: 0,
};

// ─── Derive top candidates (pure, memoizable) ─────────────────────────────────

export function deriveTopCandidates(
  rankedRecords: UniverseTopEntryRecord[],
  surveillanceCandidates: SurveillanceCandidate[],
  maxChips = 8,
): TopHybridChip[] {
  const seen = new Set<string>();
  const chips: TopHybridChip[] = [];

  // Build surveillance lookup for quick access
  const survMap = new Map<string, SurveillanceCandidate>();
  for (const c of surveillanceCandidates) {
    survMap.set(c.asset, c);
  }

  // 1. EXACT candidates from Universe ranking (highest overallRankScore first)
  const exactRecords = rankedRecords
    .filter((r) => r.permissionLevel === "EXACT")
    .sort((a, b) => b.overallRankScore - a.overallRankScore);

  for (const r of exactRecords) {
    if (seen.has(r.asset)) continue;
    seen.add(r.asset);
    chips.push({
      asset: r.asset,
      side: r.side,
      permissionLevel: r.permissionLevel,
      entryClass: r.entryClass,
      runtimeTrust: r.runtimeTrust,
      crossMarketConfirmation: r.crossMarketConfirmation,
      mainBlocker: r.mainBlocker,
      source: "EXACT",
      rankScore: r.overallRankScore,
    });
  }

  // 2. High-quality PROVISIONAL candidates (trust > 50, confirmation > 55)
  const provisionalRecords = rankedRecords
    .filter(
      (r) =>
        r.permissionLevel === "PROVISIONAL" &&
        r.runtimeTrust >= 50 &&
        r.crossMarketConfirmation >= 55,
    )
    .sort((a, b) => b.overallRankScore - a.overallRankScore);

  for (const r of provisionalRecords) {
    if (seen.has(r.asset)) continue;
    seen.add(r.asset);
    chips.push({
      asset: r.asset,
      side: r.side,
      permissionLevel: r.permissionLevel,
      entryClass: r.entryClass,
      runtimeTrust: r.runtimeTrust,
      crossMarketConfirmation: r.crossMarketConfirmation,
      mainBlocker: r.mainBlocker,
      source: "PROVISIONAL",
      rankScore: r.overallRankScore,
    });
  }

  // 3. EXACT_NOW + NEAR_EXACT Surveillance candidates not already included
  const prioritySurvBuckets = new Set(["EXACT_NOW", "NEAR_EXACT"]);
  const prioritySurv = surveillanceCandidates
    .filter((c) => prioritySurvBuckets.has(c.bucket))
    .sort(
      (a, b) =>
        (BUCKET_PRIORITY[b.bucket] ?? 0) +
        (PERMISSION_PRIORITY[b.currentRecord?.permissionLevel ?? ""] ?? 0) -
        ((BUCKET_PRIORITY[a.bucket] ?? 0) +
          (PERMISSION_PRIORITY[a.currentRecord?.permissionLevel ?? ""] ?? 0)),
    );

  for (const c of prioritySurv) {
    if (seen.has(c.asset)) continue;
    // Prefer the latest ranked record; fall back to the stored currentRecord snapshot
    const ranked =
      rankedRecords.find((r) => r.asset === c.asset) ?? c.currentRecord;
    seen.add(c.asset);
    chips.push({
      asset: c.asset,
      side: ranked?.side ?? "NONE",
      permissionLevel: ranked?.permissionLevel ?? "WATCH_ONLY",
      entryClass: ranked?.entryClass ?? "NONE",
      runtimeTrust: ranked?.runtimeTrust ?? 0,
      crossMarketConfirmation: ranked?.crossMarketConfirmation ?? 0,
      mainBlocker: ranked?.mainBlocker ?? null,
      source: "SURVEILLANCE",
      rankScore: ranked?.overallRankScore ?? 50,
    });
  }

  // 4. Fill remaining slots from top Universe ranked (not yet added)
  if (chips.length < maxChips) {
    const remaining = rankedRecords
      .filter((r) => !seen.has(r.asset))
      .sort((a, b) => b.overallRankScore - a.overallRankScore);

    for (const r of remaining) {
      if (chips.length >= maxChips) break;
      seen.add(r.asset);
      chips.push({
        asset: r.asset,
        side: r.side,
        permissionLevel: r.permissionLevel,
        entryClass: r.entryClass,
        runtimeTrust: r.runtimeTrust,
        crossMarketConfirmation: r.crossMarketConfirmation,
        mainBlocker: r.mainBlocker,
        source: "RANKED",
        rankScore: r.overallRankScore,
      });
    }
  }

  return chips.slice(0, maxChips);
}

// ─── Badge colors ─────────────────────────────────────────────────────────────

function permColor(level: string): string {
  switch (level) {
    case "EXACT":
      return "#22C55E";
    case "PROVISIONAL":
      return "#67E8F9";
    case "PROJECTED_ONLY":
      return "#93C5FD";
    case "WATCH_ONLY":
      return "#FACC15";
    case "BLOCKED":
      return "#EF4444";
    default:
      return "#9CA3AF";
  }
}

function permBg(level: string): string {
  switch (level) {
    case "EXACT":
      return "oklch(0.17 0.05 142)";
    case "PROVISIONAL":
      return "oklch(0.15 0.04 210)";
    case "PROJECTED_ONLY":
      return "oklch(0.14 0.04 230)";
    case "WATCH_ONLY":
      return "oklch(0.17 0.06 80)";
    case "BLOCKED":
      return "oklch(0.14 0.05 25)";
    default:
      return "oklch(0.13 0.005 240)";
  }
}

function sideColor(side: string): string {
  if (side === "LONG") return "#22C55E";
  if (side === "SHORT") return "#EF4444";
  return "#6B7280";
}

function sideSymbol(side: string): string {
  if (side === "LONG") return "▲";
  if (side === "SHORT") return "▼";
  return "—";
}

function entryClassShort(cls: string): string {
  switch (cls) {
    case "BREAKOUT":
      return "BRK";
    case "RECLAIM":
      return "RCL";
    case "PULLBACK":
      return "PBK";
    case "CONTINUATION":
      return "CNT";
    case "REVERSAL":
      return "REV";
    case "NONE":
      return "";
    default:
      return cls.slice(0, 3);
  }
}

function permLabelShort(level: string): string {
  switch (level) {
    case "EXACT":
      return "EX";
    case "PROVISIONAL":
      return "PRV";
    case "PROJECTED_ONLY":
      return "PRJ";
    case "WATCH_ONLY":
      return "WCH";
    case "BLOCKED":
      return "BLK";
    default:
      return level.slice(0, 3);
  }
}

// Trust dot: green/yellow/red
function TrustDot({ value }: { value: number }) {
  const color = value >= 70 ? "#22C55E" : value >= 45 ? "#FACC15" : "#EF4444";
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ background: color }}
      title={`Trust ${Math.round(value)}`}
    />
  );
}

// ─── Single chip ──────────────────────────────────────────────────────────────

function CandidateChip({
  chip,
  isSelected,
  onTap,
}: {
  chip: TopHybridChip;
  isSelected: boolean;
  onTap: () => void;
}) {
  const pColor = permColor(chip.permissionLevel);
  const pBg = permBg(chip.permissionLevel);
  const sColor = sideColor(chip.side);
  const sSymbol = sideSymbol(chip.side);
  const cls = entryClassShort(chip.entryClass);
  const permLabel = permLabelShort(chip.permissionLevel);

  return (
    <button
      type="button"
      onClick={onTap}
      className="flex-shrink-0 flex flex-col items-start gap-0.5 rounded-lg transition-all min-h-[52px] cursor-pointer select-none"
      style={{
        background: isSelected ? pBg : "oklch(0.13 0.007 240)",
        border: `1.5px solid ${isSelected ? pColor : "oklch(0.22 0.007 240)"}`,
        padding: "6px 8px",
        minWidth: "72px",
        maxWidth: "90px",
        outline: isSelected ? `1px solid ${pColor}30` : "none",
        outlineOffset: "2px",
      }}
      data-ocid={`hybrid.top_bar.chip.${chip.asset}`}
    >
      {/* Row 1: Asset name + side */}
      <div className="flex items-center gap-1 w-full">
        <span className="text-[11px] font-mono font-bold text-foreground truncate leading-none">
          {chip.asset}
        </span>
        <span
          className="text-[9px] font-mono font-bold flex-shrink-0 leading-none"
          style={{ color: sColor }}
        >
          {sSymbol}
        </span>
      </div>
      {/* Row 2: Permission pill */}
      <div
        className="text-[8px] font-mono font-bold rounded px-1 py-0.5 leading-none"
        style={{
          color: pColor,
          background: `${pColor}18`,
          border: `1px solid ${pColor}30`,
        }}
      >
        {permLabel}
      </div>
      {/* Row 3: Entry class + trust */}
      <div className="flex items-center gap-1">
        {cls && (
          <span className="text-[8px] font-mono text-muted-foreground/60 leading-none">
            {cls}
          </span>
        )}
        <TrustDot value={chip.runtimeTrust} />
      </div>
    </button>
  );
}

// ─── Main Bar ─────────────────────────────────────────────────────────────────

export function TopHybridCandidatesBar({
  rankedRecords,
  surveillanceCandidates,
  hybridBundles = [],
  selectedAsset,
  onSelectAsset,
  maxChips = 8,
}: TopHybridCandidatesBarProps) {
  // Sheet state (managed inside the bar)
  const [sheetAsset, setSheetAsset] = useState<string | null>(null);

  const chips = useMemo(
    () => deriveTopCandidates(rankedRecords, surveillanceCandidates, maxChips),
    [rankedRecords, surveillanceCandidates, maxChips],
  );

  // Build detail props for sheet
  const sheetRecord = useMemo(
    () =>
      sheetAsset
        ? (rankedRecords.find((r) => r.asset === sheetAsset) ?? null)
        : null,
    [rankedRecords, sheetAsset],
  );

  const sheetEntry = useMemo(
    () => (sheetRecord ? buildEntryFromRecord(sheetRecord) : null),
    [sheetRecord],
  );

  const sheetHybridBundle = useMemo(
    () =>
      sheetAsset
        ? (hybridBundles.find((b) => b.assetState.asset === sheetAsset) ?? null)
        : null,
    [sheetAsset, hybridBundles],
  );

  const sheetSurvCandidate = useMemo(
    () =>
      sheetAsset
        ? (surveillanceCandidates.find((c) => c.asset === sheetAsset) ?? null)
        : null,
    [sheetAsset, surveillanceCandidates],
  );

  const sheetPriceData = useMemo(
    () => sheetRecord?.priceData ?? null,
    [sheetRecord],
  );

  // No candidates yet
  if (chips.length === 0) {
    return (
      <div
        className="flex items-center px-4 py-3 border-b border-border/30"
        style={{ minHeight: "72px" }}
      >
        <div className="text-[10px] font-mono text-muted-foreground/40">
          {rankedRecords.length === 0
            ? "Awaiting live universe ranking…"
            : "No top candidates available"}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Bar header */}
      <div
        className="flex-shrink-0 px-3 pt-2 pb-0.5 flex items-center justify-between"
        data-ocid="hybrid.top_bar.header"
      >
        <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">
          Top Candidates
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/30">
          {chips.length} shown
        </span>
      </div>

      {/* Scrollable chip row */}
      <div
        className="flex-shrink-0 flex items-stretch gap-2 overflow-x-auto px-3 pb-3 pt-1"
        style={{ scrollbarWidth: "none" }}
        data-ocid="hybrid.top_bar.chips"
      >
        {chips.map((chip) => (
          <CandidateChip
            key={chip.asset}
            chip={chip}
            isSelected={chip.asset === selectedAsset}
            onTap={() => {
              onSelectAsset(chip.asset);
              setSheetAsset(chip.asset);
            }}
          />
        ))}
      </div>

      {/* Detail sheet */}
      <CandidateDetailSheet
        asset={sheetAsset}
        entryOutput={sheetEntry}
        correlation={
          sheetHybridBundle?.correlation ??
          (sheetRecord
            ? {
                asset: sheetRecord.asset,
                leadMarket: sheetRecord.leadMarket as LeadMarket,
                laggingMarket: (sheetRecord.laggingOrBlockingMarket ??
                  "NONE") as LeadMarket,
                divergenceType: sheetRecord.divergenceType as DivergenceType,
                hybridPermission:
                  sheetRecord.permissionLevel as HybridPermission,
                crossMarketConfirmation: sheetRecord.crossMarketConfirmation,
                directionAgreement: sheetRecord.crossMarketConfirmation,
                maturityAgreement: sheetRecord.crossMarketConfirmation * 0.8,
                trustAgreement: sheetRecord.runtimeTrust,
                structuralConfirmation: sheetRecord.confirmationStrength,
                mainBlocker: sheetRecord.mainBlocker,
                nextUnlockCondition: sheetRecord.nextUnlockCondition ?? null,
                leadReason: sheetRecord.whyRanked[0] ?? "",
                lagReason: sheetRecord.mainBlocker ?? "",
              }
            : null)
        }
        surveillanceEvents={sheetSurvCandidate?.events?.slice(-5)}
        hybridBundle={sheetHybridBundle}
        priceData={sheetPriceData}
        isWatched={false}
        onClose={() => setSheetAsset(null)}
        onWatch={() => {}}
      />
    </>
  );
}
