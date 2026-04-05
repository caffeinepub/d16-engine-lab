// D16 Hybrid v0.8.1 — Surveillance Hook
// Wires Universe ranking output into the priority surveillance layer.
// Auto-selects top-N ranked candidates. Supports operator pin/unpin.
// Persists full state to localStorage.
//
// v0.8.1 fix: Full-universe capable. Any asset from the Universe ranked set
// — whether in the original 8 or a newly-discovered broader-market asset —
// can be pinned, auto-added, and fully tracked. Lazy initialization ensures
// a candidate record is always created on first open/pin/auto-add, never
// failing or remaining unavailable.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  appendEvents,
  buildPriority,
  deriveBucket,
  detectChanges,
  sortCandidates,
} from "./surveillanceEngine";
import {
  emptyState,
  loadSurveillanceState,
  saveSurveillanceState,
} from "./surveillanceStorage";
import type {
  SurveillanceBucket,
  SurveillanceCandidate,
  SurveillanceCandidateSource,
  SurveillancePriorityLevel,
  SurveillanceState,
  UseSurveillanceResult,
} from "./surveillanceTypes";
import {
  CANONICAL_ANCHOR_ASSETS_SET,
  PERMISSION_ORDER,
  SURVEILLANCE_AUTO_TOP_N,
  SURVEILLANCE_BUCKET_ORDER,
} from "./surveillanceTypes";
import type { UniverseTopEntryRecord } from "./universeTypes";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCandidateSource(
  _asset: string,
  isAutoRanked: boolean,
  isPinned: boolean,
): SurveillanceCandidateSource {
  if (isAutoRanked && isPinned) return "BOTH";
  if (isPinned) return "OPERATOR_PINNED";
  return "AUTO_RANKED";
}

// Build a minimal valid UniverseTopEntryRecord stub for assets that have been
// pinned but have no current hydrated record in the universe ranked set.
// This enables lazy initialization: the candidate is created immediately,
// and will be updated with real data on the next ranking cycle.
function makeStubRecord(asset: string): UniverseTopEntryRecord {
  const now = Date.now();
  return {
    asset,
    tier: "TIER_1",
    eligibility: "ELIGIBLE",
    side: "NONE",
    permissionLevel: "WATCH_ONLY",
    entryClass: "NONE",
    hybridPermission: "WATCH_ONLY",
    crossMarketConfirmation: 0,
    runtimeTrust: 0,
    leadMarket: "NONE",
    divergenceType: "NONE",
    mainBlocker: "Awaiting first hydration",
    nextUnlockCondition: null,
    confirmationStrength: 0,
    invalidationClarity: 0,
    rewardFeasibility: 0,
    strongestConfirmingMarket: "NONE",
    laggingOrBlockingMarket: "NONE",
    overallRankScore: 0,
    categoryRanks: {},
    activeCategories: [],
    whyRanked: ["pinned — awaiting hydration"],
    outcomeEvidence: { hasHistory: false, patternPrecision: null, note: null },
    lastRecomputedAt: now,
    isStale: true,
  };
}

// Create a brand-new candidate from the first observation
function createCandidate(
  record: UniverseTopEntryRecord,
  rank: number,
  source: SurveillanceCandidateSource,
  initialNote?: string,
): SurveillanceCandidate {
  const now = Date.now();
  const description = initialNote
    ? initialNote
    : `Added to surveillance at rank #${rank} (${record.permissionLevel})`;
  const stub: SurveillanceCandidate = {
    asset: record.asset,
    source,
    currentRecord: record,
    previousRecord: null,
    currentRank: rank,
    previousRank: null,
    rankDelta: null,
    peakRank: rank,
    permissionAtEntry: record.permissionLevel,
    permissionChangedAt: null,
    bucket: "STABLE_HIGH",
    priority: { mode: "AUTO", derivedLevel: "MEDIUM", score: 50 },
    events: [
      {
        eventId: `${record.asset}-${now}-RANK_ENTRY`,
        asset: record.asset,
        category: "RANK_ENTRY",
        severity: "INFO",
        description,
        before: null,
        after: `#${rank}`,
        timestamp: now,
      },
    ],
    lastEventAt: now,
    lastImportantChange: description,
    addedAt: now,
    lastUpdatedAt: now,
    isStale: record.isStale,
    inCurrentTopSet: true,
  };
  // Derive initial bucket and priority
  stub.bucket = deriveBucket(stub);
  stub.priority = buildPriority(stub, null);
  return stub;
}

