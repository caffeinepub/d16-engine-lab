// D16 Engine Core — Phase 0 + Phase 1 + Phase 2
// Canonical 16-dimension market reality engine

export type Direction = "LONG" | "SHORT" | "NEUTRAL";

export type Maturity =
  | "EARLY"
  | "BREWING"
  | "FORMING"
  | "ACTIVE"
  | "ARMED"
  | "READY"
  | "LIVE"
  | "DECAY"
  | "CANCELLED";

export type TrustClass =
  | "HIGH_TRUST"
  | "GOOD_TRUST"
  | "REDUCED_TRUST"
  | "LOW_TRUST"
  | "INVALID_RUNTIME";

export type ExecutionPermission =
  | "NO_PLAN"
  | "PROJECTED_ONLY"
  | "PROVISIONAL_PLAN"
  | "EXACT_PLAN"
  | "LIVE_MANAGEMENT";

export type Dimensions = {
  d1_macroAccumulation: number;
  d2_recentAccumulation: number;
  d3_priceHoldIntegrity: number;
  d4_compressionQuality: number;
  d5_volumePersistence: number;
  d6_releasePotential: number;
  d7_directionalClarity: number;
  d8_structuralCleanliness: number;
  d9_multiTimeframeAlignment: number;
  d10_activationQuality: number;
  d11_triggerQuality: number;
  d12_entryCleanliness: number;
  d13_invalidationClarity: number;
  d14_rewardFeasibility: number;
  d15_runtimeTrust: number;
  d16_stateStability: number;
};

export type GroupScores = {
  contextBase: number;
  structuralTruth: number;
  executionFeasibility: number;
  reliability: number;
};

export type CanonicalOutput = {
  direction: Direction;
  maturity: Maturity;
  trustClass: TrustClass;
  executionPermission: ExecutionPermission;
  operatorPriority: number;
  mainBlocker: string | null;
  nextPromotionCondition: string | null;
  recentChangeMeaning: string;
};

export type D16State = {
  symbol: string;
  id?: bigint;
  dimensions: Dimensions;
  groups: GroupScores;
  canonical: CanonicalOutput;
};

// ─── Group Score Calculations ───────────────────────────────────────────────

function calcGroupScores(d: Dimensions): GroupScores {
  const contextBase =
    0.2 * d.d1_macroAccumulation +
    0.16 * d.d2_recentAccumulation +
    0.16 * d.d3_priceHoldIntegrity +
    0.14 * d.d4_compressionQuality +
    0.14 * d.d5_volumePersistence +
    0.2 * d.d6_releasePotential;

  const structuralTruth =
    0.28 * d.d7_directionalClarity +
    0.22 * d.d8_structuralCleanliness +
    0.28 * d.d9_multiTimeframeAlignment +
    0.22 * d.d10_activationQuality;

  const executionFeasibility =
    0.24 * d.d11_triggerQuality +
    0.26 * d.d12_entryCleanliness +
    0.24 * d.d13_invalidationClarity +
    0.26 * d.d14_rewardFeasibility;

  const reliability = 0.58 * d.d15_runtimeTrust + 0.42 * d.d16_stateStability;

  return { contextBase, structuralTruth, executionFeasibility, reliability };
}

// ─── Direction Resolver ──────────────────────────────────────────────────────

function resolveDirection(d: Dimensions, groups: GroupScores): Direction {
  if (d.d7_directionalClarity < 45 || d.d9_multiTimeframeAlignment < 45) {
    return "NEUTRAL";
  }

  if (
    d.d7_directionalClarity >= 55 &&
    d.d9_multiTimeframeAlignment >= 55 &&
    d.d7_directionalClarity > d.d8_structuralCleanliness
  ) {
    if (d.d10_activationQuality > 60 && groups.contextBase > 55) return "LONG";
    if (d.d10_activationQuality < 40 && groups.contextBase < 40) return "SHORT";
  }

  return "NEUTRAL";
}

