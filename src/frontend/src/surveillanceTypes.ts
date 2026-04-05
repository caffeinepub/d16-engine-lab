// D16 Hybrid v0.8.1 — Surveillance Layer Type System
// Priority surveillance for top Universe candidates.
// These types are canonical. Do not flatten or merge with Universe ranking types.
//
// v0.8.1 fix: Added CANONICAL_ANCHOR_ASSETS_SET for diagnostics and
// diagnostics field on UseSurveillanceResult to support full-universe tracking.

import type { UniverseTopEntryRecord } from "./universeTypes";

// ─── Surveillance source ───────────────────────────────────────────────────────────────
// Whether a candidate was auto-added by the ranking engine, manually pinned
// by the operator, or both.

export type SurveillanceCandidateSource =
  | "AUTO_RANKED" // Added automatically because it appeared in top-N ranking
  | "OPERATOR_PINNED" // Manually pinned by the operator
  | "BOTH"; // Was auto-ranked AND manually pinned

// ─── Surveillance priority ───────────────────────────────────────────────────────────

export type SurveillancePriorityLevel = "HIGH" | "MEDIUM" | "LOW";

export type SurveillancePriority =
  | { mode: "AUTO"; derivedLevel: SurveillancePriorityLevel; score: number }
  | { mode: "OVERRIDE"; level: SurveillancePriorityLevel };

// ─── Surveillance bucket ─────────────────────────────────────────────────────────────
// The operator-facing classification of the candidate's current state.

export type SurveillanceBucket =
  | "EXACT_NOW" // Permission is EXACT — entry window open
  | "NEAR_EXACT" // Permission is PROVISIONAL — one step away
  | "ESCALATING" // Moving toward higher permission rapidly
  | "STABLE_HIGH" // High-quality state, no significant recent movement
  | "DEGRADING" // Losing permission or trust
  | "THESIS_BROKEN" // Significant deterioration — invalidation territory
  | "DROPPED"; // Fell out of top-ranked set (operator-pinned only keep watching)

// ─── Surveillance event category ───────────────────────────────────────────────────

export type SurveillanceEventCategory =
  | "RANK_MOVEMENT" // Rank changed up or down
  | "PERMISSION_TRANSITION" // Permission level changed
  | "LEAD_LAG_CHANGE" // Lead or lag market changed
  | "TRUST_CHANGE" // Runtime trust improved or degraded
  | "BLOCKER_CHANGE" // Blocker appeared, changed, escalated, or cleared
  | "ENTRY_WINDOW" // Approaching entry, exact now, exact lost, thesis weakening/invalidated
  | "RANK_ENTRY" // Asset entered the ranked top set
  | "RANK_EXIT"; // Asset dropped out of the ranked top set

export type SurveillanceEventSeverity =
  | "INFO"
  | "POSITIVE"
  | "NEGATIVE"
  | "URGENT";

// A single detected change event for a candidate
export type SurveillanceEvent = {
  eventId: string; // unique: `${asset}-${timestamp}-${category}`
  asset: string;
  category: SurveillanceEventCategory;
  severity: SurveillanceEventSeverity;
  description: string; // human-readable: "Permission: WATCH_ONLY → PROVISIONAL"
  before: string | null; // previous value (string label)
  after: string | null; // new value (string label)
  timestamp: number;
};

// ─── Surveillance candidate ─────────────────────────────────────────────────────────────
// The full monitored record for one asset.

export type SurveillanceCandidate = {
  asset: string;

  // Source classification
  source: SurveillanceCandidateSource;

  // Current ranking snapshot
  currentRecord: UniverseTopEntryRecord;

  // Previous snapshot (null on first observation)
  previousRecord: UniverseTopEntryRecord | null;

  // Rank tracking
  currentRank: number; // position in the rankedRecords array (1-based)
  previousRank: number | null;
  rankDelta: number | null; // negative = moved up (better), positive = moved down (worse)
  peakRank: number | null; // best rank seen during session

  // Permission tracking
  permissionAtEntry: string; // permission when first added to surveillance
  permissionChangedAt: number | null;

  // Bucket classification
  bucket: SurveillanceBucket;

  // Priority (auto-derived or operator-overridden)
  priority: SurveillancePriority;
  priorityOverriddenBy?: "OPERATOR";

  // Change event log
  // Internal: rolling 20-event buffer
  // Operator-visible: last 5 by default
  events: SurveillanceEvent[];
  lastEventAt: number | null;
  lastImportantChange: string | null; // human-readable summary of most recent significant event

  // Lifecycle
  addedAt: number;
  lastUpdatedAt: number;
  isStale: boolean; // underlying record is stale
  inCurrentTopSet: boolean; // still present in the universe ranked board
};

