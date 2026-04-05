// D16 Hybrid Branch — Entry Engine
// Phase H7–H8: Deterministic entry class derivation from hybrid state
// EntryClass is resolver-derived, not manually assigned.

import type {
  CanonicalAssetState,
  EntryClass,
  EntryEngineOutput,
  HybridCorrelationState,
  LeadMarket,
  MarketDirection,
  MarketExecutionPermission,
  MarketMaturity,
  PerMarketState,
} from "./hybridTypes";

// ─── Ordinal helpers (local, mirrors hybridEngine) ───────────────────────────

const MATURITY_RANK: Record<MarketMaturity, number> = {
  EARLY: 1,
  BREWING: 2,
  FORMING: 3,
  ACTIVE: 4,
  ARMED: 5,
  READY: 6,
  LIVE: 7,
  DECAY: 8,
  CANCELLED: 9,
};

const EXEC_RANK: Record<MarketExecutionPermission, number> = {
  NO_PLAN: 0,
  PROJECTED_ONLY: 1,
  PROVISIONAL_PLAN: 2,
  EXACT_PLAN: 3,
  LIVE_MANAGEMENT: 4,
};

const PERMISSION_RANK: Record<string, number> = {
  BLOCKED: 0,
  WATCH_ONLY: 1,
  PROJECTED_ENTRY_ONLY: 2,
  PROVISIONAL_ENTRY_ALLOWED: 3,
  EXACT_ENTRY_ALLOWED: 4,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function majorityDirection(
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
): "LONG" | "SHORT" | "NONE" {
  const dirs: MarketDirection[] = [];
  if (fs) dirs.push(fs.direction);
  if (bs) dirs.push(bs.direction);
  if (cs) dirs.push(cs.direction);
  const longs = dirs.filter((d) => d === "LONG").length;
  const shorts = dirs.filter((d) => d === "SHORT").length;
  if (longs > shorts && longs > 0) return "LONG";
  if (shorts > longs && shorts > 0) return "SHORT";
  if (longs === shorts && longs > 0) {
    // Tie: prefer futures if available and directional
    if (fs?.direction === "LONG") return "LONG";
    if (fs?.direction === "SHORT") return "SHORT";
  }
  return "NONE";
}

function avgExecRank(states: Array<PerMarketState | null>): number {
  const valid = states.filter((s): s is PerMarketState => s !== null);
  if (valid.length === 0) return 0;
  return (
    valid.reduce((sum, s) => sum + EXEC_RANK[s.executionPermission], 0) /
    valid.length
  );
}

function strongestConfirmingMarket(
  side: "LONG" | "SHORT" | "NONE",
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
): EntryEngineOutput["strongestConfirmingMarket"] {
  if (side === "NONE") return "NONE";

  type Candidate = { key: LeadMarket; rank: number };
  const candidates: Candidate[] = [];
  if (fs && fs.direction === side)
    candidates.push({
      key: "BINANCE_FUTURES",
      rank: MATURITY_RANK[fs.maturity],
    });
  if (bs && bs.direction === side)
    candidates.push({ key: "BINANCE_SPOT", rank: MATURITY_RANK[bs.maturity] });
  if (cs && cs.direction === side)
    candidates.push({ key: "COINBASE_SPOT", rank: MATURITY_RANK[cs.maturity] });

  if (candidates.length === 0) return "NONE";

  const maxRank = Math.max(...candidates.map((c) => c.rank));
  const top = candidates.filter((c) => c.rank === maxRank);
  if (top.length > 1) return "MULTI_MARKET";
  return top[0].key as EntryEngineOutput["strongestConfirmingMarket"];
}

function laggingOrBlockingMarket(
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
): EntryEngineOutput["laggingOrBlockingMarket"] {
  // Any INVALID_RUNTIME first
  const invalid: string[] = [];
  if (fs?.trustClass === "INVALID_RUNTIME") invalid.push("BINANCE_FUTURES");
  if (bs?.trustClass === "INVALID_RUNTIME") invalid.push("BINANCE_SPOT");
  if (cs?.trustClass === "INVALID_RUNTIME") invalid.push("COINBASE_SPOT");
  if (invalid.length > 1) return "MULTIPLE";
  if (invalid.length === 1)
    return invalid[0] as EntryEngineOutput["laggingOrBlockingMarket"];

  // Otherwise find lowest maturity rank
  const states: Array<{ key: string; rank: number }> = [];
  if (fs)
    states.push({ key: "BINANCE_FUTURES", rank: MATURITY_RANK[fs.maturity] });
  if (bs)
    states.push({ key: "BINANCE_SPOT", rank: MATURITY_RANK[bs.maturity] });
  if (cs)
    states.push({ key: "COINBASE_SPOT", rank: MATURITY_RANK[cs.maturity] });
  if (states.length === 0) return "NONE";

  const minRank = Math.min(...states.map((s) => s.rank));
  const maxRank = Math.max(...states.map((s) => s.rank));
  if (minRank === maxRank) return "NONE";

  const laggers = states.filter((s) => s.rank === minRank);
  if (laggers.length > 1) return "MULTIPLE";
  return laggers[0].key as EntryEngineOutput["laggingOrBlockingMarket"];
}

// ─── Phase H7+H8: EntryClass Derivation ──────────────────────────────────────
// Full 8-field rule set. First match wins. NOT a simple lookup table.

function deriveEntryClass(
  side: "LONG" | "SHORT" | "NONE",
  correlation: HybridCorrelationState,
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
): EntryClass {
  const {
    directionAgreement,
    maturityAgreement,
    structuralConfirmation,
    divergenceType,
    leadMarket,
    laggingMarket,
    hybridPermission,
    crossMarketConfirmation,
  } = correlation;

  const permRank = PERMISSION_RANK[hybridPermission] ?? 0;

  // ExecutionFeasibilityContext from spot markets
  const spotExecAvg = avgExecRank([bs, cs]);

  // 6. NONE — hard block first (check before any constructive class)
  if (divergenceType === "DIRECTION_CONFLICT" && hybridPermission === "BLOCKED")
    return "NONE";
  if (crossMarketConfirmation < 30) return "NONE";
  if (side === "NONE") return "NONE";

  // 1. REVERSAL — direction conflict resolving, at least one spot now confirms
  // Signal: was previously in conflict but maturityAgreement is now moderate,
  // and at least one spot aligns with the current direction
  const spotConfirms = bs?.direction === side || cs?.direction === side;
  const conflictResolving =
    divergenceType !== "DIRECTION_CONFLICT" &&
    maturityAgreement >= 35 &&
    spotConfirms &&
    permRank >= 1; // WATCH_ONLY+
  // Reversal specifically: structural pattern is a counter-direction recovery
  // Detect by: lead market and spot direction same, previous maturity conflict or AVAX-like pattern
  const fsDir = fs?.direction;
  const reversalPattern =
    conflictResolving &&
    fsDir === side &&
    (divergenceType === "SPOT_WEAKNESS_VS_FUTURES" ||
      divergenceType === "MATURITY_CONFLICT") &&
    spotConfirms;
  if (reversalPattern) return "REVERSAL";

  // 2. BREAKOUT — futures leads, direction agreement high, projected+ permission, no spot weakness
  // Note: divergenceType === "FUTURES_LEADS_SPOT" already excludes SPOT_WEAKNESS_VS_FUTURES
  if (
    divergenceType === "FUTURES_LEADS_SPOT" &&
    directionAgreement >= 70 &&
    permRank >= 2 && // PROJECTED_ENTRY_ONLY+
    maturityAgreement >= 50
  ) {
    return "BREAKOUT";
  }

  // 3. CONTINUATION — all same direction, high maturity agreement, good structural confirmation, provisional+, futures mature trend
  if (
    directionAgreement >= 85 &&
    maturityAgreement >= 70 &&
    structuralConfirmation >= 65 &&
    permRank >= 3 && // PROVISIONAL_ENTRY_ALLOWED+
    leadMarket === "BINANCE_FUTURES"
  ) {
    return "CONTINUATION";
  }

  // 4. RECLAIM — spots confirm futures after gap (spot leads type), maturity agreement moderate
  // Also: spot leads futures pattern with confirmation
  const spotLeadsPattern =
    divergenceType === "SPOT_CONFIRMS_FUTURES" ||
    (divergenceType === "BINANCE_SPOT_LEADS_COINBASE" && spotConfirms) ||
    (divergenceType === "COINBASE_LEADS_BINANCE_SPOT" && spotConfirms);
  // XRP-like: spot leads futures and futures catching up
  const spotLeadsFutures =
    bs &&
    fs &&
    MATURITY_RANK[bs.maturity] > MATURITY_RANK[fs.maturity] &&
    bs.direction === side &&
    maturityAgreement >= 50;
  if ((spotLeadsPattern || spotLeadsFutures) && maturityAgreement >= 50) {
    return "RECLAIM";
  }

  // 5. PULLBACK — strong structure, one spot lagging, watch_only+, moderate maturity
  const oneSpotLagging =
    laggingMarket === "BINANCE_SPOT" || laggingMarket === "COINBASE_SPOT";
  if (
    structuralConfirmation >= 65 &&
    oneSpotLagging &&
    permRank >= 1 && // WATCH_ONLY+
    maturityAgreement >= 40 &&
    maturityAgreement < 70 &&
    spotExecAvg >= 0
  ) {
    return "PULLBACK";
  }

  // Final NONE fallback
  return "NONE";
}

// ─── Reasoning Summary ────────────────────────────────────────────────────────

function buildReasoningSummary(
  side: "LONG" | "SHORT" | "NONE",
  entryClass: EntryClass,
  permissionLevel: EntryEngineOutput["permissionLevel"],
  correlation: HybridCorrelationState,
  asset: string,
): string {
  if (permissionLevel === "EXACT" || permissionLevel === "PROVISIONAL") {
    const classText = entryClass !== "NONE" ? ` ${entryClass}` : "";
    return `All three markets aligned ${side.toLowerCase()} for ${asset} with strong cross-market confirmation (${Math.round(correlation.crossMarketConfirmation)}%).${classText} entry permitted.`;
  }
  if (permissionLevel === "PROJECTED_ONLY") {
    return `${correlation.leadMarket === "BINANCE_FUTURES" ? "Futures are" : "Markets are"} leading ${side.toLowerCase()} for ${asset}, but spot markets are still forming. ${entryClass !== "NONE" ? `${entryClass} class — entry` : "Entry"} is projected-only until spot structure confirms.`;
  }
  if (permissionLevel === "WATCH_ONLY") {
    return `${asset} shows developing ${side.toLowerCase()} structure but cross-market confirmation (${Math.round(correlation.crossMarketConfirmation)}%) is insufficient for entry. Monitoring for confirmation.`;
  }
  if (permissionLevel === "BLOCKED") {
    return correlation.mainBlocker
      ? `Entry blocked for ${asset}: ${correlation.mainBlocker}`
      : `Entry blocked for ${asset} — hybrid conditions not met.`;
  }
  return `No entry class identified for ${asset}. Hybrid conditions not met for directional bias.`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function resolveEntryEngine(
  assetState: CanonicalAssetState,
  correlation: HybridCorrelationState,
): EntryEngineOutput {
  const {
    asset,
    binanceFutures: fs,
    binanceSpot: bs,
    coinbaseSpot: cs,
  } = assetState;
  const {
    hybridPermission,
    crossMarketConfirmation,
    structuralConfirmation,
    trustAgreement,
    maturityAgreement,
  } = correlation;

  // Side: majority direction
  const side = majorityDirection(fs, bs, cs);

  // Permission level mapping
  const permissionLevel: EntryEngineOutput["permissionLevel"] =
    hybridPermission === "BLOCKED"
      ? "BLOCKED"
      : hybridPermission === "WATCH_ONLY"
        ? "WATCH_ONLY"
        : hybridPermission === "PROJECTED_ENTRY_ONLY"
          ? "PROJECTED_ONLY"
          : hybridPermission === "PROVISIONAL_ENTRY_ALLOWED"
            ? "PROVISIONAL"
            : "EXACT";

  const permitted =
    permissionLevel === "PROVISIONAL" || permissionLevel === "EXACT";

  // Entry class
  const entryClass = deriveEntryClass(side, correlation, fs, bs, cs);

  // Score fields
  const confirmationStrength = Math.round(crossMarketConfirmation * 10) / 10;
  const invalidationClarity =
    Math.round((structuralConfirmation * 0.6 + trustAgreement * 0.4) * 10) / 10;
  const spotExecAvg = avgExecRank([bs, cs]);
  const rewardFeasibility =
    Math.round(
      (maturityAgreement * 0.5 + Math.min(100, spotExecAvg * 25) * 0.5) * 10,
    ) / 10;

  const strongestMarket = strongestConfirmingMarket(side, fs, bs, cs);
  const laggingMarket = laggingOrBlockingMarket(fs, bs, cs);

  const reasoningSummary = buildReasoningSummary(
    side,
    entryClass,
    permissionLevel,
    correlation,
    asset,
  );

  return {
    asset,
    permitted,
    side,
    entryClass,
    permissionLevel,
    confirmationStrength,
    invalidationClarity,
    rewardFeasibility,
    mainBlocker: correlation.mainBlocker,
    nextUnlockCondition: correlation.nextUnlockCondition,
    strongestConfirmingMarket: strongestMarket,
    laggingOrBlockingMarket: laggingMarket,
    reasoningSummary,
  };
}
