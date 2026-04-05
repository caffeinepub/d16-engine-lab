// D16 Hybrid v0.8 — Universe Board
// Top-level operator board for full-universe ranked entry selection.
// Categories: Exact Now / Provisional / Watch / Futures Leads / Spot Confirms / Entry Class buckets
// Mobile: stacked cards. Desktop: table view.
// v0.8.1: added onWatchAsset prop for quick-pin to Surveillance.

import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState } from "react";
import { useIsMobile } from "../hooks/use-mobile";
import type {
  TopEntryCategory,
  UniverseTopEntryRecord,
} from "../universeTypes";
import type {
  UniverseAsset,
  UniverseEligibilityRecord,
  UniverseRuntimeStatus,
  UniverseTierAssignment,
} from "../universeTypes";
import {
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  UniverseAssetCard,
  UniverseTableRow,
} from "./UniverseAssetCard";
import { UniverseDiagnostics } from "./UniverseDiagnostics";

// ─── Source labels ────────────────────────────────────────────────────────────

function SourceLabel({
  engineMode,
  isMockMode,
}: {
  engineMode: string;
  isMockMode: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        <span className="text-[8px] font-mono text-muted-foreground/40 uppercase">
          Runtime
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/70">
          {engineMode}
        </span>
      </div>
      <span className="text-muted-foreground/30">·</span>
      <div className="flex items-center gap-1">
        <span className="text-[8px] font-mono text-muted-foreground/40 uppercase">
          View
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/70">
          {isMockMode ? "Mock Universe" : "Live Universe"}
        </span>
      </div>
      <span className="text-muted-foreground/30">·</span>
      <div className="flex items-center gap-1">
        <span className="text-[8px] font-mono text-muted-foreground/40 uppercase">
          Ranking
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/70">
          {isMockMode ? "Mock Top Selector" : "Live Top Selector"}
        </span>
      </div>
    </div>
  );
}

// ─── Category filter ────────────────────────────────────────────────────────────

const CATEGORY_ALL = "ALL" as const;
type CategoryFilter = TopEntryCategory | typeof CATEGORY_ALL;

function filterRecordsByCategory(
  records: UniverseTopEntryRecord[],
  category: CategoryFilter,
): UniverseTopEntryRecord[] {
  if (category === CATEGORY_ALL) return records;
  return records
    .filter((r) => r.activeCategories.includes(category))
    .sort(
      (a, b) =>
        (b.categoryRanks[category] ?? 0) - (a.categoryRanks[category] ?? 0),
    );
}