// ─── TrustClass Resolver ─────────────────────────────────────────────────────

function resolveTrustClass(d15: number): TrustClass {
  if (d15 >= 80) return "HIGH_TRUST";
  if (d15 >= 60) return "GOOD_TRUST";
  if (d15 >= 40) return "REDUCED_TRUST";
  if (d15 >= 20) return "LOW_TRUST";
  return "INVALID_RUNTIME";
}

// ─── Maturity Resolver ───────────────────────────────────────────────────────

function resolveMaturity(
  d: Dimensions,
  groups: GroupScores,
  executionPermission: ExecutionPermission,
): Maturity {
  const { contextBase, structuralTruth, executionFeasibility, reliability } =
    groups;

  // Hard cancellation gate
  if (d.d9_multiTimeframeAlignment < 20 || reliability < 20) return "CANCELLED";

  // Determine base maturity from contextBase
  let maturity: Maturity;
  if (contextBase < 25) {
    maturity = "EARLY";
  } else if (contextBase < 40) {
    maturity = "BREWING";
  } else if (contextBase < 55) {
    maturity = "FORMING";
  } else {
    // Active candidate — gate with structural truth
    if (
      structuralTruth >= 68 &&
      executionFeasibility >= 62 &&
      reliability >= 55
    ) {
      if (
        executionPermission === "EXACT_PLAN" ||
        executionPermission === "LIVE_MANAGEMENT"
      ) {
        maturity = "LIVE";
      } else {
        maturity = "READY";
      }
    } else if (structuralTruth >= 62 && executionFeasibility >= 50) {
      maturity = "ARMED";
    } else if (structuralTruth >= 50) {
      maturity = "ACTIVE";
    } else {
      maturity = "FORMING";
    }
  }

  // Decay check: was high maturity but degraded
  if (
    (maturity === "ACTIVE" ||
      maturity === "ARMED" ||
      maturity === "READY" ||
      maturity === "LIVE") &&
    (contextBase < 40 || reliability < 35)
  ) {
    maturity = "DECAY";
  }

  // Hard gates cap maturity
  if (
    d.d15_runtimeTrust < 35 &&
    ["ACTIVE", "ARMED", "READY", "LIVE"].includes(maturity)
  ) {
    maturity = "FORMING";
  }
  if (
    d.d9_multiTimeframeAlignment < 45 &&
    ["ARMED", "READY", "LIVE"].includes(maturity)
  ) {
    maturity = "ACTIVE";
  }

  return maturity;
}

// ─── Execution Permission Resolver ──────────────────────────────────────────

function resolveExecutionPermission(
  d: Dimensions,
  groups: GroupScores,
  direction: Direction,
): ExecutionPermission {
  const { contextBase, structuralTruth, executionFeasibility } = groups;

  if (direction === "NEUTRAL" || contextBase < 30) return "NO_PLAN";
  if (structuralTruth < 50) return "PROJECTED_ONLY";
  if (executionFeasibility < 50) return "PROVISIONAL_PLAN";

  // Check all EXACT_PLAN gates
  const exactGatesMet =
    structuralTruth >= 65 &&
    d.d9_multiTimeframeAlignment >= 58 &&
    d.d11_triggerQuality >= 55 &&
    d.d12_entryCleanliness >= 55 &&
    d.d13_invalidationClarity >= 55 &&
    d.d14_rewardFeasibility >= 55 &&
    d.d15_runtimeTrust >= 55 &&
    d.d16_stateStability >= 55;

  if (exactGatesMet) return "EXACT_PLAN";

  return "PROVISIONAL_PLAN";
}

// ─── Main Blocker Resolver ───────────────────────────────────────────────────

