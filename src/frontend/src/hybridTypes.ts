// D16 Hybrid Branch — Canonical Type Definitions
// Phase H0: Doctrine Lock — All types are canonical and non-negotiable.

export type MarketDirection = "LONG" | "SHORT" | "NEUTRAL";

export type MarketMaturity =
  | "EARLY"
  | "BREWING"
  | "FORMING"
  | "ACTIVE"
  | "ARMED"
  | "READY"
  | "LIVE"
  | "DECAY"
  | "CANCELLED";

export type MarketTrustClass =
  | "HIGH_TRUST"
  | "GOOD_TRUST"
  | "REDUCED_TRUST"
  | "LOW_TRUST"
  | "INVALID_RUNTIME";

export type MarketExecutionPermission =
  | "NO_PLAN"
  | "PROJECTED_ONLY"
  | "PROVISIONAL_PLAN"
  | "EXACT_PLAN"
  | "LIVE_MANAGEMENT";

export type PerMarketState = {
  direction: MarketDirection;
  maturity: MarketMaturity;
  trustClass: MarketTrustClass;
  executionPermission: MarketExecutionPermission;
  structuralScore: number; // 0–100
  activationScore: number; // 0–100
  entryReadiness: number; // 0–100
  runtimeTrust: number; // 0–100
  mainBlocker: string | null;
  updatedAt: number;
};

export type CanonicalAssetMarkets = {
  asset: string;
  binanceSpotSymbol: string | null;
  coinbaseSpotProduct: string | null;
  binanceFuturesSymbol: string | null;
  availability: {
    binanceSpot: boolean;
    coinbaseSpot: boolean;
    binanceFutures: boolean;
  };
};

export type CanonicalAssetState = {
  asset: string;
  binanceSpot: PerMarketState | null;
  coinbaseSpot: PerMarketState | null;
  binanceFutures: PerMarketState | null;
};

export type LeadMarket =
  | "BINANCE_SPOT"
  | "COINBASE_SPOT"
  | "BINANCE_FUTURES"
  | "NONE";

export type DivergenceType =
  | "NONE"
  | "FUTURES_LEADS_SPOT"
  | "BINANCE_SPOT_LEADS_COINBASE"
  | "COINBASE_LEADS_BINANCE_SPOT"
  | "SPOT_CONFIRMS_FUTURES"
  | "FUTURES_OVEREXTENDED"
  | "SPOT_WEAKNESS_VS_FUTURES"
  | "DIRECTION_CONFLICT"
  | "TRUST_CONFLICT"
  | "MATURITY_CONFLICT";

export type HybridPermission =
  | "BLOCKED"
  | "WATCH_ONLY"
  | "PROJECTED_ENTRY_ONLY"
  | "PROVISIONAL_ENTRY_ALLOWED"
  | "EXACT_ENTRY_ALLOWED";

export type HybridCorrelationState = {
  asset: string;
  directionAgreement: number; // 0–100
  maturityAgreement: number; // 0–100
  trustAgreement: number; // 0–100
  structuralConfirmation: number; // 0–100
  crossMarketConfirmation: number; // 0–100 (composite)
  leadMarket: LeadMarket;
  laggingMarket: LeadMarket | "MULTIPLE" | "NONE";
  divergenceType: DivergenceType;
  hybridPermission: HybridPermission;
  mainBlocker: string | null;
  nextUnlockCondition: string | null;
  leadReason: string;
  lagReason: string;
};

export type EntryClass =
  | "NONE"
  | "BREAKOUT"
  | "RECLAIM"
  | "PULLBACK"
  | "CONTINUATION"
  | "REVERSAL";

export type EntryEngineOutput = {
  asset: string;
  permitted: boolean;
  side: "LONG" | "SHORT" | "NONE";
  entryClass: EntryClass;
  permissionLevel:
    | "BLOCKED"
    | "WATCH_ONLY"
    | "PROJECTED_ONLY"
    | "PROVISIONAL"
    | "EXACT";
  confirmationStrength: number; // 0–100
  invalidationClarity: number; // 0–100
  rewardFeasibility: number; // 0–100
  mainBlocker: string | null;
  nextUnlockCondition: string | null;
  strongestConfirmingMarket:
    | "BINANCE_SPOT"
    | "COINBASE_SPOT"
    | "BINANCE_FUTURES"
    | "MULTI_MARKET"
    | "NONE";
  laggingOrBlockingMarket:
    | "BINANCE_SPOT"
    | "COINBASE_SPOT"
    | "BINANCE_FUTURES"
    | "MULTIPLE"
    | "NONE";
  reasoningSummary: string;
};

export type HybridAssetBundle = {
  mapping: CanonicalAssetMarkets;
  assetState: CanonicalAssetState;
  correlation: HybridCorrelationState;
  entry: EntryEngineOutput;
};

export type HybridValidationScenario = {
  id: string;
  name: string;
  description: string;
  assetState: CanonicalAssetState;
  expected: {
    leadMarket: LeadMarket;
    divergenceType: DivergenceType;
    hybridPermission: HybridPermission;
    entryPermitted: boolean;
    mainBlockerContains: string | null;
  };
};
