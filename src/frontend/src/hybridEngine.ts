// D16 Hybrid Branch — Hybrid Correlation Resolver
// Phase H3–H6: State correlation, lead/lag detection, divergence classification, permission model
// All logic is deterministic and explicit. No vague scoring.

import type {
  CanonicalAssetState,
  DivergenceType,
  HybridCorrelationState,
  HybridPermission,
  LeadMarket,
  MarketDirection,
  MarketExecutionPermission,
  MarketMaturity,
  MarketTrustClass,
  PerMarketState,
} from "./hybridTypes";

// ─── Ordinal Rank Tables ─────────────────────────────────────────────────────

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

const TRUST_RANK: Record<MarketTrustClass, number> = {
  HIGH_TRUST: 4,
  GOOD_TRUST: 3,
  REDUCED_TRUST: 2,
  LOW_TRUST: 1,
  INVALID_RUNTIME: 0,
};

const EXEC_RANK: Record<MarketExecutionPermission, number> = {
  NO_PLAN: 0,
  PROJECTED_ONLY: 1,
  PROVISIONAL_PLAN: 2,
  EXACT_PLAN: 3,
  LIVE_MANAGEMENT: 4,
};

// ─── Phase H4: Agreement Logic ───────────────────────────────────────────────

function calcDirectionAgreement(
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
): number {
  const dirs: MarketDirection[] = [];
  if (fs) dirs.push(fs.direction);
  if (bs) dirs.push(bs.direction);
  if (cs) dirs.push(cs.direction);
  if (dirs.length === 0) return 50;

  const longs = dirs.filter((d) => d === "LONG").length;
  const shorts = dirs.filter((d) => d === "SHORT").length;
  const neutrals = dirs.filter((d) => d === "NEUTRAL").length;
  const total = dirs.length;

  // All agree LONG or SHORT → 90–100
  if (longs === total || shorts === total) return 95;

  // Direct conflict: at least one LONG and one SHORT
  if (longs > 0 && shorts > 0) {
    // Two directly opposing → severe penalty
    if (longs === 1 && shorts === 1 && neutrals === 1) return 18;
    // Two vs one opposing
    if (longs >= 2 && shorts >= 1) return 12;
    if (shorts >= 2 && longs >= 1) return 12;
    return 15;
  }

  // Futures + one spot agree, other neutral (2 directional + 1 neutral)
  if (neutrals === 1 && (longs === 2 || shorts === 2)) return 70;

  // One neutral + two directional same
  if (
    neutrals >= 1 &&
    (longs === total - neutrals || shorts === total - neutrals)
  )
    return 52;

  // All neutral
  if (neutrals === total) return 50;

  return 40;
}

function calcMaturityAgreement(
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
): number {
  const ranks: number[] = [];
  if (fs) ranks.push(MATURITY_RANK[fs.maturity]);
  if (bs) ranks.push(MATURITY_RANK[bs.maturity]);
  if (cs) ranks.push(MATURITY_RANK[cs.maturity]);
  if (ranks.length === 0) return 50;
  if (ranks.length === 1) return 80;

  const maxRank = Math.max(...ranks);
  const minRank = Math.min(...ranks);
  const spread = maxRank - minRank;

  // Check for decay vs active conflict (special penalty)
  const hasDecay = ranks.some((r) => r >= 8);
  const hasActive = ranks.some((r) => r <= 5);
  if (hasDecay && hasActive) return 15;

  if (spread <= 1) return 92;
  if (spread === 2) return 72;
  if (spread === 3) return 50;
  if (spread >= 4) return 22;
  return 40;
}

function calcTrustAgreement(
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
  leadMarket: LeadMarket,
): number {
  const states: Array<{ state: PerMarketState; market: LeadMarket }> = [];
  if (fs) states.push({ state: fs, market: "BINANCE_FUTURES" });
  if (bs) states.push({ state: bs, market: "BINANCE_SPOT" });
  if (cs) states.push({ state: cs, market: "COINBASE_SPOT" });
  if (states.length === 0) return 50;

  // Check if leading market has INVALID_RUNTIME → score 0
  const leadState = states.find((s) => s.market === leadMarket);
  if (leadState?.state.trustClass === "INVALID_RUNTIME") return 0;

  // Check for any INVALID_RUNTIME
  const hasInvalid = states.some(
    (s) => s.state.trustClass === "INVALID_RUNTIME",
  );
  if (hasInvalid) return 12;

  const minTrustRank = Math.min(
    ...states.map((s) => TRUST_RANK[s.state.trustClass]),
  );

  // All GOOD_TRUST or better
  if (minTrustRank >= 3) return 88;
  // One REDUCED_TRUST
  if (minTrustRank === 2) return 62;
  // One LOW_TRUST
  if (minTrustRank === 1) return 38;
  return 20;
}

