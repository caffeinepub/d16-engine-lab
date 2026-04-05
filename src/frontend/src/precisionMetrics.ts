// D16 Hybrid v0.7 — Precision Metrics Aggregation
// Computes all precision analytics from snapshots + outcomes.
// Includes blocker effectiveness ranking.
// Do NOT produce vanity analytics. Measure honestly.

import type {
  BlockerEffectivenessRecord,
  CandidateLifecycle,
  HybridOutcomeSnapshot,
  OutcomeClass,
  PrecisionBucket,
  PrecisionMetrics,
  SnapshotOutcome,
} from "./outcomeTypes";

// ─── Outcome class helpers ────────────────────────────────────────────────────

function isSuccess(cls: OutcomeClass): boolean {
  return cls === "STRONG_SUCCESS" || cls === "PARTIAL_SUCCESS";
}

function isFailed(cls: OutcomeClass): boolean {
  return cls === "FAILED" || cls === "EARLY_FALSE_POSITIVE";
}

function isEvaluated(cls: OutcomeClass): boolean {
  return cls !== "INSUFFICIENT_FORWARD_DATA";
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return (
    Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 100) / 100
  );
}

// ─── Build a precision bucket from a slice of (snapshot, outcome) pairs ───

type SnapOutcomePair = {
  snapshot: HybridOutcomeSnapshot;
  outcome: SnapshotOutcome;
};

function buildBucket(label: string, pairs: SnapOutcomePair[]): PrecisionBucket {
  const evaluated = pairs.filter((p) => isEvaluated(p.outcome.outcomeClass));
  const count = evaluated.length;

  if (count === 0) {
    return {
      label,
      count: 0,
      hitRate: 0,
      avgReturn15m: null,
      avgReturn1h: null,
      avgReturn4h: null,
      avgReturn24h: null,
      strongSuccessRate: 0,
      failRate: 0,
      falsePositiveRate: 0,
    };
  }

  const hits = evaluated.filter(
    (p) => p.outcome.after1h.directionalCorrect === true,
  ).length;

  const strongSuccess = evaluated.filter(
    (p) => p.outcome.outcomeClass === "STRONG_SUCCESS",
  ).length;

  const failed = evaluated.filter((p) =>
    isFailed(p.outcome.outcomeClass),
  ).length;

  const falsePositive = evaluated.filter(
    (p) => p.outcome.outcomeClass === "EARLY_FALSE_POSITIVE",
  ).length;

  return {
    label,
    count,
    hitRate: Math.round((hits / count) * 100),
    avgReturn15m: avg(evaluated.map((p) => p.outcome.after15m.returnPct)),
    avgReturn1h: avg(evaluated.map((p) => p.outcome.after1h.returnPct)),
    avgReturn4h: avg(evaluated.map((p) => p.outcome.after4h.returnPct)),
    avgReturn24h: avg(evaluated.map((p) => p.outcome.after24h.returnPct)),
    strongSuccessRate: Math.round((strongSuccess / count) * 100),
    failRate: Math.round((failed / count) * 100),
    falsePositiveRate: Math.round((falsePositive / count) * 100),
  };
}

// ─── Group by tag field and build buckets ───────────────────────────────────────

type TagKey = keyof HybridOutcomeSnapshot["tags"];

function groupBy(
  pairs: SnapOutcomePair[],
  tagKey: TagKey,
): Record<string, PrecisionBucket> {
  const groups = new Map<string, SnapOutcomePair[]>();
  for (const pair of pairs) {
    const key = String(pair.snapshot.tags[tagKey] ?? "UNKNOWN");
    const arr = groups.get(key) ?? [];
    arr.push(pair);
    groups.set(key, arr);
  }
  const result: Record<string, PrecisionBucket> = {};
  for (const [key, groupPairs] of groups) {
    result[key] = buildBucket(key, groupPairs);
  }
  return result;
}

// ─── Blocker effectiveness ─────────────────────────────────────────────────────
// For blocked snapshots: look at what happened next.
// "Saved loss rate" = fraction where the outcome was FAILED/EARLY_FALSE_POSITIVE
//   (meaning: good that it was blocked).
// "Over conservative rate" = fraction where outcome was STRONG/PARTIAL_SUCCESS
//   (meaning: the blocker prevented a good entry).

