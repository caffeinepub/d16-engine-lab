// D16 Hybrid v0.8.1 — Surveillance Engine
// Pure functions: change detection, bucket derivation, auto-priority scoring.
// No side effects. No React. No storage.

import type {
  SurveillanceBucket,
  SurveillanceCandidate,
  SurveillanceEvent,
  SurveillanceEventCategory,
  SurveillancePriority,
  SurveillancePriorityLevel,
} from "./surveillanceTypes";
import {
  PERMISSION_ORDER,
  SURVEILLANCE_EVENT_BUFFER_DEPTH,
} from "./surveillanceTypes";
import type { UniverseTopEntryRecord } from "./universeTypes";

// ─── Change detection ─────────────────────────────────────────────────────────

function makeEventId(asset: string, category: string): string {
  return `${asset}-${Date.now()}-${category}`;
}

export function detectChanges(
  asset: string,
  prev: UniverseTopEntryRecord,
  next: UniverseTopEntryRecord,
  prevRank: number | null,
  nextRank: number,
): SurveillanceEvent[] {
  const events: SurveillanceEvent[] = [];
  const now = Date.now();

  // ── 1. Rank movement ──────────────────────────────────────────────────
  if (prevRank !== null && prevRank !== nextRank) {
    const delta = nextRank - prevRank;
    const moved = delta < 0 ? "up" : "down";
    const severity = delta < 0 ? "POSITIVE" : "NEGATIVE";
    events.push({
      eventId: makeEventId(asset, "RANK_MOVEMENT"),
      asset,
      category: "RANK_MOVEMENT",
      severity,
      description: `Rank ${moved}: #${prevRank} → #${nextRank}`,
      before: `#${prevRank}`,
      after: `#${nextRank}`,
      timestamp: now,
    });
  }

  // ── 2. Permission transition ───────────────────────────────────────────
  if (prev.permissionLevel !== next.permissionLevel) {
    const prevOrd = PERMISSION_ORDER[prev.permissionLevel] ?? 0;
    const nextOrd = PERMISSION_ORDER[next.permissionLevel] ?? 0;
    const improved = nextOrd > prevOrd;
    let severity: SurveillanceEvent["severity"] = improved
      ? "POSITIVE"
      : "NEGATIVE";
    if (next.permissionLevel === "EXACT") severity = "URGENT";
    if (next.permissionLevel === "BLOCKED") severity = "NEGATIVE";

    let category: SurveillanceEventCategory = "PERMISSION_TRANSITION";
    let description = `Permission: ${prev.permissionLevel} → ${next.permissionLevel}`;

    // Classify as entry-window events for EXACT transitions
    if (next.permissionLevel === "EXACT") {
      category = "ENTRY_WINDOW";
      description = `Exact entry now open (was ${prev.permissionLevel})`;
    } else if (prev.permissionLevel === "EXACT" && nextOrd < prevOrd) {
      category = "ENTRY_WINDOW";
      description = `Exact entry lost → ${next.permissionLevel}`;
      severity = "NEGATIVE";
    }

    events.push({
      eventId: makeEventId(asset, category),
      asset,
      category,
      severity,
      description,
      before: prev.permissionLevel,
      after: next.permissionLevel,
      timestamp: now,
    });
  }

  // ── 3. Lead / lag market changes ───────────────────────────────────────
  if (prev.leadMarket !== next.leadMarket) {
    events.push({
      eventId: makeEventId(asset, "LEAD_LAG_CHANGE"),
      asset,
      category: "LEAD_LAG_CHANGE",
      severity: "INFO",
      description: `Lead market: ${prev.leadMarket} → ${next.leadMarket}`,
      before: prev.leadMarket,
      after: next.leadMarket,
      timestamp: now,
    });
  }

  if (prev.divergenceType !== next.divergenceType) {
    const wasConflict =
      prev.divergenceType === "DIRECTION_CONFLICT" ||
      prev.divergenceType === "TRUST_CONFLICT" ||
      prev.divergenceType === "MATURITY_CONFLICT";
    const isConflict =
      next.divergenceType === "DIRECTION_CONFLICT" ||
      next.divergenceType === "TRUST_CONFLICT" ||
      next.divergenceType === "MATURITY_CONFLICT";
    const severity = isConflict
      ? "NEGATIVE"
      : wasConflict
        ? "POSITIVE"
        : "INFO";
    events.push({
      eventId: makeEventId(asset, "LEAD_LAG_DIVERGENCE"),
      asset,
      category: "LEAD_LAG_CHANGE",
      severity,
      description: `Divergence: ${prev.divergenceType.replace(/_/g, " ")} → ${next.divergenceType.replace(/_/g, " ")}`,
      before: prev.divergenceType,
      after: next.divergenceType,
      timestamp: now,
    });
  }

  // ── 4. Trust changes (significant threshold) ───────────────────────────
  const trustDelta = next.runtimeTrust - prev.runtimeTrust;
  if (Math.abs(trustDelta) >= 10) {
    const severity = trustDelta > 0 ? "POSITIVE" : "NEGATIVE";
    events.push({
      eventId: makeEventId(asset, "TRUST_CHANGE"),
      asset,
      category: "TRUST_CHANGE",
      severity,
      description: `Trust ${trustDelta > 0 ? "improved" : "degraded"}: ${prev.runtimeTrust}% → ${next.runtimeTrust}%`,
      before: `${prev.runtimeTrust}%`,
      after: `${next.runtimeTrust}%`,
      timestamp: now,
    });
  }

  // ── 5. Blocker changes ────────────────────────────────────────────────
  if (prev.mainBlocker !== next.mainBlocker) {
    if (prev.mainBlocker !== null && next.mainBlocker === null) {
      // Blocker cleared — positive signal
      events.push({
        eventId: makeEventId(asset, "BLOCKER_CLEARED"),
        asset,
        category: "BLOCKER_CHANGE",
        severity: "POSITIVE",
        description: `Blocker cleared: was "${prev.mainBlocker}"`,
        before: prev.mainBlocker,
        after: null,
        timestamp: now,
      });
    } else if (prev.mainBlocker === null && next.mainBlocker !== null) {
      // New blocker appeared
      events.push({
        eventId: makeEventId(asset, "BLOCKER_APPEARED"),
        asset,
        category: "BLOCKER_CHANGE",
        severity: "NEGATIVE",
        description: `Blocker appeared: "${next.mainBlocker}"`,
        before: null,
        after: next.mainBlocker,
        timestamp: now,
      });
    } else if (prev.mainBlocker !== null && next.mainBlocker !== null) {
      // Blocker changed
      events.push({
        eventId: makeEventId(asset, "BLOCKER_CHANGED"),
        asset,
        category: "BLOCKER_CHANGE",
        severity: "INFO",
        description: `Blocker changed: "${prev.mainBlocker}" → "${next.mainBlocker}"`,
        before: prev.mainBlocker,
        after: next.mainBlocker,
        timestamp: now,
      });
    }
  }

  // ── 6. Entry class changes ────────────────────────────────────────────
  if (prev.entryClass !== next.entryClass && next.entryClass !== "NONE") {
    events.push({
      eventId: makeEventId(asset, "ENTRY_CLASS"),
      asset,
      category: "PERMISSION_TRANSITION",
      severity: "INFO",
      description: `Entry class: ${prev.entryClass} → ${next.entryClass}`,
      before: prev.entryClass,
      after: next.entryClass,
      timestamp: now,
    });
  }

  // ── 7. Rank-score degradation (thesis weakening proxy) ─────────────────
  const scoreDelta = next.overallRankScore - prev.overallRankScore;
  if (scoreDelta <= -15) {
    events.push({
      eventId: makeEventId(asset, "SCORE_DEGRADED"),
      asset,
      category: "ENTRY_WINDOW",
      severity: "NEGATIVE",
      description: `Rank score fell: ${prev.overallRankScore} → ${next.overallRankScore} (thesis weakening)`,
      before: `${prev.overallRankScore}`,
      after: `${next.overallRankScore}`,
      timestamp: now,
    });
  }

  return events;
}