function calcStructuralConfirmation(
  futures: PerMarketState | null,
  binanceSpot: PerMarketState | null,
  coinbaseSpot: PerMarketState | null,
): number {
  if (!futures) return 50;

  const spots: PerMarketState[] = [];
  if (binanceSpot) spots.push(binanceSpot);
  if (coinbaseSpot) spots.push(coinbaseSpot);
  if (spots.length === 0) return 60;

  const futRank = MATURITY_RANK[futures.maturity];
  const futDir = futures.direction;

  // Both spots match futures direction AND maturity within 2 bands → 80–100
  const allMatch = spots.every(
    (s) =>
      s.direction === futDir &&
      Math.abs(MATURITY_RANK[s.maturity] - futRank) <= 2,
  );
  if (allMatch) return 88;

  // One spot matches direction, other neutral
  const matchDir = spots.filter((s) => s.direction === futDir);
  const neutral = spots.filter((s) => s.direction === "NEUTRAL");
  if (matchDir.length === 1 && neutral.length >= 1) return 62;

  // All spots neutral, futures strong (ACTIVE+)
  const allNeutral = spots.every((s) => s.direction === "NEUTRAL");
  if (allNeutral && futRank >= 4) return 42;

  // Spot direction contradicts futures
  const contradicts = spots.some(
    (s) =>
      (futDir === "LONG" && s.direction === "SHORT") ||
      (futDir === "SHORT" && s.direction === "LONG"),
  );
  if (contradicts) return 12;

  return 45;
}

// ─── Phase H5: Lead/Lag Detection ────────────────────────────────────────────

type LeadLagResult = {
  leadMarket: LeadMarket;
  laggingMarket: LeadMarket | "MULTIPLE" | "NONE";
  leadReason: string;
  lagReason: string;
};

function detectLeadLag(
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
): LeadLagResult {
  const markets: Array<{ key: LeadMarket; rank: number; label: string }> = [];
  if (fs)
    markets.push({
      key: "BINANCE_FUTURES",
      rank: MATURITY_RANK[fs.maturity],
      label: `Futures ${fs.maturity}`,
    });
  if (bs)
    markets.push({
      key: "BINANCE_SPOT",
      rank: MATURITY_RANK[bs.maturity],
      label: `Binance Spot ${bs.maturity}`,
    });
  if (cs)
    markets.push({
      key: "COINBASE_SPOT",
      rank: MATURITY_RANK[cs.maturity],
      label: `Coinbase Spot ${cs.maturity}`,
    });

  if (markets.length === 0) {
    return {
      leadMarket: "NONE",
      laggingMarket: "NONE",
      leadReason: "No markets available",
      lagReason: "No markets available",
    };
  }

  if (markets.length === 1) {
    return {
      leadMarket: markets[0].key,
      laggingMarket: "NONE",
      leadReason: `Only ${markets[0].label} is available`,
      lagReason: "No other markets to compare",
    };
  }

  const maxRank = Math.max(...markets.map((m) => m.rank));
  const minRank = Math.min(...markets.map((m) => m.rank));
  const leaders = markets.filter((m) => m.rank === maxRank);
  const laggers = markets.filter(
    (m) => m.rank === minRank && minRank < maxRank,
  );

  let leadMarket: LeadMarket;
  let leadReason: string;
  if (leaders.length === markets.length) {
    // All tied
    leadMarket = "NONE";
    leadReason = `All markets at same maturity rank — ${markets[0].label}`;
  } else if (leaders.length === 1) {
    leadMarket = leaders[0].key;
    leadReason = `${leaders[0].label} is most advanced (rank ${maxRank} vs min ${minRank})`;
  } else {
    // Two leaders tied, one lagger
    leadMarket = leaders[0].key; // Default to first (futures takes precedence)
    leadReason = `${leaders.map((l) => l.label).join(" and ")} tied at rank ${maxRank}`;
  }

  let laggingMarket: LeadMarket | "MULTIPLE" | "NONE";
  let lagReason: string;
  if (leaders.length === markets.length || minRank === maxRank) {
    laggingMarket = "NONE";
    lagReason = "No significant lag detected — markets are aligned";
  } else if (laggers.length === 1) {
    laggingMarket = laggers[0].key;
    lagReason = `${laggers[0].label} lags significantly (rank ${minRank} vs lead ${maxRank})`;
  } else {
    laggingMarket = "MULTIPLE";
    lagReason = `${laggers.map((l) => l.label).join(" and ")} both lagging (rank ${minRank} vs lead ${maxRank})`;
  }

  return { leadMarket, laggingMarket, leadReason, lagReason };
}

