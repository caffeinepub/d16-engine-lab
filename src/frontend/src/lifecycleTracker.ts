// D16 Hybrid v0.7 — Candidate Lifecycle Tracker
// Groups snapshots for each asset into candidate episodes.
// An episode begins when an asset becomes relevant and ends when it decays or is cancelled.

import type { HybridOutcomeSnapshot } from "./outcomeTypes";
import type { CandidateLifecycle, LifecycleFinalState } from "./outcomeTypes";

// ─── Lifecycle ID ──────────────────────────────────────────────────────────────

let _lifecycleCounter = 0;

export function generateLifecycleId(asset: string): string {
  return `lc_${asset}_${Date.now()}_${++_lifecycleCounter}`;
}

// ─── Relevance threshold ─────────────────────────────────────────────────────────
// A snapshot starts a new lifecycle if it's above the minimum relevance state.
// BLOCKED = not relevant enough to start a lifecycle.

function isRelevantPermission(permissionLevel: string): boolean {
  return permissionLevel !== "BLOCKED";
}

// ─── Decay / end detection ─────────────────────────────────────────────────────
// Determines if a new snapshot should close the current open lifecycle.

function deriveFinalState(
  snapshot: HybridOutcomeSnapshot,
): LifecycleFinalState | null {
  const perm = snapshot.tags.permissionLevel;
  const entryClass = snapshot.tags.entryClass;
  const divergence = snapshot.tags.divergenceType;
  const maturity =
    snapshot.perMarket.binanceFutures?.maturity ??
    snapshot.perMarket.binanceSpot?.maturity ??
    snapshot.perMarket.coinbaseSpot?.maturity;

  // CANCELLED: direction conflict or trust conflict invalidates the thesis
  if (divergence === "DIRECTION_CONFLICT" && perm === "BLOCKED")
    return "CANCELLED";

  // DECAYED: permission collapsed back to blocked AND entry class is NONE
  if (perm === "BLOCKED" && entryClass === "NONE") return "DECAYED";

  // DECAYED via maturity
  if (maturity === "DECAY" || maturity === "CANCELLED") return "DECAYED";

  return null; // episode continues
}

// Lifecycle timeout: if an episode has been open for more than 24h without a
// snapshot, it is force-closed as DECAYED.
const LIFECYCLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;

function isTimedOut(lifecycle: CandidateLifecycle): boolean {
  if (lifecycle.finalState !== "OPEN") return false;
  return Date.now() - lifecycle.startedAt > LIFECYCLE_TIMEOUT_MS;
}

// ─── Stage derivation ────────────────────────────────────────────────────────────
function deriveStage(snapshot: HybridOutcomeSnapshot): string {
  // Stage maps to the most meaningful state from the snapshot
  const perm = snapshot.tags.permissionLevel;
  if (perm === "EXACT") return "EXACT";
  if (perm === "PROVISIONAL") return "PROVISIONAL";
  if (perm === "PROJECTED_ONLY") return "PROJECTED_ONLY";
  if (perm === "WATCH_ONLY") return "WATCH_ONLY";

  // Fall back to maturity-based stages for BLOCKED
  const maturity =
    snapshot.perMarket.binanceFutures?.maturity ??
    snapshot.perMarket.binanceSpot?.maturity ??
    snapshot.perMarket.coinbaseSpot?.maturity;
  if (maturity === "EARLY") return "EARLY";
  if (maturity === "BREWING") return "BREWING";
  if (maturity === "FORMING") return "FORMING";
  if (maturity === "ACTIVE") return "ACTIVE";
  if (maturity === "DECAY") return "DECAY";
  if (maturity === "CANCELLED") return "CANCELLED";
  return "EARLY";
}

// ─── Peak permission rank ────────────────────────────────────────────────────────
const PERMISSION_RANK: Record<string, number> = {
  BLOCKED: 0,
  WATCH_ONLY: 1,
  PROJECTED_ONLY: 2,
  PROVISIONAL: 3,
  EXACT: 4,
};

