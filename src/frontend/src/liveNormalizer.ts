// D16 Hybrid v0.6 — Live Market Data Normalizer
// Layer 0→1 boundary: raw snapshot → PerMarketState
//
// DOCTRINE:
// This is the ONLY place where raw transport data is converted into
// engine-consumable state. It is deterministic given the same input.
// No shortcuts. No vague "looks good" heuristics.
// Each field is derived from explicit, auditable rules.

import type {
  MarketDirection,
  MarketExecutionPermission,
  MarketMaturity,
  MarketTrustClass,
  PerMarketState,
} from "./hybridTypes";
import type { LiveMarketSnapshot } from "./liveAdapterTypes";

// ─── Direction Derivation ──────────────────────────────────────────────────────
// Based on 24h price change percentage.
// Futures also considers funding rate when available.

function deriveDirection(
  pctChange24h: number,
  fundingRate: number | null,
): MarketDirection {
  // Futures-specific: if funding rate is extreme, it amplifies the signal
  let adjustment = 0;
  if (fundingRate !== null) {
    // Positive funding = longs paying shorts = bullish bias
    // Negative funding = shorts paying longs = bearish bias
    if (fundingRate > 0.001) adjustment = 0.5;
    else if (fundingRate < -0.001) adjustment = -0.5;
  }

  const signal = pctChange24h + adjustment;

  if (signal > 2.0) return "LONG";
  if (signal < -2.0) return "SHORT";
  return "NEUTRAL";
}

// ─── Maturity Derivation ───────────────────────────────────────────────────────
// Maturity represents where the asset is in its move phase.
// Derived from magnitude of 24h change + momentum pattern.
// This is a first approximation — full maturity needs multi-timeframe data.
// With snapshot-only data, we use magnitude as a proxy for phase.

function deriveMaturity(
  pctChange24h: number,
  volume24h: number,
  openInterest: number | null,
): MarketMaturity {
  const absPct = Math.abs(pctChange24h);

  // CANCELLED: Extreme gap or conflicting signals
  if (absPct > 30) return "CANCELLED";

  // DECAY: Reversing after large move (pct positive but slowing indicators)
  // Without tick-level data, we approximate: large OI drop signals decay
  // For spot: use volume as proxy
  if (absPct > 15 && volume24h > 0) {
    // If OI is very low relative to a big futures move, likely decay
    if (openInterest !== null && openInterest < 1000) return "DECAY";
    return "LIVE";
  }

  if (absPct > 10) return "READY";
  if (absPct > 7) return "ARMED";
  if (absPct > 4) return "ACTIVE";
  if (absPct > 2.5) return "FORMING";
  if (absPct > 1) return "BREWING";
  return "EARLY";
}

// ─── Trust Class Derivation ────────────────────────────────────────────────────
// Based on spread quality (high-low vs price), volume health, and data completeness.

function deriveTrustClass(
  price: number,
  high: number,
  low: number,
  volume: number,
  adapterTrustContribution: number,
): MarketTrustClass {
  // Adapter health is the first gate
  if (adapterTrustContribution < 20) return "INVALID_RUNTIME";
  if (adapterTrustContribution < 40) return "LOW_TRUST";

  // Data quality gates
  if (price <= 0) return "INVALID_RUNTIME";
  if (volume <= 0) return "LOW_TRUST";

  // Spread sanity check (if high/low available)
  if (high > 0 && low > 0 && price > 0) {
    const spread = (high - low) / price;
    // Abnormally wide spread → reduced trust
    if (spread > 0.3) return "REDUCED_TRUST";
  }

  if (adapterTrustContribution >= 90) return "HIGH_TRUST";
  if (adapterTrustContribution >= 70) return "GOOD_TRUST";
  return "REDUCED_TRUST";
}

// ─── Execution Permission Derivation ──────────────────────────────────────────
// Derived from trust class + maturity combination.
// This maps to the D16 permission ladder.

function deriveExecutionPermission(
  maturity: MarketMaturity,
  trustClass: MarketTrustClass,
  direction: MarketDirection,
): MarketExecutionPermission {
  if (trustClass === "INVALID_RUNTIME" || direction === "NEUTRAL")
    return "NO_PLAN";
  if (trustClass === "LOW_TRUST") return "NO_PLAN";

  switch (maturity) {
    case "CANCELLED":
    case "EARLY":
      return "NO_PLAN";
    case "BREWING":
      return trustClass === "REDUCED_TRUST" ? "NO_PLAN" : "PROJECTED_ONLY";
    case "FORMING":
      return "PROJECTED_ONLY";
    case "ACTIVE":
      return trustClass === "HIGH_TRUST"
        ? "PROVISIONAL_PLAN"
        : "PROJECTED_ONLY";
    case "ARMED":
      return trustClass === "HIGH_TRUST" ? "EXACT_PLAN" : "PROVISIONAL_PLAN";
    case "READY":
    case "LIVE":
      return trustClass !== "REDUCED_TRUST" ? "EXACT_PLAN" : "PROVISIONAL_PLAN";
    case "DECAY":
      return "PROJECTED_ONLY";
    default:
      return "NO_PLAN";
  }
}

