// D16 Hybrid v0.8 — Universe Ranking Engine
// Builds ranked UniverseTopEntryRecord[] from hydrated per-market states.
// Pipeline: CanonicalAssetState → HybridCorrelationState → EntryEngineOutput → ranking
// No shortcut paths. No resolver rewrites.

import { resolveEntryEngine } from "./entryEngine";
import { resolveHybridCorrelation } from "./hybridEngine";
import type { CanonicalAssetState } from "./hybridTypes";
import type {
  TopEntryCategory,
  UniverseAssetHydration,
  UniverseEligibilityRecord,
  UniverseTierAssignment,
  UniverseTopEntryRecord,
} from "./universeTypes";
import { CANONICAL_ANCHOR_ASSETS } from "./universeTypes";

const ANCHOR_ASSET_SET_RANKING = new Set<string>(CANONICAL_ANCHOR_ASSETS);

// ─── Permission level rank values ──────────────────────────────────────────────────────

const PERMISSION_RANK: Record<string, number> = {
  EXACT: 100,
  PROVISIONAL: 75,
  PROJECTED_ONLY: 50,
  WATCH_ONLY: 25,
  BLOCKED: 0,
};

const TIER_RANK: Record<string, number> = {
  TIER_1: 100,
  TIER_2: 65,
  TIER_3: 30,
  EXCLUDED: 0,
};

// ─── Overall rank score ────────────────────────────────────────────────────────────────
// Weighted composite. Exact entries should usually outrank provisional.

