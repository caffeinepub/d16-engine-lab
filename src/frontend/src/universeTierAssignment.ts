// D16 Hybrid v0.8 — Universe Tier Assignment
// Assigns assets to TIER_1 / TIER_2 / TIER_3 / EXCLUDED.
// TIER_1 is anchored to the 8 canonical assets (always TIER_1 unless explicitly excluded).
// Tier assignment is deterministic given eligibility scores.
// Supports auto-promotion / auto-demotion rules.

import type {
  UniverseAsset,
  UniverseEligibilityRecord,
  UniverseTierAssignment,
} from "./universeTypes";
import {
  CANONICAL_ANCHOR_ASSETS,
  MIN_VOLUME_USD_TIER1,
  MIN_VOLUME_USD_TIER2,
} from "./universeTypes";

// ─── Tier assignment logic ──────────────────────────────────────────────────────────

const CANONICAL_ANCHOR_SET = new Set<string>(CANONICAL_ANCHOR_ASSETS);

export function assignTier(
  asset: UniverseAsset,
  eligibility: UniverseEligibilityRecord,
  existingTier?: UniverseTierAssignment | null,
): UniverseTierAssignment {
  const now = Date.now();
  const reasons: string[] = [];
  const _promotionEligible = false;
  let demotionWarning = false;

  // EXCLUDED: always excluded if eligibility says so
  if (eligibility.eligibility === "EXCLUDED") {
    return {
      asset: asset.asset,
      tier: "EXCLUDED",
      assignedAt: now,
      reasons: [
        "Excluded by eligibility filter",
        ...eligibility.reasonsExcluded,
      ],
      promotionEligible: false,
      demotionWarning: false,
    };
  }

  // TIER_1 anchors: always TIER_1 if eligible at all
  if (CANONICAL_ANCHOR_SET.has(asset.asset)) {
    reasons.push("Canonical anchor asset (bootstrap TIER_1)");
    if (eligibility.coverageScore === 100)
      reasons.push("Full 3-market coverage");
    if (eligibility.liquidityScore >= 70) reasons.push("High liquidity");
    return {
      asset: asset.asset,
      tier: "TIER_1",
      assignedAt: now,
      reasons,
      promotionEligible: false,
      demotionWarning: false,
    };
  }

  // TIER_1 expansion: non-anchor assets that clear strong thresholds
  const maxVolume = Math.max(
    asset.volumeUsd.binanceSpot ?? 0,
    asset.volumeUsd.binanceFutures ?? 0,
    asset.volumeUsd.coinbaseSpot ?? 0,
  );

  const isFullCoverage = eligibility.coverageScore === 100;
  const isHighVolume = maxVolume >= MIN_VOLUME_USD_TIER1;
  const hasHighLiquidity = eligibility.liquidityScore >= 75;
  const hasFutures = asset.availability.binanceFutures;
  const isEligible = eligibility.eligibility === "ELIGIBLE";

  if (
    isEligible &&
    hasFutures &&
    isFullCoverage &&
    isHighVolume &&
    hasHighLiquidity
  ) {
    reasons.push("High liquidity + full 3-market coverage");
    reasons.push("Meets TIER_1 expansion threshold");
    if (eligibility.liquidityScore >= 90) reasons.push("Top-tier volume");

    // Demotion warning if previously TIER_1 but scores are borderline
    if (existingTier?.tier === "TIER_1" && eligibility.liquidityScore < 80) {
      demotionWarning = true;
    }

    return {
      asset: asset.asset,
      tier: "TIER_1",
      assignedAt: existingTier?.assignedAt ?? now,
      reasons,
      promotionEligible: false,
      demotionWarning,
    };
  }

  // TIER_2: eligible assets with moderate coverage + liquidity
  const isModerateLiquidity = maxVolume >= MIN_VOLUME_USD_TIER2;
  const hasAtLeastTwoMarkets = eligibility.coverageScore >= 66;

  if (isEligible && hasFutures && isModerateLiquidity) {
    reasons.push("Binance Futures listed with adequate liquidity");
    if (hasAtLeastTwoMarkets) reasons.push("Multi-market coverage");

    // Promotion eligibility: close to TIER_1
    const mayPromote =
      isFullCoverage &&
      hasHighLiquidity &&
      maxVolume >= MIN_VOLUME_USD_TIER1 * 0.5;

    return {
      asset: asset.asset,
      tier: "TIER_2",
      assignedAt:
        existingTier?.tier === "TIER_2"
          ? (existingTier?.assignedAt ?? now)
          : now,
      reasons,
      promotionEligible: mayPromote,
      demotionWarning: false,
    };
  }

  // LIMITED_ELIGIBILITY assets that have futures get TIER_2 if they have some liquidity
  if (
    eligibility.eligibility === "LIMITED_ELIGIBILITY" &&
    hasFutures &&
    isModerateLiquidity
  ) {
    reasons.push("Limited eligibility but Futures listed");
    return {
      asset: asset.asset,
      tier: "TIER_2",
      assignedAt: now,
      reasons,
      promotionEligible: false,
      demotionWarning: true,
    };
  }

  // TIER_3: everything else that isn't excluded
  reasons.push("Broad universe coverage (low priority)");
  if (!hasFutures) reasons.push("Spot-only — no Futures listing");
  if (!isModerateLiquidity) reasons.push("Volume below TIER_2 threshold");
  if (eligibility.eligibility === "LIMITED_ELIGIBILITY")
    reasons.push("Limited eligibility");

  return {
    asset: asset.asset,
    tier: "TIER_3",
    assignedAt: now,
    reasons,
    promotionEligible: false,
    demotionWarning: false,
  };
}

// ─── Batch tier assignment ────────────────────────────────────────────────────────────

export function assignAllTiers(
  assets: Map<string, UniverseAsset>,
  eligibility: Map<string, UniverseEligibilityRecord>,
  existingTiers?: Map<string, UniverseTierAssignment>,
): Map<string, UniverseTierAssignment> {
  const result = new Map<string, UniverseTierAssignment>();
  for (const [assetId, asset] of assets) {
    const elig = eligibility.get(assetId);
    if (!elig) continue;
    const existing = existingTiers?.get(assetId) ?? null;
    result.set(assetId, assignTier(asset, elig, existing));
  }
  return result;
}
