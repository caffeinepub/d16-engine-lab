// D16 Hybrid Branch — Hybrid Validation Data
// Phase H10: 11 canonical hybrid validation scenarios
// Each scenario has explicit assetState values and expected outputs.

import { resolveEntryEngine } from "./entryEngine";
import { resolveHybridCorrelation } from "./hybridEngine";
import type {
  CanonicalAssetState,
  DivergenceType,
  EntryEngineOutput,
  HybridCorrelationState,
  HybridPermission,
  HybridValidationScenario,
  LeadMarket,
  PerMarketState,
} from "./hybridTypes";

// ─── Helpers to build PerMarketState ─────────────────────────────────────────

function ms(
  direction: PerMarketState["direction"],
  maturity: PerMarketState["maturity"],
  trustClass: PerMarketState["trustClass"],
  executionPermission: PerMarketState["executionPermission"],
  overrides: Partial<
    Omit<
      PerMarketState,
      "direction" | "maturity" | "trustClass" | "executionPermission"
    >
  > = {},
): PerMarketState {
  return {
    direction,
    maturity,
    trustClass,
    executionPermission,
    structuralScore: overrides.structuralScore ?? 60,
    activationScore: overrides.activationScore ?? 60,
    entryReadiness: overrides.entryReadiness ?? 55,
    runtimeTrust: overrides.runtimeTrust ?? 70,
    mainBlocker: overrides.mainBlocker ?? null,
    updatedAt: 1712275200000,
  };
}

function mkAsset(
  asset: string,
  futures: PerMarketState,
  binanceSpot: PerMarketState,
  coinbaseSpot: PerMarketState,
): CanonicalAssetState {
  return { asset, binanceFutures: futures, binanceSpot, coinbaseSpot };
}

// ─── 11 Canonical Validation Scenarios ───────────────────────────────────────