function higherPermission(a: string, b: string): string {
  return (PERMISSION_RANK[a] ?? 0) >= (PERMISSION_RANK[b] ?? 0) ? a : b;
}

function addUnique<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr : [...arr, val];
}

// ─── Process a new snapshot against lifecycles ───────────────────────────────
// Mutates the lifecycle list in place and returns the updated list.
// This is called once per captured snapshot.

export function processSnapshotForLifecycle(
  snapshot: HybridOutcomeSnapshot,
  lifecycles: CandidateLifecycle[],
): CandidateLifecycle[] {
  const updated = lifecycles.map((lc) =>
    lc.finalState === "OPEN" && isTimedOut(lc)
      ? {
          ...lc,
          finalState: "DECAYED" as LifecycleFinalState,
          endedAt: Date.now(),
        }
      : lc,
  );

  const asset = snapshot.asset;
  const openLifecycle = updated.find(
    (lc) => lc.asset === asset && lc.finalState === "OPEN",
  );

  const stage = deriveStage(snapshot);
  const isRelevant = isRelevantPermission(snapshot.tags.permissionLevel);

  if (openLifecycle) {
    // Check if this snapshot ends the open episode
    const endState = deriveFinalState(snapshot);
    if (endState) {
      // Close the lifecycle
      return updated.map((lc) =>
        lc.lifecycleId === openLifecycle.lifecycleId
          ? {
              ...lc,
              latestSnapshotId: snapshot.snapshotId,
              endedAt: snapshot.capturedAt,
              finalState: endState,
              stagesSeen: addUnique(lc.stagesSeen, stage),
              snapshotCount: lc.snapshotCount + 1,
            }
          : lc,
      );
    }

    // Continue the episode
    return updated.map((lc) =>
      lc.lifecycleId === openLifecycle.lifecycleId
        ? {
            ...lc,
            latestSnapshotId: snapshot.snapshotId,
            stagesSeen: addUnique(lc.stagesSeen, stage),
            leadMarketsSeen: addUnique(
              lc.leadMarketsSeen,
              snapshot.tags.leadMarket,
            ),
            divergenceTypesSeen: addUnique(
              lc.divergenceTypesSeen,
              snapshot.tags.divergenceType,
            ),
            permissionLevelsSeen: addUnique(
              lc.permissionLevelsSeen,
              snapshot.tags.permissionLevel,
            ),
            entryClassesSeen: addUnique(
              lc.entryClassesSeen,
              snapshot.tags.entryClass,
            ),
            peakPermissionLevel: higherPermission(
              lc.peakPermissionLevel,
              snapshot.tags.permissionLevel,
            ),
            snapshotCount: lc.snapshotCount + 1,
          }
        : lc,
    );
  }

  // No open lifecycle for this asset — open a new one if relevant
  if (!isRelevant) return updated;

  const newLifecycle: CandidateLifecycle = {
    lifecycleId: generateLifecycleId(asset),
    asset,
    startedAt: snapshot.capturedAt,
    endedAt: null,
    firstSnapshotId: snapshot.snapshotId,
    latestSnapshotId: snapshot.snapshotId,
    stagesSeen: [stage],
    leadMarketsSeen: [snapshot.tags.leadMarket],
    divergenceTypesSeen: [snapshot.tags.divergenceType],
    permissionLevelsSeen: [snapshot.tags.permissionLevel],
    entryClassesSeen: [snapshot.tags.entryClass],
    peakPermissionLevel: snapshot.tags.permissionLevel,
    snapshotCount: 1,
    finalState: "OPEN",
  };

  return [...updated, newLifecycle];
}

// ─── Force close all open lifecycles (e.g. on mode switch) ───────────────────

export function closeAllOpenLifecycles(
  lifecycles: CandidateLifecycle[],
  reason: LifecycleFinalState = "DECAYED",
): CandidateLifecycle[] {
  const now = Date.now();
  return lifecycles.map((lc) =>
    lc.finalState === "OPEN" ? { ...lc, finalState: reason, endedAt: now } : lc,
  );
}
