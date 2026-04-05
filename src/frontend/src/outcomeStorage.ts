// D16 Hybrid v0.7 — Outcome Storage Layer
// Local persistence for snapshots, outcomes, lifecycles, and metrics.
// Uses localStorage with structured keys and per-asset retention limits.
// Preserves lifecycle summaries even when pruning raw snapshots.

import type {
  CandidateLifecycle,
  HybridOutcomeSnapshot,
  PrecisionMetrics,
  SnapshotOutcome,
  StateTransitionRecord,
} from "./outcomeTypes";

// ─── Storage keys ─────────────────────────────────────────────────────────────

const STORAGE_VERSION = "v0.7.0";
const KEY_SNAPSHOTS = `d16_outcome_snapshots_${STORAGE_VERSION}`;
const KEY_OUTCOMES = `d16_outcome_results_${STORAGE_VERSION}`;
const KEY_LIFECYCLES = `d16_lifecycles_${STORAGE_VERSION}`;
const KEY_TRANSITIONS = `d16_transitions_${STORAGE_VERSION}`;
const KEY_METRICS = `d16_metrics_${STORAGE_VERSION}`;

// ─── Retention policy ─────────────────────────────────────────────────────────

const MAX_SNAPSHOTS_PER_ASSET = 100;
const MAX_TOTAL_SNAPSHOTS = 800; // 8 assets × 100
const MAX_LIFECYCLES = 200;
const MAX_TRANSITIONS = 500;

// ─── Safe JSON helpers ────────────────────────────────────────────────────────

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage quota exceeded — prune and retry
    pruneAll();
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Silent fail — storage unavailable
    }
  }
}

// ─── Snapshot storage ─────────────────────────────────────────────────────────

export function loadSnapshots(): HybridOutcomeSnapshot[] {
  return safeRead<HybridOutcomeSnapshot[]>(KEY_SNAPSHOTS, []);
}

export function saveSnapshots(snapshots: HybridOutcomeSnapshot[]): void {
  // Enforce per-asset retention
  const pruned = pruneSnapshots(snapshots);
  safeWrite(KEY_SNAPSHOTS, pruned);
}

function pruneSnapshots(
  snapshots: HybridOutcomeSnapshot[],
): HybridOutcomeSnapshot[] {
  if (snapshots.length <= MAX_TOTAL_SNAPSHOTS) return snapshots;

  // Group by asset
  const byAsset = new Map<string, HybridOutcomeSnapshot[]>();
  for (const s of snapshots) {
    const arr = byAsset.get(s.asset) ?? [];
    arr.push(s);
    byAsset.set(s.asset, arr);
  }

  const pruned: HybridOutcomeSnapshot[] = [];
  for (const [, assetSnaps] of byAsset) {
    // Sort newest first, keep MAX_SNAPSHOTS_PER_ASSET
    const sorted = assetSnaps.sort((a, b) => b.capturedAt - a.capturedAt);
    pruned.push(...sorted.slice(0, MAX_SNAPSHOTS_PER_ASSET));
  }
  return pruned;
}

// ─── Outcome storage ──────────────────────────────────────────────────────────

export function loadOutcomes(): Record<string, SnapshotOutcome> {
  return safeRead<Record<string, SnapshotOutcome>>(KEY_OUTCOMES, {});
}

export function saveOutcomes(outcomes: Record<string, SnapshotOutcome>): void {
  safeWrite(KEY_OUTCOMES, outcomes);
}

// ─── Lifecycle storage ────────────────────────────────────────────────────────

export function loadLifecycles(): CandidateLifecycle[] {
  return safeRead<CandidateLifecycle[]>(KEY_LIFECYCLES, []);
}

export function saveLifecycles(lifecycles: CandidateLifecycle[]): void {
  // Keep most recent MAX_LIFECYCLES, always preserve OPEN ones
  let pruned = lifecycles;
  if (lifecycles.length > MAX_LIFECYCLES) {
    const open = lifecycles.filter((l) => l.finalState === "OPEN");
    const closed = lifecycles
      .filter((l) => l.finalState !== "OPEN")
      .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
      .slice(0, MAX_LIFECYCLES - open.length);
    pruned = [...open, ...closed];
  }
  safeWrite(KEY_LIFECYCLES, pruned);
}

// ─── Transition storage ───────────────────────────────────────────────────────

export function loadTransitions(): StateTransitionRecord[] {
  return safeRead<StateTransitionRecord[]>(KEY_TRANSITIONS, []);
}

export function saveTransitions(transitions: StateTransitionRecord[]): void {
  const pruned =
    transitions.length > MAX_TRANSITIONS
      ? transitions.slice(transitions.length - MAX_TRANSITIONS)
      : transitions;
  safeWrite(KEY_TRANSITIONS, pruned);
}

// ─── Metrics storage ──────────────────────────────────────────────────────────

export function loadMetrics(): PrecisionMetrics | null {
  return safeRead<PrecisionMetrics | null>(KEY_METRICS, null);
}

export function saveMetrics(metrics: PrecisionMetrics): void {
  safeWrite(KEY_METRICS, metrics);
}

// ─── Prune all ────────────────────────────────────────────────────────────────
// Emergency pruning to free storage space. Preserves lifecycle summaries.

export function pruneAll(): void {
  try {
    // Aggressively prune raw snapshots (oldest 50%)
    const snaps = loadSnapshots();
    if (snaps.length > 0) {
      const halfCount = Math.floor(snaps.length / 2);
      const kept = snaps
        .sort((a, b) => b.capturedAt - a.capturedAt)
        .slice(0, halfCount);
      localStorage.setItem(KEY_SNAPSHOTS, JSON.stringify(kept));
    }

    // Prune transitions more aggressively
    const transitions = loadTransitions();
    if (transitions.length > 100) {
      localStorage.setItem(
        KEY_TRANSITIONS,
        JSON.stringify(transitions.slice(-100)),
      );
    }
    // Lifecycles are always preserved
  } catch {
    // Last resort: clear raw data only
    try {
      localStorage.removeItem(KEY_SNAPSHOTS);
      localStorage.removeItem(KEY_TRANSITIONS);
    } catch {
      /* noop */
    }
  }
}

// ─── Clear all outcome data ───────────────────────────────────────────────────
// Operator action — resets the ledger for a clean measurement run.

export function clearAllOutcomeData(): void {
  localStorage.removeItem(KEY_SNAPSHOTS);
  localStorage.removeItem(KEY_OUTCOMES);
  localStorage.removeItem(KEY_LIFECYCLES);
  localStorage.removeItem(KEY_TRANSITIONS);
  localStorage.removeItem(KEY_METRICS);
}

// ─── Storage stats ────────────────────────────────────────────────────────────

export function getStorageStats(): {
  snapshotCount: number;
  outcomeCount: number;
  lifecycleCount: number;
  transitionCount: number;
  estimatedKB: number;
} {
  const snaps = loadSnapshots();
  const outcomes = loadOutcomes();
  const lifecycles = loadLifecycles();
  const transitions = loadTransitions();

  const totalBytes = [
    KEY_SNAPSHOTS,
    KEY_OUTCOMES,
    KEY_LIFECYCLES,
    KEY_TRANSITIONS,
    KEY_METRICS,
  ].reduce((acc, key) => {
    const val = localStorage.getItem(key);
    return acc + (val ? val.length : 0);
  }, 0);

  return {
    snapshotCount: snaps.length,
    outcomeCount: Object.keys(outcomes).length,
    lifecycleCount: lifecycles.length,
    transitionCount: transitions.length,
    estimatedKB: Math.round(totalBytes / 1024),
  };
}