export const HYBRID_VALIDATION_SCENARIOS: HybridValidationScenario[] = [
  // 1. Futures leads spot — futures ACTIVE/LONG, both spots BREWING/LONG
  {
    id: "hv_futures_leads_spot",
    name: "Futures Leads Spot",
    description:
      "Binance Futures ACTIVE/LONG, both spot markets BREWING/LONG. Classic futures-first setup.",
    assetState: mkAsset(
      "HV-FLS",
      ms("LONG", "ACTIVE", "HIGH_TRUST", "PROJECTED_ONLY", {
        structuralScore: 70,
        activationScore: 72,
        entryReadiness: 55,
        runtimeTrust: 85,
        mainBlocker: "Spot confirmation required",
      }),
      ms("LONG", "BREWING", "GOOD_TRUST", "NO_PLAN", {
        structuralScore: 35,
        activationScore: 28,
        entryReadiness: 20,
        runtimeTrust: 65,
        mainBlocker: "Early stage, no plan",
      }),
      ms("LONG", "BREWING", "GOOD_TRUST", "NO_PLAN", {
        structuralScore: 33,
        activationScore: 26,
        entryReadiness: 18,
        runtimeTrust: 63,
        mainBlocker: "Early stage, no plan",
      }),
    ),
    expected: {
      leadMarket: "BINANCE_FUTURES",
      divergenceType: "FUTURES_LEADS_SPOT",
      hybridPermission: "PROJECTED_ENTRY_ONLY",
      entryPermitted: false,
      mainBlockerContains: "spot",
    },
  },

  // 2. Spot leads futures — binanceSpot ACTIVE, futures FORMING
  {
    id: "hv_spot_leads_futures",
    name: "Spot Leads Futures",
    description:
      "Binance Spot ACTIVE/LONG leads while futures FORMING. Spot-first structure.",
    assetState: mkAsset(
      "HV-SLF",
      ms("LONG", "FORMING", "GOOD_TRUST", "NO_PLAN", {
        structuralScore: 48,
        activationScore: 42,
        entryReadiness: 30,
        runtimeTrust: 65,
        mainBlocker: "Futures lagging spot",
      }),
      ms("LONG", "ACTIVE", "GOOD_TRUST", "PROVISIONAL_PLAN", {
        structuralScore: 68,
        activationScore: 70,
        entryReadiness: 58,
        runtimeTrust: 72,
      }),
      ms("LONG", "ARMED", "HIGH_TRUST", "PROVISIONAL_PLAN", {
        structuralScore: 72,
        activationScore: 74,
        entryReadiness: 65,
        runtimeTrust: 82,
      }),
    ),
    expected: {
      leadMarket: "COINBASE_SPOT",
      divergenceType: "COINBASE_LEADS_BINANCE_SPOT",
      hybridPermission: "PROVISIONAL_ENTRY_ALLOWED",
      entryPermitted: true,
      mainBlockerContains: null,
    },
  },

  // 3. Coinbase confirms Binance — all aligned, spot confirmation
  {
    id: "hv_coinbase_confirms_binance",
    name: "Coinbase Confirms Binance",
    description:
      "Both spot markets ACTIVE/LONG, futures ARMED/LONG — full spot confirmation.",
    assetState: mkAsset(
      "HV-CCB",
      ms("LONG", "ARMED", "HIGH_TRUST", "PROVISIONAL_PLAN", {
        structuralScore: 75,
        activationScore: 78,
        entryReadiness: 68,
        runtimeTrust: 88,
      }),
      ms("LONG", "ACTIVE", "HIGH_TRUST", "PROVISIONAL_PLAN", {
        structuralScore: 70,
        activationScore: 72,
        entryReadiness: 62,
        runtimeTrust: 84,
      }),
      ms("LONG", "ACTIVE", "HIGH_TRUST", "PROVISIONAL_PLAN", {
        structuralScore: 68,
        activationScore: 70,
        entryReadiness: 60,
        runtimeTrust: 82,
      }),
    ),
    expected: {
      leadMarket: "BINANCE_FUTURES",
      divergenceType: "SPOT_CONFIRMS_FUTURES",
      hybridPermission: "PROVISIONAL_ENTRY_ALLOWED",
      entryPermitted: true,
      mainBlockerContains: null,
    },
  },

  // 4. Coinbase contradicts Binance — coinbase SHORT, binanceSpot LONG/ACTIVE
  {
    id: "hv_coinbase_contradicts_binance",
    name: "Coinbase Contradicts Binance",
    description:
      "Coinbase Spot SHORT/FORMING while Binance Spot LONG/ACTIVE — direction conflict.",
    assetState: mkAsset(
      "HV-CCONT",
      ms("LONG", "ACTIVE", "GOOD_TRUST", "PROJECTED_ONLY", {
        structuralScore: 62,
        activationScore: 65,
        entryReadiness: 52,
        runtimeTrust: 72,
        mainBlocker: "Coinbase direction conflict",
      }),
      ms("LONG", "ACTIVE", "GOOD_TRUST", "PROVISIONAL_PLAN", {
        structuralScore: 65,
        activationScore: 68,
        entryReadiness: 55,
        runtimeTrust: 70,
      }),
      ms("SHORT", "FORMING", "GOOD_TRUST", "NO_PLAN", {
        structuralScore: 42,
        activationScore: 38,
        entryReadiness: 28,
        runtimeTrust: 62,
        mainBlocker: "Opposing direction",
      }),
    ),
    expected: {
      leadMarket: "BINANCE_FUTURES",
      divergenceType: "DIRECTION_CONFLICT",
      hybridPermission: "BLOCKED",
      entryPermitted: false,
      mainBlockerContains: "conflict",
    },
  },

  // 5. Futures overextended — futures READY, spots EARLY with reduced trust
  {
    id: "hv_futures_overextended",
    name: "Futures Overextended",
    description:
      "Futures READY/LONG while both spots EARLY/LONG with reduced trust. Overextension pattern.",
    assetState: mkAsset(
      "HV-FOVER",
      ms("LONG", "READY", "GOOD_TRUST", "PROVISIONAL_PLAN", {
        structuralScore: 70,
        activationScore: 72,
        entryReadiness: 65,
        runtimeTrust: 72,
        mainBlocker: "Spot markets not confirming",
      }),
      ms("LONG", "EARLY", "REDUCED_TRUST", "NO_PLAN", {
        structuralScore: 18,
        activationScore: 12,
        entryReadiness: 8,
        runtimeTrust: 35,
        mainBlocker: "Very early, reduced trust",
      }),
      ms("LONG", "EARLY", "REDUCED_TRUST", "NO_PLAN", {
        structuralScore: 15,
        activationScore: 10,
        entryReadiness: 5,
        runtimeTrust: 32,
        mainBlocker: "Very early, insufficient structure",
      }),
    ),
    expected: {
      leadMarket: "BINANCE_FUTURES",
      divergenceType: "FUTURES_OVEREXTENDED",
      hybridPermission: "WATCH_ONLY",
      entryPermitted: false,
      mainBlockerContains: "overextended",
    },
  },

  // 6. One market invalid runtime — futures INVALID_RUNTIME, spots valid LONG
  {
    id: "hv_one_market_invalid",
    name: "One Market Invalid Runtime",
    description:
      "Binance Futures has INVALID_RUNTIME while spot markets are valid and LONG.",
    assetState: mkAsset(
      "HV-INVALID",
      ms("LONG", "ACTIVE", "INVALID_RUNTIME", "NO_PLAN", {
        structuralScore: 50,
        activationScore: 48,
        entryReadiness: 20,
        runtimeTrust: 8,
        mainBlocker: "INVALID_RUNTIME: data feed down",
      }),
      ms("LONG", "ACTIVE", "GOOD_TRUST", "PROVISIONAL_PLAN", {
        structuralScore: 68,
        activationScore: 70,
        entryReadiness: 58,
        runtimeTrust: 72,
      }),
      ms("LONG", "ARMED", "GOOD_TRUST", "PROVISIONAL_PLAN", {
        structuralScore: 72,
        activationScore: 74,
        entryReadiness: 62,
        runtimeTrust: 75,
      }),
    ),
    expected: {
      leadMarket: "COINBASE_SPOT",
      divergenceType: "TRUST_CONFLICT",
      hybridPermission: "WATCH_ONLY",
      entryPermitted: false,
      mainBlockerContains: "INVALID_RUNTIME",
    },
  },

  // 7. Full three-market alignment — all LONG/READY/HIGH_TRUST/EXACT_PLAN
  {
    id: "hv_full_alignment",
    name: "Full Three-Market Alignment",
    description:
      "All three markets LONG/READY/HIGH_TRUST/EXACT_PLAN — maximum alignment.",
    assetState: mkAsset(
      "HV-ALIGN",
      ms("LONG", "READY", "HIGH_TRUST", "EXACT_PLAN", {
        structuralScore: 88,
        activationScore: 90,
        entryReadiness: 85,
        runtimeTrust: 92,
      }),
      ms("LONG", "READY", "HIGH_TRUST", "EXACT_PLAN", {
        structuralScore: 85,
        activationScore: 87,
        entryReadiness: 82,
        runtimeTrust: 90,
      }),
      ms("LONG", "READY", "HIGH_TRUST", "EXACT_PLAN", {
        structuralScore: 83,
        activationScore: 85,
        entryReadiness: 80,
        runtimeTrust: 88,
      }),
    ),
    expected: {
      leadMarket: "NONE",
      divergenceType: "NONE",
      hybridPermission: "EXACT_ENTRY_ALLOWED",
      entryPermitted: true,
      mainBlockerContains: null,
    },
  },

  // 8. False futures breakout — futures LONG/ACTIVE, both spots SHORT/FORMING
  {
    id: "hv_false_futures_breakout",
    name: "False Futures Breakout",
    description:
      "Futures LONG/ACTIVE but both spot markets SHORT/FORMING — false breakout, direction conflict.",
    assetState: mkAsset(
      "HV-FFB",
      ms("LONG", "ACTIVE", "GOOD_TRUST", "PROJECTED_ONLY", {
        structuralScore: 60,
        activationScore: 62,
        entryReadiness: 50,
        runtimeTrust: 70,
        mainBlocker: "Spot markets contradicting futures",
      }),
      ms("SHORT", "FORMING", "GOOD_TRUST", "NO_PLAN", {
        structuralScore: 40,
        activationScore: 35,
        entryReadiness: 25,
        runtimeTrust: 62,
        mainBlocker: "Opposite direction to futures",
      }),
      ms("SHORT", "FORMING", "REDUCED_TRUST", "NO_PLAN", {
        structuralScore: 35,
        activationScore: 30,
        entryReadiness: 20,
        runtimeTrust: 45,
        mainBlocker: "Opposite direction, reduced trust",
      }),
    ),
    expected: {
      leadMarket: "BINANCE_FUTURES",
      divergenceType: "DIRECTION_CONFLICT",
      hybridPermission: "BLOCKED",
      entryPermitted: false,
      mainBlockerContains: "conflict",
    },
  },

  // 9. Exact entry allowed — all aligned, exact plan, high trust
  {
    id: "hv_exact_entry_allowed",
    name: "Exact Entry Allowed",
    description: "Strong three-market alignment — exact entry unlocked.",
    assetState: mkAsset(
      "HV-EXACT",
      ms("LONG", "LIVE", "HIGH_TRUST", "EXACT_PLAN", {
        structuralScore: 90,
        activationScore: 92,
        entryReadiness: 88,
        runtimeTrust: 94,
      }),
      ms("LONG", "READY", "HIGH_TRUST", "EXACT_PLAN", {
        structuralScore: 86,
        activationScore: 88,
        entryReadiness: 84,
        runtimeTrust: 91,
      }),
      ms("LONG", "READY", "HIGH_TRUST", "PROVISIONAL_PLAN", {
        structuralScore: 82,
        activationScore: 84,
        entryReadiness: 80,
        runtimeTrust: 89,
      }),
    ),
    expected: {
      leadMarket: "BINANCE_FUTURES",
      divergenceType: "NONE",
      hybridPermission: "EXACT_ENTRY_ALLOWED",
      entryPermitted: true,
      mainBlockerContains: null,
    },
  },

  // 10. Projected only — futures leads, spot forming
  {
    id: "hv_projected_only",
    name: "Projected Entry Only",
    description:
      "Futures leads, spot still forming — projected-only state, no exact entry.",
    assetState: mkAsset(
      "HV-PROJ",
      ms("LONG", "ACTIVE", "HIGH_TRUST", "PROJECTED_ONLY", {
        structuralScore: 65,
        activationScore: 68,
        entryReadiness: 52,
        runtimeTrust: 82,
        mainBlocker: "Spot markets not ready",
      }),
      ms("LONG", "BREWING", "GOOD_TRUST", "NO_PLAN", {
        structuralScore: 32,
        activationScore: 26,
        entryReadiness: 18,
        runtimeTrust: 64,
        mainBlocker: "Still brewing",
      }),
      ms("LONG", "BREWING", "GOOD_TRUST", "NO_PLAN", {
        structuralScore: 30,
        activationScore: 24,
        entryReadiness: 16,
        runtimeTrust: 62,
        mainBlocker: "Still brewing",
      }),
    ),
    expected: {
      leadMarket: "BINANCE_FUTURES",
      divergenceType: "FUTURES_LEADS_SPOT",
      hybridPermission: "PROJECTED_ENTRY_ONLY",
      entryPermitted: false,
      mainBlockerContains: "spot",
    },
  },

  // 11. Blocked — direction conflict, low trust
  {
    id: "hv_blocked",
    name: "Blocked — Direction Conflict + Low Trust",
    description: "Direction conflict combined with low trust — fully blocked.",
    assetState: mkAsset(
      "HV-BLOCK",
      ms("SHORT", "ACTIVE", "LOW_TRUST", "NO_PLAN", {
        structuralScore: 40,
        activationScore: 38,
        entryReadiness: 22,
        runtimeTrust: 22,
        mainBlocker: "Low trust, direction conflict",
      }),
      ms("LONG", "FORMING", "REDUCED_TRUST", "NO_PLAN", {
        structuralScore: 35,
        activationScore: 30,
        entryReadiness: 18,
        runtimeTrust: 38,
        mainBlocker: "Reduced trust, opposing direction",
      }),
      ms("LONG", "BREWING", "LOW_TRUST", "NO_PLAN", {
        structuralScore: 25,
        activationScore: 20,
        entryReadiness: 12,
        runtimeTrust: 20,
        mainBlocker: "Low trust, very early",
      }),
    ),
    expected: {
      leadMarket: "BINANCE_FUTURES",
      divergenceType: "DIRECTION_CONFLICT",
      hybridPermission: "BLOCKED",
      entryPermitted: false,
      mainBlockerContains: "conflict",
    },
  },
];