function resolveMainBlocker(
  d: Dimensions,
  groups: GroupScores,
  executionPermission: ExecutionPermission,
): string | null {
  if (d.d15_runtimeTrust < 35)
    return `Runtime trust too low (D15=${d.d15_runtimeTrust.toFixed(0)})`;

  const needsExecution =
    executionPermission === "EXACT_PLAN" ||
    executionPermission === "PROVISIONAL_PLAN";
  if (d.d15_runtimeTrust < 55 && needsExecution) {
    return `Runtime trust insufficient for execution (D15=${d.d15_runtimeTrust.toFixed(0)})`;
  }

  if (d.d9_multiTimeframeAlignment < 45)
    return `MTF alignment insufficient (D9=${d.d9_multiTimeframeAlignment.toFixed(0)})`;
  if (d.d7_directionalClarity < 45)
    return `Directional clarity insufficient (D7=${d.d7_directionalClarity.toFixed(0)})`;
  if (d.d13_invalidationClarity < 55)
    return `Invalidation unclear (D13=${d.d13_invalidationClarity.toFixed(0)})`;
  if (d.d14_rewardFeasibility < 55)
    return `RR not feasible (D14=${d.d14_rewardFeasibility.toFixed(0)})`;
  if (d.d11_triggerQuality < 55)
    return `Trigger quality insufficient (D11=${d.d11_triggerQuality.toFixed(0)})`;
  if (d.d12_entryCleanliness < 55)
    return `Entry not clean enough (D12=${d.d12_entryCleanliness.toFixed(0)})`;
  if (d.d10_activationQuality < 50)
    return `Activation not mature enough (D10=${d.d10_activationQuality.toFixed(0)})`;
  if (groups.structuralTruth < 50) return "Structure insufficient";

  return null;
}

// ─── Operator Priority ───────────────────────────────────────────────────────

function resolveOperatorPriority(
  maturity: Maturity,
  direction: Direction,
  trustClass: TrustClass,
  groups: GroupScores,
  mainBlocker: string | null,
): number {
  const maturityBase: Record<Maturity, number> = {
    EARLY: 5,
    BREWING: 15,
    FORMING: 25,
    ACTIVE: 40,
    ARMED: 60,
    READY: 75,
    LIVE: 85,
    DECAY: 20,
    CANCELLED: 0,
  };

  let priority = maturityBase[maturity];

  // Reliability contribution
  const { reliability, structuralTruth, contextBase } = groups;
  if (reliability > 50) {
    priority += (reliability - 50) * 0.3;
  } else {
    priority -= (50 - reliability) * 0.4;
  }

  // Structural truth bonus
  if (structuralTruth > 50) {
    priority += (structuralTruth - 50) * 0.2;
  }

  // Context base bonus
  if (contextBase > 50) {
    priority += (contextBase - 50) * 0.15;
  }

  // Direction penalty
  if (direction === "NEUTRAL") priority -= 15;

  // Trust penalties
  if (trustClass === "LOW_TRUST") priority -= 20;
  if (trustClass === "INVALID_RUNTIME") priority *= 0.1;

  // Blocker penalty
  if (mainBlocker !== null) priority -= 10;

  return Math.max(0, Math.min(100, Math.round(priority)));
}

// ─── Next Promotion Condition ────────────────────────────────────────────────

function resolveNextPromotionCondition(
  maturity: Maturity,
  groups: GroupScores,
): string | null {
  const { contextBase } = groups;
  switch (maturity) {
    case "EARLY":
      return `ContextBase >= 25 (currently ${contextBase.toFixed(0)})`;
    case "BREWING":
      return `ContextBase >= 40 (currently ${contextBase.toFixed(0)})`;
    case "FORMING":
      return "D9 >= 45 and D10 >= 50 and StructuralTruth >= 50";
    case "ACTIVE":
      return "D11 >= 60 and D12 >= 55 and D13 >= 55 and ExecutionFeasibility >= 50";
    case "ARMED":
      return "StructuralTruth >= 68 and ExecutionFeasibility >= 62 and Reliability >= 55";
    case "READY":
      return "All execution gates met: direction non-NEUTRAL, all key dims >= 55, D15 >= 55";
    case "LIVE":
    case "DECAY":
    case "CANCELLED":
      return null;
    default:
      return null;
  }
}