// ─── Phase H6: Divergence Classifier ─────────────────────────────────────────
// Checks are applied in priority order — first match wins.

function classifyDivergence(
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
): DivergenceType {
  const fDir = fs?.direction;
  const bDir = bs?.direction;
  const cDir = cs?.direction;
  const fRank = fs ? MATURITY_RANK[fs.maturity] : null;
  const bRank = bs ? MATURITY_RANK[bs.maturity] : null;
  const cRank = cs ? MATURITY_RANK[cs.maturity] : null;

  // 1. DIRECTION_CONFLICT → any two markets have opposite directions
  const dirs = [fDir, bDir, cDir].filter(Boolean) as MarketDirection[];
  const hasLong = dirs.includes("LONG");
  const hasShort = dirs.includes("SHORT");
  if (hasLong && hasShort) return "DIRECTION_CONFLICT";

  // 2. TRUST_CONFLICT → any market INVALID_RUNTIME and lead market is valid
  const hasTrustConflict =
    (fs?.trustClass === "INVALID_RUNTIME" ||
      bs?.trustClass === "INVALID_RUNTIME" ||
      cs?.trustClass === "INVALID_RUNTIME") &&
    !(
      fs?.trustClass === "INVALID_RUNTIME" &&
      bs?.trustClass === "INVALID_RUNTIME" &&
      cs?.trustClass === "INVALID_RUNTIME"
    );
  if (hasTrustConflict) return "TRUST_CONFLICT";

  // Need direction for remaining checks
  const sameDir =
    dirs.length >= 2 &&
    !hasLong !== !hasShort && // Only one direction type present (no conflict already caught)
    dirs
      .filter((d) => d !== "NEUTRAL")
      .every((d) => d === dirs.filter((d2) => d2 !== "NEUTRAL")[0]);

  // 3. FUTURES_OVEREXTENDED → futures maturity ≥ READY and both spots ≤ FORMING and same direction
  if (
    fRank !== null &&
    fRank >= 6 &&
    bRank !== null &&
    bRank <= 3 &&
    cRank !== null &&
    cRank <= 3
  ) {
    if (
      sameDir ||
      (fDir !== "NEUTRAL" && bDir !== "SHORT" && cDir !== "SHORT")
    ) {
      return "FUTURES_OVEREXTENDED";
    }
  }

  // 4. FUTURES_LEADS_SPOT → futures maturity ≥ ACTIVE and both spots ≤ BREWING (same direction)
  if (
    fRank !== null &&
    fRank >= 4 &&
    bRank !== null &&
    bRank <= 2 &&
    cRank !== null &&
    cRank <= 2 &&
    fDir !== "NEUTRAL"
  ) {
    if (bDir === fDir || bDir === "NEUTRAL") {
      return "FUTURES_LEADS_SPOT";
    }
  }
  // Also if futures ACTIVE+ and at least one spot <= BREWING with same direction
  if (fRank !== null && fRank >= 4 && fDir !== "NEUTRAL") {
    const spotRanks = [bRank, cRank].filter((r): r is number => r !== null);
    const maxSpotRank = spotRanks.length > 0 ? Math.max(...spotRanks) : null;
    if (maxSpotRank !== null && maxSpotRank <= 2) {
      return "FUTURES_LEADS_SPOT";
    }
  }

  // 5. MATURITY_CONFLICT → max maturity spread ≥ 4 bands (same direction)
  const allRanks = [fRank, bRank, cRank].filter((r): r is number => r !== null);
  if (allRanks.length >= 2) {
    const spread = Math.max(...allRanks) - Math.min(...allRanks);
    if (spread >= 4) return "MATURITY_CONFLICT";
  }

  // 6. SPOT_WEAKNESS_VS_FUTURES → futures LONG/ACTIVE+ but both spots SHORT or decaying
  if (fRank !== null && fRank >= 4 && fDir === "LONG") {
    const spotsWeak =
      (bDir === "SHORT" || (bRank !== null && bRank >= 8)) &&
      (cDir === "SHORT" || (cRank !== null && cRank >= 8));
    if (spotsWeak) return "SPOT_WEAKNESS_VS_FUTURES";
  }

  // 7. BINANCE_SPOT_LEADS_COINBASE → binanceSpot maturity > coinbaseSpot by ≥ 2 bands AND futures neutral/missing
  if (
    bRank !== null &&
    cRank !== null &&
    bRank - cRank >= 2 &&
    (fDir === "NEUTRAL" || fDir === undefined)
  ) {
    return "BINANCE_SPOT_LEADS_COINBASE";
  }
  // Even if futures not neutral, if binanceSpot leads coinbase significantly
  if (bRank !== null && cRank !== null && bRank - cRank >= 2) {
    return "BINANCE_SPOT_LEADS_COINBASE";
  }

  // 8. COINBASE_LEADS_BINANCE_SPOT → coinbaseSpot maturity > binanceSpot by ≥ 2 bands
  if (cRank !== null && bRank !== null && cRank - bRank >= 2) {
    return "COINBASE_LEADS_BINANCE_SPOT";
  }

  // 9. SPOT_CONFIRMS_FUTURES → spots within 1 maturity band of futures, same direction, no conflict
  if (fRank !== null && bRank !== null && cRank !== null) {
    const bClose = Math.abs(bRank - fRank) <= 1;
    const cClose = Math.abs(cRank - fRank) <= 1;
    const allSameDir = fDir !== "NEUTRAL" && bDir === fDir && cDir === fDir;
    if ((bClose || cClose) && allSameDir) return "SPOT_CONFIRMS_FUTURES";
  }

  // 10. NONE
  return "NONE";
}