function computeBlockerEffectiveness(
  pairs: SnapOutcomePair[],
): BlockerEffectivenessRecord[] {
  // Only look at BLOCKED snapshots that have outcomes
  const blockedPairs = pairs.filter(
    (p) =>
      p.snapshot.tags.permissionLevel === "BLOCKED" &&
      p.snapshot.tags.mainBlocker !== null &&
      isEvaluated(p.outcome.outcomeClass),
  );

  // Group by blocker text
  const byBlocker = new Map<string, SnapOutcomePair[]>();
  for (const pair of blockedPairs) {
    const blocker = p_shortBlocker(pair.snapshot.tags.mainBlocker ?? "Unknown");
    const arr = byBlocker.get(blocker) ?? [];
    arr.push(pair);
    byBlocker.set(blocker, arr);
  }

  const records: BlockerEffectivenessRecord[] = [];
  for (const [blocker, blockPairs] of byBlocker) {
    const total = blockPairs.length;
    const savedLoss = blockPairs.filter((p) =>
      isFailed(p.outcome.outcomeClass),
    ).length;
    const overConservative = blockPairs.filter((p) =>
      isSuccess(p.outcome.outcomeClass),
    ).length;

    const savedLossRate = Math.round((savedLoss / total) * 100) / 100;
    const overConservativeRate =
      Math.round((overConservative / total) * 100) / 100;

    // Outcome class distribution after block
    const classCounts = new Map<OutcomeClass, number>();
    for (const p of blockPairs) {
      const cls = p.outcome.outcomeClass;
      classCounts.set(cls, (classCounts.get(cls) ?? 0) + 1);
    }
    let mostCommonClass: OutcomeClass | null = null;
    let maxCount = 0;
    for (const [cls, cnt] of classCounts) {
      if (cnt > maxCount) {
        maxCount = cnt;
        mostCommonClass = cls;
      }
    }

    let netValue: BlockerEffectivenessRecord["netValue"];
    if (savedLossRate >= 0.5) netValue = "VALUABLE";
    else if (overConservativeRate >= 0.5) netValue = "OVER_CONSERVATIVE";
    else netValue = "NEUTRAL";

    records.push({
      blocker,
      appearances: total,
      savedLossRate,
      overConservativeRate,
      avgOutcomeAfterBlock: mostCommonClass,
      netValue,
    });
  }

  // Sort by appearances descending
  return records.sort((a, b) => b.appearances - a.appearances);
}

// Shorten blocker text to a canonical key (first ~50 chars)
function p_shortBlocker(blocker: string): string {
  return blocker.length > 60 ? `${blocker.slice(0, 60)}...` : blocker;
}

// ─── Overall hit rates ───────────────────────────────────────────────────────────

function computeOverallHitRate(
  pairs: SnapOutcomePair[],
  horizon: "after15m" | "after1h" | "after4h" | "after24h",
): number | null {
  const eligible = pairs.filter(
    (p) => p.outcome[horizon].directionalCorrect !== null,
  );
  if (eligible.length === 0) return null;
  const correct = eligible.filter(
    (p) => p.outcome[horizon].directionalCorrect === true,
  ).length;
  return Math.round((correct / eligible.length) * 100);
}

// ─── Outcome class distribution ──────────────────────────────────────────────────

function computeOutcomeClassDistribution(
  pairs: SnapOutcomePair[],
): Record<OutcomeClass, number> {
  const dist: Record<OutcomeClass, number> = {
    STRONG_SUCCESS: 0,
    PARTIAL_SUCCESS: 0,
    NEUTRAL: 0,
    EARLY_FALSE_POSITIVE: 0,
    FAILED: 0,
    INSUFFICIENT_FORWARD_DATA: 0,
  };
  for (const p of pairs) {
    dist[p.outcome.outcomeClass]++;
  }
  return dist;
}

// ─── Main aggregation function ────────────────────────────────────────────────────