// ─── Bucket derivation ────────────────────────────────────────────────────────

export function deriveBucket(
  candidate: Pick<
    SurveillanceCandidate,
    "currentRecord" | "rankDelta" | "inCurrentTopSet" | "events"
  >,
): SurveillanceBucket {
  const { permissionLevel, mainBlocker, overallRankScore } =
    candidate.currentRecord;
  const recentEvents = candidate.events.slice(-5);

  // Dropped — no longer in universe top set
  if (!candidate.inCurrentTopSet) return "DROPPED";

  // Exact Now
  if (permissionLevel === "EXACT") return "EXACT_NOW";

  // Thesis Broken: BLOCKED with degraded score or recent hard block event
  if (permissionLevel === "BLOCKED" && overallRankScore < 30) {
    return "THESIS_BROKEN";
  }
  const hasCriticalBlocker = recentEvents.some(
    (e) =>
      e.category === "BLOCKER_CHANGE" &&
      e.severity === "NEGATIVE" &&
      e.after?.toLowerCase().includes("direction"),
  );
  if (hasCriticalBlocker && permissionLevel === "BLOCKED") {
    return "THESIS_BROKEN";
  }

  // Near Exact: PROVISIONAL
  if (permissionLevel === "PROVISIONAL") return "NEAR_EXACT";

  // Escalating: recently improved permission, moving upward rank
  const recentPositive = recentEvents.filter(
    (e) => e.severity === "POSITIVE" || e.severity === "URGENT",
  ).length;
  const rankImproved = candidate.rankDelta !== null && candidate.rankDelta < 0;
  if (recentPositive >= 1 && rankImproved) return "ESCALATING";
  if (recentPositive >= 2) return "ESCALATING";

  // Degrading: recently lost permission or trust
  const recentNegative = recentEvents.filter(
    (e) => e.severity === "NEGATIVE",
  ).length;
  if (recentNegative >= 2) return "DEGRADING";
  const rankWorse = candidate.rankDelta !== null && candidate.rankDelta > 3;
  if (recentNegative >= 1 && rankWorse) return "DEGRADING";

  // Blocked or watch-only without clear escalation — degrading if has blocker
  if (permissionLevel === "BLOCKED" && mainBlocker !== null) return "DEGRADING";

  // Default: stable
  return "STABLE_HIGH";
}