// ─── Recent Change Meaning ───────────────────────────────────────────────────

function resolveRecentChangeMeaning(
  d: Dimensions,
  groups: GroupScores,
  maturity: Maturity,
  direction: Direction,
  trustClass: TrustClass,
  executionPermission: ExecutionPermission,
  mainBlocker: string | null,
): string {
  if (trustClass === "INVALID_RUNTIME")
    return "Runtime data invalid — all engine outputs unreliable";
  if (maturity === "CANCELLED")
    return "Setup cancelled — structure collapsed or trust too low";
  if (maturity === "DECAY")
    return "Setup decaying — context or reliability deteriorating";

  if (trustClass === "LOW_TRUST")
    return "Runtime degraded — all execution blocked";

  if (executionPermission === "EXACT_PLAN") {
    return "High trust, direction clear — candidate is execution-ready";
  }

  if (groups.contextBase > 65 && groups.structuralTruth < 45) {
    return "Strong accumulation but structure not yet activated";
  }

  if (groups.structuralTruth > 65 && groups.executionFeasibility < 45) {
    return "Structure confirmed but execution gates not met";
  }

  if (d.d13_invalidationClarity < 45) {
    return "Execution gates not met — invalidation too weak";
  }

  if (direction === "NEUTRAL") {
    return "Direction unresolved — awaiting structural clarity";
  }

  if (maturity === "ARMED") {
    return "Setup armed — trigger quality and entry cleanliness needed";
  }

  if (maturity === "ACTIVE") {
    return "Active setup — structure developing, monitoring activation";
  }

  if (groups.contextBase > 60 && mainBlocker) {
    return `Context strong — blocked by: ${mainBlocker}`;
  }

  return "Engine monitoring — dimensional read in progress";
}

// ─── Main Resolver ───────────────────────────────────────────────────────────

export function resolveD16(
  symbol: string,
  dims: Dimensions,
  id?: bigint,
): D16State {
  const groups = calcGroupScores(dims);
  const direction = resolveDirection(dims, groups);
  const trustClass = resolveTrustClass(dims.d15_runtimeTrust);
  const executionPermission = resolveExecutionPermission(
    dims,
    groups,
    direction,
  );
  const maturity = resolveMaturity(dims, groups, executionPermission);
  const mainBlocker = resolveMainBlocker(dims, groups, executionPermission);
  const operatorPriority = resolveOperatorPriority(
    maturity,
    direction,
    trustClass,
    groups,
    mainBlocker,
  );
  const nextPromotionCondition = resolveNextPromotionCondition(
    maturity,
    groups,
  );
  const recentChangeMeaning = resolveRecentChangeMeaning(
    dims,
    groups,
    maturity,
    direction,
    trustClass,
    executionPermission,
    mainBlocker,
  );

  return {
    symbol,
    id,
    dimensions: dims,
    groups,
    canonical: {
      direction,
      maturity,
      trustClass,
      executionPermission,
      operatorPriority,
      mainBlocker,
      nextPromotionCondition,
      recentChangeMeaning,
    },
  };
}

// ─── Utility Functions ───────────────────────────────────────────────────────

export function scoreInterpretation(score: number): string {
  if (score <= 20) return "Very Weak";
  if (score <= 40) return "Weak";
  if (score <= 60) return "Mid / Borderline";
  if (score <= 80) return "Strong";
  return "Very Strong";
}

export function getScoreColor(score: number): string {
  if (score <= 30) return "#EF4444";
  if (score <= 45) return "#F87171";
  if (score <= 60) return "#FACC15";
  if (score <= 75) return "#86EFAC";
  return "#22C55E";
}