// Count assets in each category
function getCategoryCounts(
  records: UniverseTopEntryRecord[],
): Record<CategoryFilter, number> {
  const counts: Record<string, number> = { ALL: records.length };
  for (const cat of ALL_CATEGORIES) {
    counts[cat] = records.filter((r) =>
      r.activeCategories.includes(cat),
    ).length;
  }
  return counts as Record<CategoryFilter, number>;
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyCategory({
  category,
  isMockMode,
  discoveryPhase,
}: { category: CategoryFilter; isMockMode: boolean; discoveryPhase: string }) {
  const isDiscovering =
    !isMockMode &&
    (discoveryPhase === "FETCHING" ||
      discoveryPhase === "MAPPING" ||
      discoveryPhase === "FILTERING" ||
      discoveryPhase === "TIERING" ||
      discoveryPhase === "IDLE");
  const isError = !isMockMode && discoveryPhase === "ERROR";
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {isDiscovering ? (
        <>
          <span className="text-[11px] font-mono text-[#22C55E]/60 animate-pulse">
            {discoveryPhase === "IDLE"
              ? "Starting universe discovery..."
              : `Universe ${discoveryPhase} ...`}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/30 mt-1">
            Anchors will appear as live states arrive
          </span>
        </>
      ) : isError ? (
        <>
          <span className="text-[11px] font-mono text-red-400/60">
            Discovery error — showing anchor assets only
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/30 mt-1">
            Live adapter states still hydrating
          </span>
        </>
      ) : (
        <>
          <span className="text-[11px] font-mono text-muted-foreground/40">
            No assets in{" "}
            {category === "ALL"
              ? "universe"
              : CATEGORY_LABELS[category as TopEntryCategory]}
          </span>
          {isMockMode && (
            <span className="text-[9px] font-mono text-[#FACC15]/60 mt-2">
              Showing mock universe — switch to LIVE for full coverage
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type UniverseBoardProps = {
  rankedRecords: UniverseTopEntryRecord[];
  runtimeStatus: UniverseRuntimeStatus;
  assets: Map<string, UniverseAsset>;
  eligibility: Map<string, UniverseEligibilityRecord>;
  tiers: Map<string, UniverseTierAssignment>;
  isMockMode: boolean;
  mockModeNotice: string | null;
  engineMode: string;
  selectedAsset: string | null;
  onSelectAsset: (asset: string) => void;
  onWatchAsset?: (asset: string) => void; // v0.8.1: quick-pin to Surveillance
};

export function UniverseBoard({
  rankedRecords,
  runtimeStatus,
  assets,
  eligibility,
  tiers,
  isMockMode,
  mockModeNotice,
  engineMode,
  selectedAsset,
  onSelectAsset,
  onWatchAsset,
}: UniverseBoardProps) {
  const isMobile = useIsMobile();
  const [activeCategory, setActiveCategory] =
    useState<CategoryFilter>(CATEGORY_ALL);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const categoryCounts = useMemo(
    () => getCategoryCounts(rankedRecords),
    [rankedRecords],
  );
  const filteredRecords = useMemo(
    () => filterRecordsByCategory(rankedRecords, activeCategory),
    [rankedRecords, activeCategory],
  );

  // Categories that have at least 1 record (plus ALL)
  const visibleCategories: CategoryFilter[] = useMemo(() => {
    const withCounts: CategoryFilter[] = [CATEGORY_ALL];
    for (const cat of ALL_CATEGORIES) {
      if ((categoryCounts[cat] ?? 0) > 0) withCounts.push(cat);
    }
    return withCounts;
  }, [categoryCounts]);

  return (
    <div
      className="flex flex-col h-full min-h-0"
      data-ocid="universe.board.panel"
    >
      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-semibold text-foreground">
                UNIVERSE
              </span>
              {isMockMode && (
                <span className="text-[9px] font-mono text-[#FACC15] bg-[#1a1000] border border-[#3a2800] px-1.5 py-0.5 rounded">
                  MOCK MODE
                </span>
              )}
              {!isMockMode && (
                <span className="text-[9px] font-mono text-[#22C55E] bg-[#052010] border border-[#0f5030] px-1.5 py-0.5 rounded">
                  LIVE
                </span>
              )}
            </div>
            <SourceLabel engineMode={engineMode} isMockMode={isMockMode} />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {!isMockMode && (
              <div className="text-right hidden sm:block">
                <div className="text-[11px] font-mono text-muted-foreground/60">
                  {runtimeStatus.discoveredAssets} discovered
                </div>
                <div className="text-[9px] font-mono text-muted-foreground/40">
                  {runtimeStatus.tierCounts.tier1}T1 /{" "}
                  {runtimeStatus.tierCounts.tier2}T2 /{" "}
                  {runtimeStatus.tierCounts.tier3}T3
                </div>
              </div>
            )}
            {onWatchAsset && (
              <span className="text-[8px] font-mono text-[#FACC15]/50 hidden sm:inline">
                WATCH = pin to surveillance
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowDiagnostics((d) => !d)}
              className={`px-2 py-1 text-[9px] font-mono rounded border transition-colors ${
                showDiagnostics
                  ? "bg-accent/30 text-foreground border-primary/30"
                  : "text-muted-foreground border-border hover:text-foreground"
              }`}
              data-ocid="universe.diagnostics.toggle_btn"
            >
              DIAG
            </button>
          </div>
        </div>

        {/* Mock mode notice */}
        {mockModeNotice && (
          <div className="mb-2 px-2 py-1.5 border border-[#3a2800]/60 rounded bg-[#0d0900] text-[9px] font-mono text-[#FACC15]/70 leading-relaxed">
            {mockModeNotice}
          </div>
        )}

        {/* Diagnostics panel */}
        {showDiagnostics && (
          <div className="mb-2">
            <UniverseDiagnostics
              runtimeStatus={runtimeStatus}
              assets={assets}
              eligibility={eligibility}
              tiers={tiers}
              isMockMode={isMockMode}
            />
          </div>
        )}

        {/* Category selector — mobile: dropdown, desktop: scrollable pill bar */}
        {isMobile ? (
          <select
            value={activeCategory}
            onChange={(e) =>
              setActiveCategory(e.target.value as CategoryFilter)
            }
            className="w-full bg-[#0d1218] border border-border/40 rounded px-2 py-1.5 text-[10px] font-mono text-foreground"
            data-ocid="universe.category.selector"
          >
            <option value="ALL">ALL ({categoryCounts[CATEGORY_ALL]})</option>
            {ALL_CATEGORIES.map((cat) => (
              <option
                key={cat}
                value={cat}
                disabled={(categoryCounts[cat] ?? 0) === 0}
              >
                {CATEGORY_LABELS[cat]} ({categoryCounts[cat] ?? 0})
              </option>
            ))}
          </select>
        ) : (
          <div
            className="flex items-center gap-1 overflow-x-auto pb-0.5"
            data-ocid="universe.category.tabs"
          >
            {visibleCategories.map((cat) => {
              const label =
                cat === CATEGORY_ALL
                  ? "All"
                  : CATEGORY_LABELS[cat as TopEntryCategory];
              const count = categoryCounts[cat] ?? 0;
              const isActive = activeCategory === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-0.5 text-[9px] font-mono rounded border transition-colors flex-shrink-0 ${
                    isActive
                      ? "bg-[#0d2540] text-[#67E8F9] border-[#1a4080]"
                      : "text-muted-foreground border-border/40 hover:text-foreground hover:border-primary/30"
                  }`}
                  data-ocid={`universe.category.tab.${cat}`}
                >
                  {label} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3">
          {filteredRecords.length === 0 ? (
            <EmptyCategory
              category={activeCategory}
              isMockMode={isMockMode}
              discoveryPhase={runtimeStatus.discoveryPhase}
            />
          ) : isMobile ? (
            /* Mobile: stacked cards */
            <div className="space-y-2">
              {filteredRecords.map((record, idx) => (
                <UniverseAssetCard
                  key={record.asset}
                  record={record}
                  rank={idx + 1}
                  onSelect={onSelectAsset}
                  isSelected={selectedAsset === record.asset}
                  onWatch={onWatchAsset}
                />
              ))}
            </div>
          ) : (
            /* Desktop: table */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40">
                    {[
                      "#",
                      "Asset",
                      "Tier",
                      "Side",
                      "Permission",
                      "Class",
                      "X-Mkt Conf",
                      "Lead Mkt",
                      "Divergence",
                      "Trust",
                      "Blocker / Rank",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-2 py-1.5 text-left text-[8px] font-mono text-muted-foreground/50 uppercase tracking-wider font-normal"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record, idx) => (
                    <UniverseTableRow
                      key={record.asset}
                      record={record}
                      rank={idx + 1}
                      onSelect={onSelectAsset}
                      isSelected={selectedAsset === record.asset}
                      onWatch={onWatchAsset}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