// ─── Score derivations ─────────────────────────────────────────────────────────

function deriveStructuralScore(
  pctChange24h: number,
  high: number,
  low: number,
  price: number,
): number {
  const absPct = Math.abs(pctChange24h);
  // Position in 24h range (0=at low, 100=at high)
  let rangePosition = 50;
  if (high > 0 && low > 0 && high > low) {
    rangePosition = Math.round(((price - low) / (high - low)) * 100);
  }
  // Combine: range position and magnitude
  // LONG above 50 means good structural score; SHORT below 50 also good
  const magnitudeScore = Math.min(absPct * 5, 60);
  const rangeScore =
    pctChange24h >= 0 ? rangePosition * 0.4 : (100 - rangePosition) * 0.4;
  return Math.round(Math.min(magnitudeScore + rangeScore, 100));
}

function deriveActivationScore(
  pctChange24h: number,
  volume24h: number,
  openInterest: number | null,
): number {
  const absPct = Math.abs(pctChange24h);
  const volScore = volume24h > 0 ? Math.min(Math.log10(volume24h) * 8, 50) : 0;
  const momentumScore = Math.min(absPct * 6, 50);
  const oiBonus = openInterest !== null && openInterest > 10000 ? 10 : 0;
  return Math.round(Math.min(volScore + momentumScore + oiBonus, 100));
}

function deriveEntryReadiness(
  executionPermission: MarketExecutionPermission,
  structuralScore: number,
  activationScore: number,
): number {
  const permMultiplier: Record<MarketExecutionPermission, number> = {
    NO_PLAN: 0.0,
    PROJECTED_ONLY: 0.3,
    PROVISIONAL_PLAN: 0.65,
    EXACT_PLAN: 0.9,
    LIVE_MANAGEMENT: 1.0,
  };
  const composite = (structuralScore + activationScore) / 2;
  return Math.round(composite * permMultiplier[executionPermission]);
}

// ─── Blocker message ───────────────────────────────────────────────────────────

function deriveMainBlocker(
  trustClass: MarketTrustClass,
  direction: MarketDirection,
  maturity: MarketMaturity,
  executionPermission: MarketExecutionPermission,
): string | null {
  if (trustClass === "INVALID_RUNTIME")
    return "Invalid runtime — adapter not healthy";
  if (trustClass === "LOW_TRUST")
    return "Low trust — data quality insufficient";
  if (direction === "NEUTRAL") return "No directional signal — neutral market";
  if (maturity === "CANCELLED") return "State cancelled — extreme volatility";
  if (maturity === "EARLY") return "Early stage — no structural formation";
  if (executionPermission === "NO_PLAN")
    return "No execution plan — conditions not met";
  if (executionPermission === "PROJECTED_ONLY")
    return "Projected only — awaiting structure confirmation";
  return null;
}

// ─── Main normalizer function ──────────────────────────────────────────────────

export function normalizeSnapshot(
  snapshot: LiveMarketSnapshot,
  adapterTrustContribution: number,
): PerMarketState {
  const direction = deriveDirection(
    snapshot.priceChangePct24h,
    snapshot.fundingRate,
  );
  const maturity = deriveMaturity(
    snapshot.priceChangePct24h,
    snapshot.volume24h,
    snapshot.openInterest,
  );
  const trustClass = deriveTrustClass(
    snapshot.price,
    snapshot.high24h,
    snapshot.low24h,
    snapshot.volume24h,
    adapterTrustContribution,
  );
  const executionPermission = deriveExecutionPermission(
    maturity,
    trustClass,
    direction,
  );
  const structuralScore = deriveStructuralScore(
    snapshot.priceChangePct24h,
    snapshot.high24h,
    snapshot.low24h,
    snapshot.price,
  );
  const activationScore = deriveActivationScore(
    snapshot.priceChangePct24h,
    snapshot.volume24h,
    snapshot.openInterest,
  );
  const entryReadiness = deriveEntryReadiness(
    executionPermission,
    structuralScore,
    activationScore,
  );
  const mainBlocker = deriveMainBlocker(
    trustClass,
    direction,
    maturity,
    executionPermission,
  );

  return {
    direction,
    maturity,
    trustClass,
    executionPermission,
    structuralScore,
    activationScore,
    entryReadiness,
    runtimeTrust: adapterTrustContribution,
    mainBlocker,
    updatedAt: snapshot.receivedAt,
  };
}
