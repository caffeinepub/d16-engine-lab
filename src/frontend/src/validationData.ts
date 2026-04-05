// D16 Phase 3 — Validation Harness Data & Types
// All validation state, stress-test scenarios, and expected outputs

import { resolveD16 } from "./d16Engine";
import type {
  Dimensions,
  Direction,
  ExecutionPermission,
  Maturity,
  TrustClass,
} from "./d16Engine";
import { PRESET_SCENARIOS } from "./mockData";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StressTestScenario = {
  id: string;
  name: string;
  description: string;
  dims: Dimensions;
  tags: string[];
};

export type ExpectedOutputs = {
  direction: Direction;
  maturity: Maturity;
  trustClass: TrustClass;
  executionPermission: ExecutionPermission;
  mainBlocker: string | null;
};

export type ValidationResult = {
  scenarioName: string;
  expected: ExpectedOutputs;
  actual: {
    direction: Direction;
    maturity: Maturity;
    trustClass: TrustClass;
    executionPermission: ExecutionPermission;
    mainBlocker: string | null;
  };
  pass: boolean;
  mismatches: string[];
};

export type AuditEntry = {
  id: string;
  timestamp: string;
  source: "editor" | "run";
  scenarioName: string;
  prevState: {
    maturity: Maturity;
    direction: Direction;
    executionPermission: ExecutionPermission;
    trustClass: TrustClass;
    operatorPriority: number;
    contextBase: number;
    structuralTruth: number;
    executionFeasibility: number;
    reliability: number;
    mainBlocker: string | null;
  };
  currState: {
    maturity: Maturity;
    direction: Direction;
    executionPermission: ExecutionPermission;
    trustClass: TrustClass;
    operatorPriority: number;
    contextBase: number;
    structuralTruth: number;
    executionFeasibility: number;
    reliability: number;
    mainBlocker: string | null;
  };
  changedDims: { key: string; label: string; prev: number; curr: number }[];
  changedGroups: { key: string; prev: number; curr: number }[];
  changedOutputs: {
    field: string;
    prev: string | number | null;
    curr: string | number | null;
  }[];
  triggerExplanation: string;
};

export type UserScenario = {
  id: string;
  name: string;
  sourceId: string;
  dims: Dimensions;
  createdAt: string;
};

// ─── Stress-Test Scenarios ────────────────────────────────────────────────────