export type RankingMode = "structural" | "preRelease" | "execution";

export function rankScenarios(
  states: D16State[],
  mode: RankingMode,
): D16State[] {
  const scored = states.map((s) => {
    let score = 0;
    const { groups, dimensions: d, canonical } = s;
    if (mode === "structural") {
      score =
        groups.structuralTruth * 0.4 +
        groups.contextBase * 0.35 +
        groups.reliability * 0.25;
    } else if (mode === "preRelease") {
      score =
        groups.contextBase * 0.35 +
        groups.structuralTruth * 0.3 +
        d.d10_activationQuality * 0.2 +
        d.d6_releasePotential * 0.15;
    } else {
      score =
        groups.executionFeasibility * 0.45 +
        groups.reliability * 0.35 +
        d.d16_stateStability * 0.2;
    }
    // Tie-break by operatorPriority
    score += canonical.operatorPriority * 0.001;
    return { state: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.state);
}

// ─── Backend ↔ D16 field mapping ────────────────────────────────────────────

import type { Scenario, ScenarioInput } from "./backend";

export function scenarioToDimensions(s: Scenario): Dimensions {
  return {
    d1_macroAccumulation: Number(s.d1_macroAccumulation),
    d2_recentAccumulation: Number(s.d2_macroFlow),
    d3_priceHoldIntegrity: Number(s.d3_microAccumulation),
    d4_compressionQuality: Number(s.d4_microFlow),
    d5_volumePersistence: Number(s.d5_macroSupply),
    d6_releasePotential: Number(s.d6_macroDemand),
    d7_directionalClarity: Number(s.d7_microSupply),
    d8_structuralCleanliness: Number(s.d8_microDemand),
    d9_multiTimeframeAlignment: Number(s.d9_sectorStrength),
    d10_activationQuality: Number(s.d10_sectorWeakness),
    d11_triggerQuality: Number(s.d11_assetStrength),
    d12_entryCleanliness: Number(s.d12_assetWeakness),
    d13_invalidationClarity: Number(s.d13_positionControl),
    d14_rewardFeasibility: Number(s.d14_positionRisk),
    d15_runtimeTrust: Number(s.d15_tradeStability),
    d16_stateStability: Number(s.d16_stateStability),
  };
}

export function dimensionsToScenarioInput(
  symbol: string,
  dims: Dimensions,
): ScenarioInput {
  return {
    symbol,
    d1_macroAccumulation: BigInt(Math.round(dims.d1_macroAccumulation)),
    d2_macroFlow: BigInt(Math.round(dims.d2_recentAccumulation)),
    d3_microAccumulation: BigInt(Math.round(dims.d3_priceHoldIntegrity)),
    d4_microFlow: BigInt(Math.round(dims.d4_compressionQuality)),
    d5_macroSupply: BigInt(Math.round(dims.d5_volumePersistence)),
    d6_macroDemand: BigInt(Math.round(dims.d6_releasePotential)),
    d7_microSupply: BigInt(Math.round(dims.d7_directionalClarity)),
    d8_microDemand: BigInt(Math.round(dims.d8_structuralCleanliness)),
    d9_sectorStrength: BigInt(Math.round(dims.d9_multiTimeframeAlignment)),
    d10_sectorWeakness: BigInt(Math.round(dims.d10_activationQuality)),
    d11_assetStrength: BigInt(Math.round(dims.d11_triggerQuality)),
    d12_assetWeakness: BigInt(Math.round(dims.d12_entryCleanliness)),
    d13_positionControl: BigInt(Math.round(dims.d13_invalidationClarity)),
    d14_positionRisk: BigInt(Math.round(dims.d14_rewardFeasibility)),
    d15_tradeStability: BigInt(Math.round(dims.d15_runtimeTrust)),
    d16_stateStability: BigInt(Math.round(dims.d16_stateStability)),
  };
}