// ─── Auto-priority scoring ────────────────────────────────────────────────────

export function deriveAutoPriority(
  candidate: Pick<
    SurveillanceCandidate,
    "currentRecord" | "currentRank" | "rankDelta" | "events" | "bucket"
  >,
): { level: SurveillancePriorityLevel; score: number } {
  let score = 0;
  const { permissionLevel, overallRankScore, runtimeTrust } =
    candidate.currentRecord;
  const recentEvents = candidate.events.slice(-5);

  // Permission level contribution (0–40)
  const permMap: Record<string, number> = {
    EXACT: 40,
    PROVISIONAL: 30,
    PROJECTED_ONLY: 18,
    WATCH_ONLY: 10,
    BLOCKED: 0,
  };
  score += permMap[permissionLevel] ?? 0;

  // Rank position (0–20): rank 1 = 20, rank 10 = 10, rank 20+ = 0
  const rankScore = Math.max(0, 20 - (candidate.currentRank - 1) * 1.5);
  score += rankScore;

  // Rank movement velocity (0–15)
  if (candidate.rankDelta !== null) {
    if (candidate.rankDelta < -3) score += 15;
    else if (candidate.rankDelta < 0) score += 8;
    else if (candidate.rankDelta > 5) score -= 5;
  }

  // Recent positive events (0–15)
  const positiveCount = recentEvents.filter(
    (e) => e.severity === "POSITIVE" || e.severity === "URGENT",
  ).length;
  score += Math.min(15, positiveCount * 5);

  // Exact-entry proximity: near EXACT = boost (0–10)
  if (overallRankScore >= 80) score += 10;
  else if (overallRankScore >= 60) score += 5;

  // Trust change penalty/boost (0–5)
  const trustEvent = recentEvents.find((e) => e.category === "TRUST_CHANGE");
  if (trustEvent) {
    if (trustEvent.severity === "POSITIVE") score += 5;
    else score -= 5;
  }

  // Runtime trust base (0–5)
  if (runtimeTrust >= 80) score += 5;
  else if (runtimeTrust < 40) score -= 5;

  // Bucket urgency bonus
  if (candidate.bucket === "EXACT_NOW") score += 20;
  else if (candidate.bucket === "NEAR_EXACT") score += 10;
  else if (candidate.bucket === "ESCALATING") score += 5;
  else if (candidate.bucket === "DEGRADING") score -= 5;
  else if (candidate.bucket === "THESIS_BROKEN") score -= 15;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let level: SurveillancePriorityLevel;
  if (score >= 65) level = "HIGH";
  else if (score >= 35) level = "MEDIUM";
  else level = "LOW";

  return { level, score };
}

// ─── Build priority ───────────────────────────────────────────────────────────

export function buildPriority(
  candidate: Pick<
    SurveillanceCandidate,
    "currentRecord" | "currentRank" | "rankDelta" | "events" | "bucket"
  >,
  override: SurveillancePriorityLevel | null,
): SurveillancePriority {
  if (override !== null) {
    return { mode: "OVERRIDE", level: override };
  }
  const { level, score } = deriveAutoPriority(candidate);
  return { mode: "AUTO", derivedLevel: level, score };
}

// ─── Sort candidates ─────────────────────────────────────────────────────────
// Most urgent first.

const BUCKET_URGENCY: Record<string, number> = {
  EXACT_NOW: 7,
  NEAR_EXACT: 6,
  ESCALATING: 5,
  STABLE_HIGH: 4,
  DEGRADING: 3,
  THESIS_BROKEN: 2,
  DROPPED: 1,
};

const PRIORITY_LEVEL_RANK: Record<string, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function sortCandidates(
  candidates: SurveillanceCandidate[],
): SurveillanceCandidate[] {
  return [...candidates].sort((a, b) => {
    const aLevel =
      a.priority.mode === "OVERRIDE"
        ? a.priority.level
        : a.priority.derivedLevel;
    const bLevel =
      b.priority.mode === "OVERRIDE"
        ? b.priority.level
        : b.priority.derivedLevel;
    const priorityDiff =
      (PRIORITY_LEVEL_RANK[bLevel] ?? 0) - (PRIORITY_LEVEL_RANK[aLevel] ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    const bucketDiff =
      (BUCKET_URGENCY[b.bucket] ?? 0) - (BUCKET_URGENCY[a.bucket] ?? 0);
    if (bucketDiff !== 0) return bucketDiff;
    return a.currentRank - b.currentRank;
  });
}

// ─── Append events to rolling buffer ─────────────────────────────────────────

export function appendEvents(
  existing: SurveillanceEvent[],
  newEvents: SurveillanceEvent[],
): SurveillanceEvent[] {
  if (newEvents.length === 0) return existing;
  const combined = [...existing, ...newEvents];
  // Keep most recent N events
  return combined.slice(-SURVEILLANCE_EVENT_BUFFER_DEPTH);
}