// ─── Hybrid Permission Model ──────────────────────────────────────────────────

function computeHybridPermission(
  divergenceType: DivergenceType,
  trustAgreement: number,
  crossMarketConfirmation: number,
  structuralConfirmation: number,
  directionAgreement: number,
  leadMarket: LeadMarket,
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
): HybridPermission {
  // BLOCKED conditions
  if (divergenceType === "DIRECTION_CONFLICT") return "BLOCKED";
  if (trustAgreement < 20) return "BLOCKED";
  // Leading market is INVALID_RUNTIME
  const leadState =
    leadMarket === "BINANCE_FUTURES"
      ? fs
      : leadMarket === "BINANCE_SPOT"
        ? bs
        : leadMarket === "COINBASE_SPOT"
          ? cs
          : null;
  if (leadState?.trustClass === "INVALID_RUNTIME") return "BLOCKED";

  // WATCH_ONLY conditions
  if (crossMarketConfirmation < 40) return "WATCH_ONLY";
  if (divergenceType === "FUTURES_OVEREXTENDED") return "WATCH_ONLY";
  if (divergenceType === "TRUST_CONFLICT") return "WATCH_ONLY";
  if (divergenceType === "MATURITY_CONFLICT") return "WATCH_ONLY";

  // EXACT_ENTRY_ALLOWED
  const hasExactPlan =
    (fs && EXEC_RANK[fs.executionPermission] >= 3) ||
    (bs && EXEC_RANK[bs.executionPermission] >= 3) ||
    (cs && EXEC_RANK[cs.executionPermission] >= 3);
  if (
    crossMarketConfirmation >= 75 &&
    directionAgreement >= 85 &&
    structuralConfirmation >= 70 &&
    hasExactPlan
  ) {
    return "EXACT_ENTRY_ALLOWED";
  }

  // PROVISIONAL_ENTRY_ALLOWED
  const states = [fs, bs, cs].filter((s): s is PerMarketState => s !== null);
  const provisionalCount = states.filter(
    (s) => EXEC_RANK[s.executionPermission] >= 2,
  ).length;
  const noDisqualifyingDivergence = !(
    [
      "DIRECTION_CONFLICT",
      "FUTURES_OVEREXTENDED",
      "TRUST_CONFLICT",
      "SPOT_WEAKNESS_VS_FUTURES",
    ] as DivergenceType[]
  ).includes(divergenceType);
  if (
    crossMarketConfirmation >= 60 &&
    provisionalCount >= 2 &&
    noDisqualifyingDivergence
  ) {
    return "PROVISIONAL_ENTRY_ALLOWED";
  }

  // PROJECTED_ENTRY_ONLY
  const futuresLeads = divergenceType === "FUTURES_LEADS_SPOT";
  const fsHasProjected = fs && EXEC_RANK[fs.executionPermission] >= 1;
  if (
    futuresLeads &&
    crossMarketConfirmation >= 40 &&
    crossMarketConfirmation < 60 &&
    fsHasProjected
  ) {
    return "PROJECTED_ENTRY_ONLY";
  }
  if (crossMarketConfirmation >= 40 && crossMarketConfirmation < 60) {
    return "PROJECTED_ENTRY_ONLY";
  }

  return "WATCH_ONLY";
}