// ─── Surveillance state (persisted) ───────────────────────────────────────────────────

export type SurveillanceState = {
  // Candidates map: asset -> candidate
  candidates: Record<string, SurveillanceCandidate>;

  // Operator-pinned assets (always monitored even if outside top-N auto-selection)
  pinnedAssets: string[];

  // Operator priority overrides: asset -> level
  priorityOverrides: Record<string, SurveillancePriorityLevel>;

  // Last time any candidate was updated
  lastUpdatedAt: number | null;

  // Version (for future schema migration)
  version: number;
};

// ─── Surveillance diagnostics ─────────────────────────────────────────────────────
// Shows breakdown of watched assets: original-8 vs broader universe.

export type SurveillanceDiagnostics = {
  total: number;
  fromOriginal8: number;
  beyondOriginal8: number;
  stubsAwaitingHydration: number;
  hydrated: number;
};

// ─── Hook result ─────────────────────────────────────────────────────────────────

export type UseSurveillanceResult = {
  // Flat ordered list: sorted by priority then bucket urgency
  candidates: SurveillanceCandidate[];

  // Bucket-indexed lists
  buckets: Record<SurveillanceBucket, SurveillanceCandidate[]>;

  // Counts
  totalMonitored: number;
  autoSelectedCount: number;
  pinnedCount: number;
  lastEventAt: number | null;

  // Diagnostics: breakdown of original-8 vs beyond-8 watched assets
  diagnostics: SurveillanceDiagnostics;

  // Operator actions
  pinAsset: (asset: string) => void;
  unpinAsset: (asset: string) => void;
  isPinned: (asset: string) => boolean;
  setPriorityOverride: (
    asset: string,
    level: SurveillancePriorityLevel,
  ) => void;
  clearPriorityOverride: (asset: string) => void;
  dismissCandidate: (asset: string) => void; // removes from surveillance (only works on non-pinned auto candidates)
};

// ─── Constants ──────────────────────────────────────────────────────────────────

// How many top-ranked assets to auto-add to surveillance
export const SURVEILLANCE_AUTO_TOP_N = 10;

// Rolling event buffer depth (stored internally)
export const SURVEILLANCE_EVENT_BUFFER_DEPTH = 20;

// Default operator-visible event count
export const SURVEILLANCE_VISIBLE_EVENT_COUNT = 5;

// The original 8 canonical anchor assets — used in diagnostics to distinguish
// baseline behavior from broader universe expansion.
export const CANONICAL_ANCHOR_ASSETS_SET = new Set([
  "BTC",
  "ETH",
  "SOL",
  "XRP",
  "DOGE",
  "ADA",
  "LINK",
  "AVAX",
]);

// Bucket display order (most urgent first)
export const SURVEILLANCE_BUCKET_ORDER: SurveillanceBucket[] = [
  "EXACT_NOW",
  "NEAR_EXACT",
  "ESCALATING",
  "STABLE_HIGH",
  "DEGRADING",
  "THESIS_BROKEN",
  "DROPPED",
];

export const SURVEILLANCE_BUCKET_LABELS: Record<SurveillanceBucket, string> = {
  EXACT_NOW: "Exact Now",
  NEAR_EXACT: "Near Exact",
  ESCALATING: "Escalating",
  STABLE_HIGH: "Stable High",
  DEGRADING: "Degrading",
  THESIS_BROKEN: "Thesis Broken",
  DROPPED: "Dropped",
};

export const SURVEILLANCE_BUCKET_COLORS: Record<SurveillanceBucket, string> = {
  EXACT_NOW: "#22C55E",
  NEAR_EXACT: "#67E8F9",
  ESCALATING: "#FACC15",
  STABLE_HIGH: "#93C5FD",
  DEGRADING: "#F97316",
  THESIS_BROKEN: "#EF4444",
  DROPPED: "#6B7280",
};

export const PERMISSION_ORDER: Record<string, number> = {
  BLOCKED: 0,
  WATCH_ONLY: 1,
  PROJECTED_ONLY: 2,
  PROVISIONAL: 3,
  EXACT: 4,
};