export const STRESS_TEST_SCENARIOS: StressTestScenario[] = [
  {
    id: "st_high_ctx_low_rel",
    name: "High Context / Low Reliability",
    description:
      "Strong accumulation base, degraded runtime trust and state stability",
    tags: ["context", "reliability", "degraded"],
    dims: {
      d1_macroAccumulation: 88,
      d2_recentAccumulation: 82,
      d3_priceHoldIntegrity: 85,
      d4_compressionQuality: 80,
      d5_volumePersistence: 78,
      d6_releasePotential: 90,
      d7_directionalClarity: 62,
      d8_structuralCleanliness: 58,
      d9_multiTimeframeAlignment: 60,
      d10_activationQuality: 65,
      d11_triggerQuality: 55,
      d12_entryCleanliness: 52,
      d13_invalidationClarity: 58,
      d14_rewardFeasibility: 60,
      d15_runtimeTrust: 18,
      d16_stateStability: 15,
    },
  },
  {
    id: "st_strong_trigger_weak_structure",
    name: "Strong Trigger / Weak Structure",
    description:
      "Execution quality high, structural truth and MTF alignment poor",
    tags: ["trigger", "structure", "execution"],
    dims: {
      d1_macroAccumulation: 55,
      d2_recentAccumulation: 52,
      d3_priceHoldIntegrity: 50,
      d4_compressionQuality: 48,
      d5_volumePersistence: 50,
      d6_releasePotential: 55,
      d7_directionalClarity: 38,
      d8_structuralCleanliness: 35,
      d9_multiTimeframeAlignment: 32,
      d10_activationQuality: 30,
      d11_triggerQuality: 88,
      d12_entryCleanliness: 85,
      d13_invalidationClarity: 82,
      d14_rewardFeasibility: 80,
      d15_runtimeTrust: 72,
      d16_stateStability: 68,
    },
  },
  {
    id: "st_strong_structure_weak_invalidation",
    name: "Strong Structure / Weak Invalidation",
    description:
      "Structure and directional clarity confirmed, but invalidation logic is absent",
    tags: ["structure", "invalidation", "execution-gate"],
    dims: {
      d1_macroAccumulation: 72,
      d2_recentAccumulation: 68,
      d3_priceHoldIntegrity: 70,
      d4_compressionQuality: 65,
      d5_volumePersistence: 67,
      d6_releasePotential: 72,
      d7_directionalClarity: 82,
      d8_structuralCleanliness: 78,
      d9_multiTimeframeAlignment: 85,
      d10_activationQuality: 75,
      d11_triggerQuality: 70,
      d12_entryCleanliness: 72,
      d13_invalidationClarity: 18,
      d14_rewardFeasibility: 22,
      d15_runtimeTrust: 75,
      d16_stateStability: 72,
    },
  },
  {
    id: "st_conflicting_directional",
    name: "Conflicting Directional Dims",
    description:
      "Strong odd dimensions, weak even dimensions — alternating conflict",
    tags: ["conflicting", "directional", "unstable"],
    dims: {
      d1_macroAccumulation: 80,
      d2_recentAccumulation: 22,
      d3_priceHoldIntegrity: 78,
      d4_compressionQuality: 20,
      d5_volumePersistence: 76,
      d6_releasePotential: 25,
      d7_directionalClarity: 75,
      d8_structuralCleanliness: 22,
      d9_multiTimeframeAlignment: 72,
      d10_activationQuality: 20,
      d11_triggerQuality: 70,
      d12_entryCleanliness: 18,
      d13_invalidationClarity: 68,
      d14_rewardFeasibility: 20,
      d15_runtimeTrust: 65,
      d16_stateStability: 25,
    },
  },
  {
    id: "st_unstable_runtime",
    name: "Unstable Runtime",
    description:
      "All dimensions moderate, runtime and state stability critically low",
    tags: ["runtime", "stability", "degraded"],
    dims: {
      d1_macroAccumulation: 55,
      d2_recentAccumulation: 52,
      d3_priceHoldIntegrity: 58,
      d4_compressionQuality: 54,
      d5_volumePersistence: 56,
      d6_releasePotential: 55,
      d7_directionalClarity: 60,
      d8_structuralCleanliness: 58,
      d9_multiTimeframeAlignment: 62,
      d10_activationQuality: 60,
      d11_triggerQuality: 57,
      d12_entryCleanliness: 55,
      d13_invalidationClarity: 59,
      d14_rewardFeasibility: 56,
      d15_runtimeTrust: 12,
      d16_stateStability: 8,
    },
  },
  {
    id: "st_near_threshold",
    name: "Near-Threshold Case",
    description:
      "Most dims within ±3 of key thresholds — borderline everywhere",
    tags: ["threshold", "boundary", "borderline"],
    dims: {
      d1_macroAccumulation: 53,
      d2_recentAccumulation: 52,
      d3_priceHoldIntegrity: 54,
      d4_compressionQuality: 51,
      d5_volumePersistence: 53,
      d6_releasePotential: 52,
      d7_directionalClarity: 57,
      d8_structuralCleanliness: 54,
      d9_multiTimeframeAlignment: 56,
      d10_activationQuality: 53,
      d11_triggerQuality: 56,
      d12_entryCleanliness: 57,
      d13_invalidationClarity: 54,
      d14_rewardFeasibility: 56,
      d15_runtimeTrust: 57,
      d16_stateStability: 58,
    },
  },
  {
    id: "st_promotion_boundary",
    name: "Promotion Boundary Case",
    description:
      "One dimension below threshold for READY/LIVE promotion — tests exact gate",
    tags: ["promotion", "boundary", "maturity"],
    dims: {
      d1_macroAccumulation: 82,
      d2_recentAccumulation: 78,
      d3_priceHoldIntegrity: 80,
      d4_compressionQuality: 75,
      d5_volumePersistence: 77,
      d6_releasePotential: 80,
      d7_directionalClarity: 75,
      d8_structuralCleanliness: 70,
      d9_multiTimeframeAlignment: 72,
      d10_activationQuality: 68,
      d11_triggerQuality: 65,
      d12_entryCleanliness: 67,
      d13_invalidationClarity: 63,
      d14_rewardFeasibility: 64,
      d15_runtimeTrust: 54,
      d16_stateStability: 68,
    },
  },
  {
    id: "st_degradation_boundary",
    name: "Degradation Boundary Case",
    description:
      "Context and reliability at the decay boundary — tests DECAY trigger",
    tags: ["degradation", "decay", "boundary"],
    dims: {
      d1_macroAccumulation: 62,
      d2_recentAccumulation: 58,
      d3_priceHoldIntegrity: 60,
      d4_compressionQuality: 55,
      d5_volumePersistence: 58,
      d6_releasePotential: 60,
      d7_directionalClarity: 68,
      d8_structuralCleanliness: 65,
      d9_multiTimeframeAlignment: 70,
      d10_activationQuality: 66,
      d11_triggerQuality: 62,
      d12_entryCleanliness: 60,
      d13_invalidationClarity: 65,
      d14_rewardFeasibility: 62,
      d15_runtimeTrust: 38,
      d16_stateStability: 32,
    },
  },
];