function computeOverallRankScore(
  permissionLevel: string,
  crossMarketConfirmation: number,
  runtimeTrust: number,
  tier: string,
  coverageScore: number,
  confirmationStrength: number,
  freshnessPenalty: number, // 0 = fresh, 100 = very stale
): number {
  const permScore = PERMISSION_RANK[permissionLevel] ?? 0;
  const tierScore = TIER_RANK[tier] ?? 0;

  const raw =
    permScore * 0.3 +
    crossMarketConfirmation * 0.25 +
    runtimeTrust * 0.2 +
    tierScore * 0.1 +
    (coverageScore / 100) * 100 * 0.1 +
    confirmationStrength * 0.05 -
    freshnessPenalty * 0.1;

  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ─── Category assignment ────────────────────────────────────────────────────────────────

function assignCategories(
  permissionLevel: string,
  entryClass: string,
  divergenceType: string,
  _leadMarket: string,
): TopEntryCategory[] {
  const cats: TopEntryCategory[] = [];

  // Permission-based categories
  if (permissionLevel === "EXACT") cats.push("TOP_EXACT");
  else if (permissionLevel === "PROVISIONAL") cats.push("TOP_PROVISIONAL");
  else if (
    permissionLevel === "PROJECTED_ONLY" ||
    permissionLevel === "WATCH_ONLY"
  ) {
    cats.push("TOP_WATCH");
  }

  // Divergence-based categories
  if (
    divergenceType === "FUTURES_LEADS_SPOT" ||
    divergenceType === "FUTURES_OVEREXTENDED"
  ) {
    cats.push("TOP_FUTURES_LEADS_SPOT");
  }
  if (
    divergenceType === "SPOT_CONFIRMS_FUTURES" ||
    divergenceType === "BINANCE_SPOT_LEADS_COINBASE" ||
    divergenceType === "COINBASE_LEADS_BINANCE_SPOT"
  ) {
    cats.push("TOP_SPOT_CONFIRMED");
  }

  // Entry class categories (only if entry is not blocked)
  if (permissionLevel !== "BLOCKED") {
    if (entryClass === "BREAKOUT") cats.push("TOP_BREAKOUT");
    if (entryClass === "RECLAIM") cats.push("TOP_RECLAIM");
    if (entryClass === "PULLBACK") cats.push("TOP_PULLBACK");
    if (entryClass === "CONTINUATION") cats.push("TOP_CONTINUATION");
    if (entryClass === "REVERSAL") cats.push("TOP_REVERSAL");
  }

  return cats;
}

// ─── Rank justification ───────────────────────────────────────────────────────────────────

function buildWhyRanked(
  permissionLevel: string,
  entryClass: string,
  crossMarketConfirmation: number,
  leadMarket: string,
  divergenceType: string,
  tier: string,
  confirmationStrength: number,
): string[] {
  const chips: string[] = [];

  if (permissionLevel === "EXACT") chips.push("✓ EXACT ENTRY");
  else if (permissionLevel === "PROVISIONAL") chips.push("◦ PROVISIONAL");
  else if (permissionLevel === "PROJECTED_ONLY") chips.push("◦ PROJECTED");
  else if (permissionLevel === "WATCH_ONLY") chips.push("◦ WATCH");

  if (entryClass !== "NONE") chips.push(entryClass);

  if (crossMarketConfirmation >= 75) chips.push("Strong x-mkt");
  else if (crossMarketConfirmation >= 50) chips.push("Mod x-mkt");

  if (leadMarket !== "NONE")
    chips.push(`${leadMarket.replace("_", " ")} leads`);

  if (divergenceType !== "NONE") chips.push(divergenceType.replace(/_/g, " "));

  if (tier === "TIER_1") chips.push("T1");
  else if (tier === "TIER_2") chips.push("T2");

  if (confirmationStrength >= 80) chips.push("High conf");

  return chips.slice(0, 5); // cap at 5 chips per card
}

// ─── Stale penalty ─────────────────────────────────────────────────────────────────────

function computeFreshnessPenalty(lastRecomputedAt: number | null): number {
  if (!lastRecomputedAt) return 50;
  const ageMs = Date.now() - lastRecomputedAt;
  if (ageMs < 10_000) return 0;
  if (ageMs < 30_000) return 10;
  if (ageMs < 60_000) return 25;
  if (ageMs < 120_000) return 50;
  return 80;
}

// ─── Build ranked record for one asset ──────────────────────────────────────────────────

export function buildRankedRecord(
  hydration: UniverseAssetHydration,
  tierAssignment: UniverseTierAssignment,
  eligibilityRecord: UniverseEligibilityRecord,
  outcomeEvidence?: {
    hasHistory: boolean;
    patternPrecision: number | null;
    note: string | null;
  },
): UniverseTopEntryRecord | null {
  const assetState: CanonicalAssetState = {
    asset: hydration.asset,
    binanceSpot: hydration.binanceSpotState,
    binanceFutures: hydration.binanceFuturesState,
    coinbaseSpot: hydration.coinbaseSpotState,
  };

  // Run the canonical pipeline
  const hybrid = resolveHybridCorrelation(assetState);
  const entry = resolveEntryEngine(assetState, hybrid);

  const freshnessPenalty = computeFreshnessPenalty(hydration.lastHydratedAt);

  // Compute average runtime trust across available markets
  const trustValues = [
    hydration.binanceSpotState?.runtimeTrust,
    hydration.binanceFuturesState?.runtimeTrust,
    hydration.coinbaseSpotState?.runtimeTrust,
  ].filter((v): v is number => v !== undefined);
  const avgTrust =
    trustValues.length > 0
      ? Math.round(trustValues.reduce((s, v) => s + v, 0) / trustValues.length)
      : 0;

  const overallRankScore = computeOverallRankScore(
    entry.permissionLevel,
    hybrid.crossMarketConfirmation,
    avgTrust,
    tierAssignment.tier,
    eligibilityRecord.coverageScore,
    entry.confirmationStrength,
    freshnessPenalty,
  );

  const categories = assignCategories(
    entry.permissionLevel,
    entry.entryClass,
    hybrid.divergenceType,
    hybrid.leadMarket,
  );

  const categoryRanks: Partial<Record<TopEntryCategory, number>> = {};
  for (const cat of categories) {
    categoryRanks[cat] = overallRankScore;
  }

  const whyRanked = buildWhyRanked(
    entry.permissionLevel,
    entry.entryClass,
    hybrid.crossMarketConfirmation,
    hybrid.leadMarket,
    hybrid.divergenceType,
    tierAssignment.tier,
    entry.confirmationStrength,
  );

  const isStale = hydration.isStale || freshnessPenalty > 25;

  return {
    asset: hydration.asset,
    tier: tierAssignment.tier,
    eligibility: eligibilityRecord.eligibility,
    side: entry.side,
    permissionLevel: entry.permissionLevel,
    entryClass: entry.entryClass,
    hybridPermission: hybrid.hybridPermission,
    crossMarketConfirmation: hybrid.crossMarketConfirmation,
    runtimeTrust: avgTrust,
    leadMarket: hybrid.leadMarket,
    divergenceType: hybrid.divergenceType,
    mainBlocker: entry.mainBlocker,
    nextUnlockCondition: entry.nextUnlockCondition,
    confirmationStrength: entry.confirmationStrength,
    invalidationClarity: entry.invalidationClarity,
    rewardFeasibility: entry.rewardFeasibility,
    strongestConfirmingMarket: entry.strongestConfirmingMarket,
    laggingOrBlockingMarket: entry.laggingOrBlockingMarket,
    overallRankScore,
    categoryRanks,
    activeCategories: categories,
    whyRanked,
    outcomeEvidence: outcomeEvidence ?? {
      hasHistory: false,
      patternPrecision: null,
      note: null,
    },
    lastRecomputedAt: hydration.lastHydratedAt ?? Date.now(),
    isStale,
  };
}

// ─── Rank full universe ────────────────────────────────────────────────────────────────────

export function rankUniverse(
  hydrationMap: Map<string, UniverseAssetHydration>,
  tierMap: Map<string, UniverseTierAssignment>,
  eligibilityMap: Map<string, UniverseEligibilityRecord>,
  outcomeEvidenceMap?: Map<
    string,
    {
      hasHistory: boolean;
      patternPrecision: number | null;
      note: string | null;
    }
  >,
): UniverseTopEntryRecord[] {
  const records: UniverseTopEntryRecord[] = [];

  const now = Date.now();
  for (const [asset, hydration] of hydrationMap) {
    let tier = tierMap.get(asset);
    let elig = eligibilityMap.get(asset);

    // Defensive: synthesize tier/elig for anchor assets that are hydrated but
    // missing from maps (can happen briefly after LIVE mode activation or after
    // a failed/partial discovery run).
    if (!tier && ANCHOR_ASSET_SET_RANKING.has(asset)) {
      tier = {
        asset,
        tier: "TIER_1",
        assignedAt: now,
        reasons: ["Canonical anchor — synthesized for ranking"],
        promotionEligible: false,
        demotionWarning: false,
      };
    }
    if (!elig && ANCHOR_ASSET_SET_RANKING.has(asset)) {
      elig = {
        asset,
        eligibility: "ELIGIBLE",
        reasonsIncluded: ["Canonical anchor — synthesized for ranking"],
        reasonsLimited: [],
        reasonsExcluded: [],
        liquidityScore: 100,
        coverageScore: 100,
        runtimeQualityScore: 100,
        mappingIntegrityScore: 100,
        overallEligibilityScore: 100,
      };
    }

    if (!tier || !elig) continue;

    // Never rank excluded assets
    if (tier.tier === "EXCLUDED" || elig.eligibility === "EXCLUDED") continue;

    // Only rank assets with at least one market hydrated
    if (hydration.hydratedMarkets === 0) continue;

    const evidence = outcomeEvidenceMap?.get(asset);
    const record = buildRankedRecord(hydration, tier, elig, evidence);
    if (record) records.push(record);
  }

  // Sort by overall rank score descending
  records.sort((a, b) => b.overallRankScore - a.overallRankScore);

  return records;
}
