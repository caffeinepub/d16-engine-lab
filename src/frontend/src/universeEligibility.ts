// D16 Hybrid v0.8 — Universe Eligibility Filter
// Applies multi-factor eligibility scoring to each discovered universe asset.
// Output: UniverseEligibilityRecord with explicit reasons (not silent exclusion).

import type { UniverseAsset, UniverseEligibilityRecord } from "./universeTypes";
import {
  MIN_COVERAGE_SCORE_ELIGIBLE,
  MIN_COVERAGE_SCORE_FULL,
  MIN_VOLUME_USD_TIER1,
  MIN_VOLUME_USD_TIER2,
  MIN_VOLUME_USD_TIER3,
} from "./universeTypes";

// ─── Score Helpers ───────────────────────────────────────────────────────────────────

function computeCoverageScore(asset: UniverseAsset): number {
  const { binanceSpot, binanceFutures, coinbaseSpot } = asset.availability;
  const count = [binanceSpot, binanceFutures, coinbaseSpot].filter(
    Boolean,
  ).length;
  // 0 markets = 0, 1 market = 33, 2 markets = 66, 3 markets = 100
  return Math.round((count / 3) * 100);
}

function computeLiquidityScore(asset: UniverseAsset): number {
  // Best available volume across all markets
  const volumes = [
    asset.volumeUsd.binanceSpot,
    asset.volumeUsd.binanceFutures,
    asset.volumeUsd.coinbaseSpot,
  ].filter((v): v is number => v !== null && v > 0);

  if (volumes.length === 0) return 0;
  const maxVol = Math.max(...volumes);

  // Log scale: $500K = 10, $5M = 40, $50M = 70, $500M = 90, $5B+ = 100
  if (maxVol >= MIN_VOLUME_USD_TIER1 * 10) return 100;
  if (maxVol >= MIN_VOLUME_USD_TIER1) return 80;
  if (maxVol >= MIN_VOLUME_USD_TIER2 * 5) return 65;
  if (maxVol >= MIN_VOLUME_USD_TIER2) return 50;
  if (maxVol >= MIN_VOLUME_USD_TIER3 * 5) return 35;
  if (maxVol >= MIN_VOLUME_USD_TIER3) return 20;
  return 5;
}

function computeMappingIntegrityScore(asset: UniverseAsset): number {
  // Symbol format sanity checks
  let score = 100;
  const { binanceSpotSymbol, binanceFuturesSymbol, coinbaseSpotProduct } =
    asset;

  // Each exchange-specific symbol should end with expected quote
  if (binanceSpotSymbol && !binanceSpotSymbol.endsWith("USDT")) score -= 15;
  if (binanceFuturesSymbol && !binanceFuturesSymbol.endsWith("USDT"))
    score -= 15;
  if (coinbaseSpotProduct && !coinbaseSpotProduct.includes("-")) score -= 20;

  // Asset ID must be reasonable length
  if (asset.asset.length > 10) score -= 20;
  if (asset.asset.length < 2) score -= 30;

  return Math.max(0, score);
}

function computeRuntimeQualityScore(asset: UniverseAsset): number {
  // At discovery time, runtime quality is inferred from availability and volume.
  // After hydration, this can be updated with actual adapter state.
  const coverage = computeCoverageScore(asset);
  const liquidity = computeLiquidityScore(asset);
  // Runtime quality is a blend of coverage and liquidity at discovery time
  return Math.round(coverage * 0.4 + liquidity * 0.6);
}

// ─── Main Eligibility Computation ──────────────────────────────────────────────────────

export function computeEligibility(
  asset: UniverseAsset,
): UniverseEligibilityRecord {
  const coverageScore = computeCoverageScore(asset);
  const liquidityScore = computeLiquidityScore(asset);
  const mappingIntegrityScore = computeMappingIntegrityScore(asset);
  const runtimeQualityScore = computeRuntimeQualityScore(asset);

  const reasonsIncluded: string[] = [];
  const reasonsLimited: string[] = [];
  const reasonsExcluded: string[] = [];

  // Hard exclusion conditions
  if (!asset.discovery.active) {
    reasonsExcluded.push("No active market listing found");
  }
  if (coverageScore < MIN_COVERAGE_SCORE_ELIGIBLE) {
    reasonsExcluded.push("Zero market coverage");
  }
  if (liquidityScore < 5) {
    reasonsExcluded.push("Insufficient liquidity (below minimum threshold)");
  }
  if (mappingIntegrityScore < 40) {
    reasonsExcluded.push("Poor symbol mapping integrity");
  }
  if (asset.asset.length > 10) {
    reasonsExcluded.push("Symbol too long — likely fragmented or exotic");
  }

  // Limitation conditions
  if (coverageScore < MIN_COVERAGE_SCORE_FULL) {
    reasonsLimited.push("Single-market coverage only");
  }
  if (liquidityScore < 35) {
    reasonsLimited.push("Low liquidity relative to operator threshold");
  }
  if (!asset.availability.binanceFutures) {
    reasonsLimited.push(
      "No Binance Futures listing — hybrid confirmation reduced",
    );
  }
  if (runtimeQualityScore < 30) {
    reasonsLimited.push("Runtime quality below recommended level");
  }

  // Positive inclusion reasons
  if (coverageScore === 100) {
    reasonsIncluded.push("Full 3-market coverage");
  } else if (coverageScore >= MIN_COVERAGE_SCORE_FULL) {
    reasonsIncluded.push("2-market coverage");
  }
  if (liquidityScore >= 70) {
    reasonsIncluded.push("High liquidity");
  } else if (liquidityScore >= 50) {
    reasonsIncluded.push("Adequate liquidity");
  }
  if (asset.availability.binanceFutures) {
    reasonsIncluded.push("Binance Futures listed");
  }

  // Determine overall eligibility
  const overallScore = Math.round(
    liquidityScore * 0.35 +
      coverageScore * 0.35 +
      runtimeQualityScore * 0.2 +
      mappingIntegrityScore * 0.1,
  );

  let eligibility: UniverseEligibilityRecord["eligibility"];

  if (reasonsExcluded.length > 0) {
    eligibility = "EXCLUDED";
  } else if (reasonsLimited.length > 0 && overallScore < 45) {
    eligibility = "LIMITED_ELIGIBILITY";
  } else if (reasonsLimited.length > 0) {
    eligibility = "LIMITED_ELIGIBILITY";
  } else {
    eligibility = "ELIGIBLE";
  }

  return {
    asset: asset.asset,
    eligibility,
    reasonsIncluded,
    reasonsLimited,
    reasonsExcluded,
    liquidityScore,
    coverageScore,
    runtimeQualityScore,
    mappingIntegrityScore,
    overallEligibilityScore: overallScore,
  };
}

// ─── Batch Eligibility ───────────────────────────────────────────────────────────────────

export function computeAllEligibility(
  assets: Map<string, UniverseAsset>,
): Map<string, UniverseEligibilityRecord> {
  const result = new Map<string, UniverseEligibilityRecord>();
  for (const [, asset] of assets) {
    result.set(asset.asset, computeEligibility(asset));
  }
  return result;
}