// ─── Validation Result Types ──────────────────────────────────────────────────

export type HybridValidationResult = {
  scenario: HybridValidationScenario;
  actualCorrelation: HybridCorrelationState;
  actualEntry: EntryEngineOutput;
  fieldResults: {
    field: string;
    expected: string;
    actual: string;
    pass: boolean;
  }[];
  overallPass: boolean;
};

// ─── Runner ───────────────────────────────────────────────────────────────────

export function runHybridValidation(): HybridValidationResult[] {
  return HYBRID_VALIDATION_SCENARIOS.map((scenario) => {
    const actualCorrelation = resolveHybridCorrelation(scenario.assetState);
    const actualEntry = resolveEntryEngine(
      scenario.assetState,
      actualCorrelation,
    );

    const fieldResults: HybridValidationResult["fieldResults"] = [
      {
        field: "leadMarket",
        expected: scenario.expected.leadMarket,
        actual: actualCorrelation.leadMarket,
        pass: actualCorrelation.leadMarket === scenario.expected.leadMarket,
      },
      {
        field: "divergenceType",
        expected: scenario.expected.divergenceType,
        actual: actualCorrelation.divergenceType,
        pass:
          actualCorrelation.divergenceType === scenario.expected.divergenceType,
      },
      {
        field: "hybridPermission",
        expected: scenario.expected.hybridPermission,
        actual: actualCorrelation.hybridPermission,
        pass:
          actualCorrelation.hybridPermission ===
          scenario.expected.hybridPermission,
      },
      {
        field: "entryPermitted",
        expected: String(scenario.expected.entryPermitted),
        actual: String(actualEntry.permitted),
        pass: actualEntry.permitted === scenario.expected.entryPermitted,
      },
      {
        field: "mainBlocker",
        expected: scenario.expected.mainBlockerContains ?? "(none)",
        actual: actualCorrelation.mainBlocker ?? "(none)",
        pass:
          scenario.expected.mainBlockerContains === null
            ? actualCorrelation.mainBlocker === null
            : (actualCorrelation.mainBlocker ?? "")
                .toLowerCase()
                .includes(scenario.expected.mainBlockerContains.toLowerCase()),
      },
    ];

    const overallPass = fieldResults.every((r) => r.pass);

    return {
      scenario,
      actualCorrelation,
      actualEntry,
      fieldResults,
      overallPass,
    };
  });
}