// Update an existing candidate with a new ranked record
function updateCandidate(
  existing: SurveillanceCandidate,
  record: UniverseTopEntryRecord,
  rank: number,
  source: SurveillanceCandidateSource,
  override: SurveillancePriorityLevel | null,
): SurveillanceCandidate {
  const now = Date.now();
  const newEvents = detectChanges(
    existing.asset,
    existing.currentRecord,
    record,
    existing.currentRank,
    rank,
  );
  const allEvents = appendEvents(existing.events, newEvents);

  const rankDelta = rank - existing.currentRank;
  const peakRank =
    existing.peakRank === null ? rank : Math.min(existing.peakRank, rank);

  const permissionChanged =
    existing.currentRecord.permissionLevel !== record.permissionLevel;

  const updated: SurveillanceCandidate = {
    ...existing,
    source,
    currentRecord: record,
    previousRecord: existing.currentRecord,
    currentRank: rank,
    previousRank: existing.currentRank,
    rankDelta,
    peakRank,
    permissionChangedAt: permissionChanged ? now : existing.permissionChangedAt,
    events: allEvents,
    lastEventAt: newEvents.length > 0 ? now : existing.lastEventAt,
    lastImportantChange:
      newEvents.length > 0
        ? newEvents[newEvents.length - 1].description
        : existing.lastImportantChange,
    lastUpdatedAt: now,
    isStale: record.isStale,
    inCurrentTopSet: true,
  };

  // Re-derive bucket and priority
  updated.bucket = deriveBucket(updated);
  updated.priority = buildPriority(updated, override);
  return updated;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────────

export function useSurveillance(
  rankedRecords: UniverseTopEntryRecord[],
): UseSurveillanceResult {
  const [surveillanceState, setSurveillanceState] = useState<SurveillanceState>(
    () => loadSurveillanceState() ?? emptyState(),
  );

  // Stable ref for the state so callbacks don't capture stale closures
  const stateRef = useRef(surveillanceState);
  stateRef.current = surveillanceState;

  // Persist on every change (debounced via ref to avoid write storm)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveSurveillanceState(surveillanceState);
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [surveillanceState]);

  // ── Process incoming ranked records on every universe update ──────────────────
  const rankedRecordsRef = useRef<UniverseTopEntryRecord[]>([]);

  useEffect(() => {
    // Skip if records haven't meaningfully changed
    const hasChanges =
      rankedRecords.length !== rankedRecordsRef.current.length ||
      rankedRecords.some(
        (r, i) =>
          r.asset !== rankedRecordsRef.current[i]?.asset ||
          r.permissionLevel !== rankedRecordsRef.current[i]?.permissionLevel ||
          r.overallRankScore !== rankedRecordsRef.current[i]?.overallRankScore,
      );

    if (!hasChanges && rankedRecords.length > 0) return;

    rankedRecordsRef.current = rankedRecords;

    setSurveillanceState((prev) => {
      const now = Date.now();
      const updatedCandidates: Record<string, SurveillanceCandidate> = {
        ...prev.candidates,
      };

      // Current top-N auto set
      const autoAssets = new Set<string>();
      for (
        let i = 0;
        i < Math.min(rankedRecords.length, SURVEILLANCE_AUTO_TOP_N);
        i++
      ) {
        autoAssets.add(rankedRecords[i].asset);
      }

      // All assets that should be monitored: auto top-N + pinned
      const pinnedSet = new Set<string>(prev.pinnedAssets);
      const monitoredAssets = new Set<string>([...autoAssets, ...pinnedSet]);

      // Build a rank map from the current records
      const rankMap = new Map<
        string,
        { record: UniverseTopEntryRecord; rank: number }
      >();
      for (let i = 0; i < rankedRecords.length; i++) {
        rankMap.set(rankedRecords[i].asset, {
          record: rankedRecords[i],
          rank: i + 1,
        });
      }

      // Process all monitored assets
      for (const asset of monitoredAssets) {
        const isAutoRanked = autoAssets.has(asset);
        const isPinned = pinnedSet.has(asset);
        const source = getCandidateSource(asset, isAutoRanked, isPinned);
        const override = prev.priorityOverrides[asset] ?? null;

        const entry = rankMap.get(asset);
        const existing = updatedCandidates[asset];

        if (entry) {
          // ── Asset is in the current ranked set ──────────────────────────
          if (!existing) {
            // New candidate — first time seen (works for ANY asset, not just original 8)
            updatedCandidates[asset] = createCandidate(
              entry.record,
              entry.rank,
              source,
            );
          } else {
            // Update existing — clears stale/stub state once real data arrives
            const wasStubRecord =
              existing.currentRecord.mainBlocker === "Awaiting first hydration";
            const updated = updateCandidate(
              existing,
              entry.record,
              entry.rank,
              source,
              override,
            );
            // If this was a stub, mark the transition clearly
            if (wasStubRecord) {
              updated.inCurrentTopSet = true;
              updated.isStale = false;
              updated.lastImportantChange = `Hydrated at rank #${entry.rank} (${entry.record.permissionLevel})`;
            }
            updatedCandidates[asset] = updated;
          }
        } else if (isPinned) {
          // ── Pinned asset not in current ranked set ───────────────────────
          // CRITICAL FIX: This handles both cases:
          //   a) Asset was in top set, now dropped
          //   b) Asset was NEVER in the ranked set (freshly pinned non-top-N asset)
          // Both must result in a valid candidate record — never a silent skip.

          if (!existing) {
            // LAZY INITIALIZATION: Asset pinned but never seen in ranked set yet.
            // Create a stub candidate immediately. It will be hydrated on next
            // ranking cycle when/if the asset appears in rankedRecords.
            const stubRecord = makeStubRecord(asset);
            updatedCandidates[asset] = createCandidate(
              stubRecord,
              9999, // placeholder rank — will update when first ranked
              "OPERATOR_PINNED",
              "Pinned — awaiting first ranking hydration",
            );
            // Mark as not yet in top set so it shows in DROPPED bucket
            updatedCandidates[asset] = {
              ...updatedCandidates[asset],
              inCurrentTopSet: false,
              bucket: "DROPPED",
              currentRank: 9999,
            };
          } else {
            // Pinned asset dropped from top set — mark as dropped but keep monitoring
            const droppedNow = existing.inCurrentTopSet;
            const updatedExisting: SurveillanceCandidate = {
              ...existing,
              source:
                existing.source === "AUTO_RANKED" ? "BOTH" : existing.source,
              inCurrentTopSet: false,
              isStale: true,
              bucket: "DROPPED",
              lastUpdatedAt: now,
              events: droppedNow
                ? appendEvents(existing.events, [
                    {
                      eventId: `${asset}-${now}-RANK_EXIT`,
                      asset,
                      category: "RANK_EXIT",
                      severity: "NEGATIVE",
                      description: "Dropped out of top-ranked universe set",
                      before: `#${existing.currentRank}`,
                      after: null,
                      timestamp: now,
                    },
                  ])
                : existing.events,
              lastEventAt: droppedNow ? now : existing.lastEventAt,
              lastImportantChange: droppedNow
                ? "Dropped from top-ranked set"
                : existing.lastImportantChange,
            };
            updatedExisting.priority = buildPriority(updatedExisting, override);
            updatedCandidates[asset] = updatedExisting;
          }
        } else if (!isPinned && !isAutoRanked && existing) {
          // Was in top set previously, now dropped and not pinned — mark dropped
          if (existing.inCurrentTopSet) {
            const dropped: SurveillanceCandidate = {
              ...existing,
              inCurrentTopSet: false,
              isStale: true,
              bucket: "DROPPED",
              lastUpdatedAt: now,
              events: appendEvents(existing.events, [
                {
                  eventId: `${asset}-${now}-RANK_EXIT`,
                  asset,
                  category: "RANK_EXIT",
                  severity: "NEGATIVE",
                  description:
                    "Dropped from auto-selection. Not pinned — will age out.",
                  before: `#${existing.currentRank}`,
                  after: null,
                  timestamp: now,
                },
              ]),
              lastEventAt: now,
              lastImportantChange: "Dropped from top-ranked set",
            };
            dropped.priority = buildPriority(dropped, override);
            updatedCandidates[asset] = dropped;
          }
        }
      }

      return {
        ...prev,
        candidates: updatedCandidates,
        lastUpdatedAt: now,
      };
    });
  }, [rankedRecords]);

  // ── Operator actions ─────────────────────────────────────────────────────────────

  const pinAsset = useCallback((asset: string) => {
    setSurveillanceState((prev) => {
      if (prev.pinnedAssets.includes(asset)) return prev;

      const updatedCandidates = { ...prev.candidates };
      const existing = updatedCandidates[asset];

      if (existing) {
        // Update source on existing record
        const source: SurveillanceCandidateSource =
          existing.source === "AUTO_RANKED" ? "BOTH" : "OPERATOR_PINNED";
        updatedCandidates[asset] = { ...existing, source };
      } else {
        // CRITICAL FIX: Asset being pinned has no existing candidate record.
        // This happens for any non-top-N asset from the universe board.
        // Check if it's currently in the ranked records (could be ranked below top-N).
        const rankedEntry = rankedRecordsRef.current.find(
          (r) => r.asset === asset,
        );
        if (rankedEntry) {
          // Asset is ranked but below the auto-surveillance threshold — create from real data
          const rank =
            rankedRecordsRef.current.findIndex((r) => r.asset === asset) + 1;
          updatedCandidates[asset] = createCandidate(
            rankedEntry,
            rank,
            "OPERATOR_PINNED",
            `Pinned at rank #${rank} (${rankedEntry.permissionLevel})`,
          );
        } else {
          // Asset is not in ranked records at all (e.g., manually typed in QuickPinInput,
          // or universe hasn't hydrated it yet). Create a stub — it will be updated
          // on the next ranking cycle when the universe scheduler provides real data.
          const stubRecord = makeStubRecord(asset);
          const stub = createCandidate(
            stubRecord,
            9999,
            "OPERATOR_PINNED",
            "Pinned — awaiting first hydration",
          );
          updatedCandidates[asset] = {
            ...stub,
            inCurrentTopSet: false,
            bucket: "DROPPED",
            currentRank: 9999,
          };
        }
      }

      return {
        ...prev,
        pinnedAssets: [...prev.pinnedAssets, asset],
        candidates: updatedCandidates,
      };
    });
  }, []);

  const unpinAsset = useCallback((asset: string) => {
    setSurveillanceState((prev) => {
      const updatedCandidates = { ...prev.candidates };
      const existing = updatedCandidates[asset];
      // If not in current top-N auto set, remove entirely
      const autoAssets = new Set<string>();
      for (
        let i = 0;
        i < Math.min(rankedRecordsRef.current.length, SURVEILLANCE_AUTO_TOP_N);
        i++
      ) {
        autoAssets.add(rankedRecordsRef.current[i].asset);
      }
      if (existing && !autoAssets.has(asset)) {
        delete updatedCandidates[asset];
      } else if (existing && autoAssets.has(asset)) {
        updatedCandidates[asset] = { ...existing, source: "AUTO_RANKED" };
      }
      return {
        ...prev,
        pinnedAssets: prev.pinnedAssets.filter((a) => a !== asset),
        candidates: updatedCandidates,
      };
    });
  }, []);

  const isPinned = useCallback(
    (asset: string) => surveillanceState.pinnedAssets.includes(asset),
    [surveillanceState.pinnedAssets],
  );

  const setPriorityOverride = useCallback(
    (asset: string, level: SurveillancePriorityLevel) => {
      setSurveillanceState((prev) => {
        const updatedCandidates = { ...prev.candidates };
        const existing = updatedCandidates[asset];
        if (existing) {
          updatedCandidates[asset] = {
            ...existing,
            priority: { mode: "OVERRIDE", level },
            priorityOverriddenBy: "OPERATOR",
          };
        }
        return {
          ...prev,
          candidates: updatedCandidates,
          priorityOverrides: { ...prev.priorityOverrides, [asset]: level },
        };
      });
    },
    [],
  );

  const clearPriorityOverride = useCallback((asset: string) => {
    setSurveillanceState((prev) => {
      const updatedOverrides = { ...prev.priorityOverrides };
      delete updatedOverrides[asset];
      const updatedCandidates = { ...prev.candidates };
      const existing = updatedCandidates[asset];
      if (existing) {
        const { priorityOverriddenBy: _removed, ...rest } = existing;
        const recomputed = { ...rest };
        recomputed.priority = buildPriority(recomputed, null);
        updatedCandidates[asset] = recomputed as SurveillanceCandidate;
      }
      return {
        ...prev,
        candidates: updatedCandidates,
        priorityOverrides: updatedOverrides,
      };
    });
  }, []);

  const dismissCandidate = useCallback((asset: string) => {
    setSurveillanceState((prev) => {
      // Cannot dismiss a pinned candidate
      if (prev.pinnedAssets.includes(asset)) return prev;
      const updatedCandidates = { ...prev.candidates };
      delete updatedCandidates[asset];
      return { ...prev, candidates: updatedCandidates };
    });
  }, []);

  // ── Derived outputs ───────────────────────────────────────────────────────────────

  const sortedCandidates = useMemo(() => {
    const list = Object.values(surveillanceState.candidates);
    return sortCandidates(list);
  }, [surveillanceState.candidates]);

  const buckets = useMemo(() => {
    const result = {} as Record<SurveillanceBucket, SurveillanceCandidate[]>;
    for (const b of SURVEILLANCE_BUCKET_ORDER) {
      result[b] = [];
    }
    for (const c of sortedCandidates) {
      result[c.bucket].push(c);
    }
    return result;
  }, [sortedCandidates]);

  const autoSelectedCount = useMemo(
    () =>
      sortedCandidates.filter(
        (c) => c.source === "AUTO_RANKED" || c.source === "BOTH",
      ).length,
    [sortedCandidates],
  );

  const pinnedCount = useMemo(
    () =>
      sortedCandidates.filter(
        (c) => c.source === "OPERATOR_PINNED" || c.source === "BOTH",
      ).length,
    [sortedCandidates],
  );

  const lastEventAt = useMemo(() => {
    let latest: number | null = null;
    for (const c of sortedCandidates) {
      if (c.lastEventAt && (latest === null || c.lastEventAt > latest)) {
        latest = c.lastEventAt;
      }
    }
    return latest;
  }, [sortedCandidates]);

  // ── Diagnostics ────────────────────────────────────────────────────────────────
  // Show breakdown of original-8 vs broader universe watched assets.

  const diagnostics = useMemo(() => {
    const allCandidates = sortedCandidates;
    const fromOriginal8 = allCandidates.filter((c) =>
      CANONICAL_ANCHOR_ASSETS_SET.has(c.asset),
    );
    const beyondOriginal8 = allCandidates.filter(
      (c) => !CANONICAL_ANCHOR_ASSETS_SET.has(c.asset),
    );
    const stubCount = allCandidates.filter(
      (c) =>
        c.currentRecord.mainBlocker === "Awaiting first hydration" ||
        c.currentRank === 9999,
    ).length;
    const hydrated = allCandidates.filter(
      (c) =>
        c.currentRecord.mainBlocker !== "Awaiting first hydration" &&
        c.currentRank !== 9999,
    ).length;
    return {
      total: allCandidates.length,
      fromOriginal8: fromOriginal8.length,
      beyondOriginal8: beyondOriginal8.length,
      stubsAwaitingHydration: stubCount,
      hydrated,
    };
  }, [sortedCandidates]);

  return {
    candidates: sortedCandidates,
    buckets,
    totalMonitored: sortedCandidates.length,
    autoSelectedCount,
    pinnedCount,
    lastEventAt,
    diagnostics,
    pinAsset,
    unpinAsset,
    isPinned,
    setPriorityOverride,
    clearPriorityOverride,
    dismissCandidate,
  };
}