export function computePrecisionMetrics(
  snapshots: HybridOutcomeSnapshot[],
  outcomes: Record<string, SnapshotOutcome>,
  lifecycles: CandidateLifecycle[],
): PrecisionMetrics {
  // Build (snapshot, outcome) pairs for snapshots that have outcomes
  const pairs: SnapOutcomePair[] = snapshots
    .filter((s) => outcomes[s.snapshotId] !== undefined)
    .map((s) => ({ snapshot: s, outcome: outcomes[s.snapshotId] }));

  const evaluatedPairs = pairs.filter((p) =>
    isEvaluated(p.outcome.outcomeClass),
  );

  return {
    computedAt: Date.now(),
    totalSnapshots: snapshots.length,
    evaluatedSnapshots: evaluatedPairs.length,
    totalLifecycles: lifecycles.length,
    openLifecycles: lifecycles.filter((l) => l.finalState === "OPEN").length,

    overallHitRate15m: computeOverallHitRate(evaluatedPairs, "after15m"),
    overallHitRate1h: computeOverallHitRate(evaluatedPairs, "after1h"),
    overallHitRate4h: computeOverallHitRate(evaluatedPairs, "after4h"),
    overallHitRate24h: computeOverallHitRate(evaluatedPairs, "after24h"),

    byPermissionLevel: groupBy(evaluatedPairs, "permissionLevel"),
    byEntryClass: groupBy(evaluatedPairs, "entryClass"),
    byDivergenceType: groupBy(evaluatedPairs, "divergenceType"),
    byLeadMarket: groupBy(evaluatedPairs, "leadMarket"),
    byAsset: groupBy(evaluatedPairs, "asset" as TagKey),

    blockerEffectiveness: computeBlockerEffectiveness(pairs),
    outcomeClassDistribution: computeOutcomeClassDistribution(evaluatedPairs),
  };
}

// Fix: "asset" is not a TagKey, so we need a separate groupBy for asset field
// (above used a cast; let's do it properly)
export function computePrecisionMetricsFull(
  snapshots: HybridOutcomeSnapshot[],
  outcomes: Record<string, SnapshotOutcome>,
  lifecycles: CandidateLifecycle[],
): PrecisionMetrics {
  const pairs: SnapOutcomePair[] = snapshots
    .filter((s) => outcomes[s.snapshotId] !== undefined)
    .map((s) => ({ snapshot: s, outcome: outcomes[s.snapshotId] }));

  const evaluatedPairs = pairs.filter((p) =>
    isEvaluated(p.outcome.outcomeClass),
  );

  // byAsset: group on snapshot.asset directly
  const byAssetRaw = new Map<string, SnapOutcomePair[]>();
  for (const pair of evaluatedPairs) {
    const asset = pair.snapshot.asset;
    const arr = byAssetRaw.get(asset) ?? [];
    arr.push(pair);
    byAssetRaw.set(asset, arr);
  }
  const byAsset: Record<string, PrecisionBucket> = {};
  for (const [asset, assetPairs] of byAssetRaw) {
    byAsset[asset] = buildBucket(asset, assetPairs);
  }

  return {
    computedAt: Date.now(),
    totalSnapshots: snapshots.length,
    evaluatedSnapshots: evaluatedPairs.length,
    totalLifecycles: lifecycles.length,
    openLifecycles: lifecycles.filter((l) => l.finalState === "OPEN").length,

    overallHitRate15m: computeOverallHitRate(evaluatedPairs, "after15m"),
    overallHitRate1h: computeOverallHitRate(evaluatedPairs, "after1h"),
    overallHitRate4h: computeOverallHitRate(evaluatedPairs, "after4h"),
    overallHitRate24h: computeOverallHitRate(evaluatedPairs, "after24h"),

    byPermissionLevel: groupBy(evaluatedPairs, "permissionLevel"),
    byEntryClass: groupBy(evaluatedPairs, "entryClass"),
    byDivergenceType: groupBy(evaluatedPairs, "divergenceType"),
    byLeadMarket: groupBy(evaluatedPairs, "leadMarket"),
    byAsset,

    blockerEffectiveness: computeBlockerEffectiveness(pairs),
    outcomeClassDistribution: computeOutcomeClassDistribution(evaluatedPairs),
  };
}