// ─── Preset Expected Outputs ──────────────────────────────────────────────────
// Computed by running the resolver against each preset — all start as PASS

function buildPresetExpected(): Record<string, ExpectedOutputs> {
  const result: Record<string, ExpectedOutputs> = {};
  for (const p of PRESET_SCENARIOS) {
    const state = resolveD16(p.name, p.dims);
    result[p.name] = {
      direction: state.canonical.direction,
      maturity: state.canonical.maturity,
      trustClass: state.canonical.trustClass,
      executionPermission: state.canonical.executionPermission,
      mainBlocker: state.canonical.mainBlocker,
    };
  }
  return result;
}

export const PRESET_EXPECTED_OUTPUTS = buildPresetExpected();

// ─── Hard Gate Definitions (mirroring d16Engine.ts) ──────────────────────────
// These are read-only mirror constants for the Threshold Debug view

export type HardGateCheck = {
  id: string;
  label: string;
  description: string;
  dimKey: keyof Dimensions | null;
  groupKey: string | null;
  threshold: number;
  operator: ">=" | ">" | "<=";
};

export const HARD_GATES: HardGateCheck[] = [
  {
    id: "d15_min_trust",
    label: "Runtime Trust — Minimum",
    description: "D15 must be >= 35 or maturity is capped at FORMING",
    dimKey: "d15_runtimeTrust",
    groupKey: null,
    threshold: 35,
    operator: ">=",
  },
  {
    id: "d15_exec_trust",
    label: "Runtime Trust — Execution",
    description: "D15 must be >= 55 for execution plans (EXACT_PLAN)",
    dimKey: "d15_runtimeTrust",
    groupKey: null,
    threshold: 55,
    operator: ">=",
  },
  {
    id: "d9_direction",
    label: "MTF Alignment — Direction",
    description: "D9 must be >= 45 to resolve direction (not NEUTRAL)",
    dimKey: "d9_multiTimeframeAlignment",
    groupKey: null,
    threshold: 45,
    operator: ">=",
  },
  {
    id: "d7_direction",
    label: "Directional Clarity — Direction",
    description: "D7 must be >= 45 to resolve direction (not NEUTRAL)",
    dimKey: "d7_directionalClarity",
    groupKey: null,
    threshold: 45,
    operator: ">=",
  },
  {
    id: "d13_exec",
    label: "Invalidation Clarity — Execution",
    description: "D13 must be >= 55 for any execution plan",
    dimKey: "d13_invalidationClarity",
    groupKey: null,
    threshold: 55,
    operator: ">=",
  },
  {
    id: "d14_exec",
    label: "Reward Feasibility — Execution",
    description: "D14 must be >= 55 for EXACT_PLAN",
    dimKey: "d14_rewardFeasibility",
    groupKey: null,
    threshold: 55,
    operator: ">=",
  },
  {
    id: "d11_exec",
    label: "Trigger Quality — Execution",
    description: "D11 must be >= 55 for EXACT_PLAN",
    dimKey: "d11_triggerQuality",
    groupKey: null,
    threshold: 55,
    operator: ">=",
  },
  {
    id: "d12_exec",
    label: "Entry Cleanliness — Execution",
    description: "D12 must be >= 55 for EXACT_PLAN",
    dimKey: "d12_entryCleanliness",
    groupKey: null,
    threshold: 55,
    operator: ">=",
  },
  {
    id: "d9_exact",
    label: "MTF Alignment — EXACT_PLAN",
    description: "D9 must be >= 58 for EXACT_PLAN",
    dimKey: "d9_multiTimeframeAlignment",
    groupKey: null,
    threshold: 58,
    operator: ">=",
  },
  {
    id: "d16_exact",
    label: "State Stability — EXACT_PLAN",
    description: "D16 must be >= 55 for EXACT_PLAN",
    dimKey: "d16_stateStability",
    groupKey: null,
    threshold: 55,
    operator: ">=",
  },
  {
    id: "ctx_direction",
    label: "ContextBase — Direction",
    description: "ContextBase must be >= 30 for non-NEUTRAL direction",
    dimKey: null,
    groupKey: "contextBase",
    threshold: 30,
    operator: ">=",
  },
  {
    id: "str_exact",
    label: "StructuralTruth — EXACT_PLAN",
    description: "StructuralTruth must be >= 65 for EXACT_PLAN",
    dimKey: null,
    groupKey: "structuralTruth",
    threshold: 65,
    operator: ">=",
  },
  {
    id: "exec_exact",
    label: "ExecutionFeasibility — EXACT_PLAN",
    description: "ExecutionFeasibility must be >= 50 for EXACT_PLAN",
    dimKey: null,
    groupKey: "executionFeasibility",
    threshold: 50,
    operator: ">=",
  },
];