function computeMainBlocker(
  divergenceType: DivergenceType,
  hybridPermission: HybridPermission,
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
  trustAgreement: number,
  crossMarketConfirmation: number,
): string | null {
  if (hybridPermission === "EXACT_ENTRY_ALLOWED") return null;

  if (divergenceType === "DIRECTION_CONFLICT")
    return "Direction conflict between markets — LONG vs SHORT";
  if (divergenceType === "TRUST_CONFLICT") {
    const invalidMarket =
      bs?.trustClass === "INVALID_RUNTIME"
        ? "Binance Spot"
        : cs?.trustClass === "INVALID_RUNTIME"
          ? "Coinbase Spot"
          : fs?.trustClass === "INVALID_RUNTIME"
            ? "Binance Futures"
            : "Unknown";
    return `INVALID_RUNTIME on ${invalidMarket} — trust conflict blocks exact entry`;
  }
  if (divergenceType === "FUTURES_OVEREXTENDED")
    return "Futures overextended — spot markets have not confirmed the move";
  if (divergenceType === "FUTURES_LEADS_SPOT")
    return "Futures leading — spot confirmation required before exact entry";
  if (divergenceType === "MATURITY_CONFLICT")
    return "Maturity conflict — markets at very different development stages";
  if (divergenceType === "SPOT_WEAKNESS_VS_FUTURES")
    return "Spot weakness vs futures — spot not following futures direction";

  if (trustAgreement < 40) return "Insufficient trust agreement across markets";
  if (crossMarketConfirmation < 40)
    return "Cross-market confirmation too weak for entry";
  if (crossMarketConfirmation < 60)
    return "Insufficient cross-market confirmation for provisional entry";
  if (crossMarketConfirmation < 75)
    return "Cross-market confirmation below exact entry threshold";

  // Check individual market blockers
  const blockers = [fs?.mainBlocker, bs?.mainBlocker, cs?.mainBlocker].filter(
    Boolean,
  ) as string[];
  return blockers[0] ?? "Hybrid permission not yet at exact level";
}

function computeNextUnlock(
  hybridPermission: HybridPermission,
  divergenceType: DivergenceType,
  crossMarketConfirmation: number,
  structuralConfirmation: number,
  fs: PerMarketState | null,
  bs: PerMarketState | null,
  cs: PerMarketState | null,
): string | null {
  if (hybridPermission === "EXACT_ENTRY_ALLOWED") return null;

  if (divergenceType === "DIRECTION_CONFLICT")
    return "Resolve direction conflict — all markets must align on same direction";
  if (divergenceType === "TRUST_CONFLICT")
    return "Restore runtime trust on conflicting market — requires data feed recovery";
  if (divergenceType === "FUTURES_OVEREXTENDED")
    return "Spot markets must develop structure and mature to FORMING+ level";
  if (divergenceType === "FUTURES_LEADS_SPOT")
    return "Spot markets must develop to FORMING+ and confirm futures direction";
  if (divergenceType === "MATURITY_CONFLICT")
    return "Lagging markets must mature — close the gap to within 3 bands";

  if (hybridPermission === "BLOCKED")
    return "Resolve blocking condition before any entry is possible";
  if (hybridPermission === "WATCH_ONLY") {
    if (crossMarketConfirmation < 40)
      return "Cross-market confirmation must reach 40+ to unlock projected entry";
    return "All markets must develop toward same maturity band for projected entry";
  }
  if (hybridPermission === "PROJECTED_ENTRY_ONLY") {
    const hasProvisional =
      (bs && EXEC_RANK[bs.executionPermission] >= 2) ||
      (cs && EXEC_RANK[cs.executionPermission] >= 2);
    if (!hasProvisional)
      return "Spot markets must reach PROVISIONAL_PLAN+ execution permission";
    if (crossMarketConfirmation < 60)
      return `Cross-market confirmation must reach 60 (currently ${Math.round(crossMarketConfirmation)})`;
    return "Both spot markets must confirm with PROVISIONAL_PLAN+ for provisional entry";
  }
  if (hybridPermission === "PROVISIONAL_ENTRY_ALLOWED") {
    if (crossMarketConfirmation < 75)
      return `Cross-market confirmation must reach 75 (currently ${Math.round(crossMarketConfirmation)})`;
    if (structuralConfirmation < 70)
      return `Structural confirmation must reach 70 (currently ${Math.round(structuralConfirmation)})`;
    const noExact =
      !fs ||
      !bs ||
      !cs ||
      (EXEC_RANK[fs.executionPermission] < 3 &&
        EXEC_RANK[bs.executionPermission] < 3 &&
        EXEC_RANK[cs.executionPermission] < 3);
    if (noExact)
      return "At least one market must reach EXACT_PLAN execution permission";
    return "All three markets must align at EXACT_PLAN+ to unlock exact entry";
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function resolveHybridCorrelation(
  assetState: CanonicalAssetState,
): HybridCorrelationState {
  const {
    asset,
    binanceFutures: fs,
    binanceSpot: bs,
    coinbaseSpot: cs,
  } = assetState;

  // Phase H5: Lead/Lag
  const { leadMarket, laggingMarket, leadReason, lagReason } = detectLeadLag(
    fs,
    bs,
    cs,
  );

  // Phase H4: Agreement metrics
  const directionAgreement = calcDirectionAgreement(fs, bs, cs);
  const maturityAgreement = calcMaturityAgreement(fs, bs, cs);
  const trustAgreement = calcTrustAgreement(fs, bs, cs, leadMarket);
  const structuralConfirmation = calcStructuralConfirmation(fs, bs, cs);

  // Cross-market composite
  const crossMarketConfirmation =
    directionAgreement * 0.35 +
    maturityAgreement * 0.25 +
    trustAgreement * 0.2 +
    structuralConfirmation * 0.2;

  // Phase H6: Divergence
  const divergenceType = classifyDivergence(fs, bs, cs);

  // Hybrid permission
  const hybridPermission = computeHybridPermission(
    divergenceType,
    trustAgreement,
    crossMarketConfirmation,
    structuralConfirmation,
    directionAgreement,
    leadMarket,
    fs,
    bs,
    cs,
  );

  const mainBlocker = computeMainBlocker(
    divergenceType,
    hybridPermission,
    fs,
    bs,
    cs,
    trustAgreement,
    crossMarketConfirmation,
  );

  const nextUnlockCondition = computeNextUnlock(
    hybridPermission,
    divergenceType,
    crossMarketConfirmation,
    structuralConfirmation,
    fs,
    bs,
    cs,
  );

  return {
    asset,
    directionAgreement: Math.round(directionAgreement * 10) / 10,
    maturityAgreement: Math.round(maturityAgreement * 10) / 10,
    trustAgreement: Math.round(trustAgreement * 10) / 10,
    structuralConfirmation: Math.round(structuralConfirmation * 10) / 10,
    crossMarketConfirmation: Math.round(crossMarketConfirmation * 10) / 10,
    leadMarket,
    laggingMarket,
    divergenceType,
    hybridPermission,
    mainBlocker,
    nextUnlockCondition,
    leadReason,
    lagReason,
  };
}
