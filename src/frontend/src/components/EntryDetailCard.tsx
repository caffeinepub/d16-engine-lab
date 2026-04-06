// D16 Engine Lab — Entry Detail Card
// Dedicated, operator-facing Entry Engine execution surface.
// Presents the full entry engine output as five explicit panels:
//   1. ENTRY STATE     — core entry engine fields
//   2. EXECUTION MAP   — price targets with source truth
//   3. REASONING       — permission rationale, class rationale, improvement path, invalidation
//   4. THESIS STATUS   — thesis strength, continuation pressure, invalidation pressure
//   5. RECENT CHANGES  — last N surveillance events (if events prop passed)
//
// D16 SEMANTIC INTEGRITY PASS:
//   - ENTRY OPEN is shown ONLY for EXACT permission. Provisional uses PROVISIONAL ENTRY.
//   - CLASS = NONE is displayed as UNCLASSIFIED to reduce operator confusion.
//   - Execution Map shows source truth: runtime mode, price source, symbol, age.
//   - Price sanity guard: if price age > threshold, map marked STALE / PRICE INVALID.
//   - Blocker banner, permission label, management state, and reasoning all tell the same truth.
//   - Reasoning language is permission-state-aligned (EXACT=immediate, PROVISIONAL=conditional,
//     BLOCKED=non-executable).
//
// mode="full"    — used in HybridDetailInspector and Universe detail
// mode="compact" — used in SurveillanceCard expansion

import type { EntryEngineOutput, HybridCorrelationState } from "../hybridTypes";
import type { SurveillanceEvent } from "../surveillanceTypes";
import type { AssetPriceData, UniverseTopEntryRecord } from "../universeTypes";

export type EntryDetailCardMode = "full" | "compact";

type EntryDetailCardProps = {
  entry: EntryEngineOutput;
  correlation?: HybridCorrelationState | null;
  mode?: EntryDetailCardMode;
  events?: SurveillanceEvent[];
  priceData?: AssetPriceData | null;
  /** The runtime mode string (e.g. "HYBRID_LIVE", "LIVE", "MOCK").
   * Used for execution map source truth label. Defaults to "HYBRID_LIVE". */
  runtimeMode?: string;
  /** The asset symbol used for price lookup (e.g. "BTCUSDT").
   * If not provided, falls back to `entry.asset`. */
  priceSymbol?: string | null;
  /** Which market the price came from (e.g. "BINANCE_SPOT").
   * Used for source truth display. */
  priceSourceMarket?: string | null;
  /** When false, execution map shows "Live source required" instead of computed values.
   * Defaults to true. Set to false when rendering in DEV/MOCK mode where price data
   * is simulated and should not be presented as operator-ready numbers. */
  isLiveBacked?: boolean;
};

// ─── Semantic entry label: ONLY "ENTRY OPEN" for EXACT ───────────────────────
// All other permitted states get a semantically correct conditional label.
// BLOCKED / WATCH_ONLY / PROJECTED_ONLY → ENTRY CLOSED.

function entryStatusLabel(permissionLevel: string): {
  label: string;
  color: string;
  bg: string;
  border: string;
} {
  switch (permissionLevel) {
    case "EXACT":
      return {
        label: "ENTRY OPEN",
        color: "#22C55E",
        bg: "#05200f",
        border: "#0f5030",
      };
    case "PROVISIONAL":
      return {
        label: "PROVISIONAL ENTRY",
        color: "#67E8F9",
        bg: "#031820",
        border: "#0d4060",
      };
    case "PROJECTED_ONLY":
      return {
        label: "PROJECTED ONLY",
        color: "#93C5FD",
        bg: "#0d1a2e",
        border: "#1a3a60",
      };
    case "WATCH_ONLY":
      return {
        label: "WATCH ONLY",
        color: "#FACC15",
        bg: "#1a1000",
        border: "#3a2800",
      };
    case "BLOCKED":
      return {
        label: "ENTRY BLOCKED",
        color: "#EF4444",
        bg: "#200a0a",
        border: "#401010",
      };
    default:
      return {
        label: "ENTRY CLOSED",
        color: "#9CA3AF",
        bg: "#111418",
        border: "#2a2f38",
      };
  }
}

// ─── CLASS display: NONE → UNCLASSIFIED ──────────────────────────────────────
// "NONE" is a valid internal engine state but confuses operators.
// Display it as UNCLASSIFIED on all operator-facing surfaces.

function displayEntryClass(cls: string): string {
  return cls === "NONE" ? "UNCLASSIFIED" : cls;
}

// ─── Shared color helpers ──────────────────────────────────────────────────────

function permissionColor(level: string): string {
  switch (level) {
    case "EXACT":
      return "#22C55E";
    case "PROVISIONAL":
      return "#67E8F9";
    case "PROJECTED_ONLY":
      return "#93C5FD";
    case "WATCH_ONLY":
      return "#FACC15";
    case "BLOCKED":
      return "#EF4444";
    default:
      return "#9CA3AF";
  }
}

function entryClassColor(cls: string): string {
  switch (cls) {
    case "BREAKOUT":
      return "#22C55E";
    case "RECLAIM":
      return "#67E8F9";
    case "PULLBACK":
      return "#FACC15";
    case "CONTINUATION":
      return "#10b981";
    case "REVERSAL":
      return "#FB923C";
    default:
      // UNCLASSIFIED / NONE
      return "#4B5563";
  }
}

function trustColor(v: number): string {
  return v >= 70 ? "#22C55E" : v >= 40 ? "#FACC15" : "#EF4444";
}

function confirmationColor(v: number): string {
  return v >= 75
    ? "#22C55E"
    : v >= 50
      ? "#67E8F9"
      : v >= 30
        ? "#FACC15"
        : "#EF4444";
}

function marketShortLabel(market: string): string {
  switch (market) {
    case "BINANCE_FUTURES":
      return "BN-FUT";
    case "BINANCE_SPOT":
      return "BN-SPOT";
    case "COINBASE_SPOT":
      return "CB-SPOT";
    case "MULTI_MARKET":
      return "MULTI";
    case "MULTIPLE":
      return "MULTIPLE";
    default:
      return market === "NONE" ? "—" : market.replace(/_/g, " ");
  }
}

function marketFullLabel(market: string): string {
  switch (market) {
    case "BINANCE_FUTURES":
      return "Binance Futures";
    case "BINANCE_SPOT":
      return "Binance Spot";
    case "COINBASE_SPOT":
      return "Coinbase Spot";
    default:
      return market !== "NONE" ? market.replace(/_/g, " ") : "Unknown";
  }
}

function marketColor(market: string): string {
  switch (market) {
    case "BINANCE_FUTURES":
      return "#67E8F9";
    case "BINANCE_SPOT":
    case "COINBASE_SPOT":
      return "#86EFAC";
    case "MULTI_MARKET":
    case "MULTIPLE":
      return "#FACC15";
    default:
      return "#6B7280";
  }
}

// ─── Price age sanity thresholds ──────────────────────────────────────────────
// If price data is older than these thresholds the execution map is unreliable.
const PRICE_STALE_WARN_SEC = 30; // amber warning
const PRICE_STALE_INVALID_SEC = 120; // red / invalid

function priceAgeStatus(capturedAt: number): "fresh" | "stale" | "invalid" {
  const ageSec = (Date.now() - capturedAt) / 1000;
  if (ageSec > PRICE_STALE_INVALID_SEC) return "invalid";
  if (ageSec > PRICE_STALE_WARN_SEC) return "stale";
  return "fresh";
}

// ─── Permission / reasoning text — permission-state-aligned language ─────────
// EXACT must sound immediate and execution-ready.
// PROVISIONAL must sound conditional and discretionary.
// WATCH / BLOCKED must sound non-executable.

function permissionRationale(
  level: string,
  entry: EntryEngineOutput,
  correlation?: HybridCorrelationState | null,
): { why: string; mustImprove: string; couldInvalidate: string } {
  const conf = Math.round(entry.confirmationStrength);
  const dirAgreement = correlation
    ? Math.round(correlation.directionAgreement)
    : null;
  const matAgreement = correlation
    ? Math.round(correlation.maturityAgreement)
    : null;
  const strConf = correlation
    ? Math.round(correlation.structuralConfirmation)
    : null;

  switch (level) {
    case "EXACT":
      return {
        why: `All hybrid prerequisites cleared. Cross-market confirmation at ${conf}% with direction, maturity, and structural agreement sufficient for immediate execution. Entry is exact-ready — proceed at operator timing.`,
        mustImprove:
          "Maintain current cross-market alignment. Monitor for any market de-syncing before execution.",
        couldInvalidate:
          entry.laggingOrBlockingMarket !== "NONE"
            ? `${marketShortLabel(entry.laggingOrBlockingMarket)} re-diverging, trust degradation, or direction reversal in any confirming market will drop permission from EXACT.`
            : "Trust degradation, loss of structural confirmation, or direction reversal in any market will drop permission from EXACT.",
      };
    case "PROVISIONAL":
      return {
        why: `Directional structure and base confirmation are present (${conf}%), but not all requirements for exact entry are met. This is a conditional entry — execution is at operator discretion, with awareness of the remaining gap.`,
        mustImprove:
          matAgreement !== null
            ? `Maturity agreement (${matAgreement}%) must strengthen further. At least one additional market needs to mature into ARMED or READY state before exact permission is reached.`
            : "Maturity agreement and structural confirmation must strengthen before exact permission.",
        couldInvalidate: entry.mainBlocker
          ? `Active constraint: ${entry.mainBlocker}. Additionally, any direction conflict or trust class degrading to INVALID_RUNTIME will reduce permission.`
          : "Direction conflict in any market, or trust class degrading to INVALID_RUNTIME, will reduce permission below PROVISIONAL.",
      };
    case "PROJECTED_ONLY":
      return {
        why: `${
          correlation?.leadMarket === "BINANCE_FUTURES"
            ? "Futures market is leading, but spot markets have not yet confirmed the direction."
            : "Lead market is developing, but cross-market confirmation is insufficient."
        } Cross-market confirmation at ${conf}%. Observation posture only — no entry is valid at this level.`,
        mustImprove:
          strConf !== null
            ? `Spot markets must close the maturity gap. Structural confirmation (${strConf}%) needs to reach ≥65%. At least 2-of-3 markets must align direction before provisional entry becomes available.`
            : "Spot markets must confirm direction and close the maturity gap before provisional entry becomes available.",
        couldInvalidate:
          "Lead market reversal before spot confirmation, or trust degradation in any market. No entry until provisional conditions are met.",
      };
    case "WATCH_ONLY":
      return {
        why: `Cross-market confirmation too low (${conf}%) for any entry type. Directional structure is developing but not ready for a plan. This is a monitoring posture only — no entry at any level is valid.`,
        mustImprove:
          dirAgreement !== null
            ? `Direction agreement (${dirAgreement}%) must reach ≥70%. All three markets must show consistent directional bias with adequate maturity and trust before projected entry becomes available.`
            : "All three markets must show consistent directional bias with adequate maturity and trust.",
        couldInvalidate:
          "N/A — entry is not valid at WATCH_ONLY. Resolve direction and maturity disagreement first.",
      };
    case "BLOCKED":
      return {
        why: entry.mainBlocker
          ? `Hard block active: ${entry.mainBlocker}. Entry is not permitted in any form until this block is resolved.`
          : "Entry is blocked. One or more hard preconditions are not met (direction conflict, trust failure, or insufficient confirmation). No entry is valid.",
        mustImprove: entry.nextUnlockCondition
          ? entry.nextUnlockCondition
          : "Resolve all active blockers before this asset can be re-evaluated.",
        couldInvalidate:
          "N/A — entry is already blocked. All fields below are non-executable.",
      };
    default:
      return {
        why: "Permission level undetermined.",
        mustImprove: "—",
        couldInvalidate: "—",
      };
  }
}

// ─── EntryClass rationale — permission-state-aligned ─────────────────────────

function entryClassRationale(cls: string, entry: EntryEngineOutput): string {
  // Non-executable states: class rationale is irrelevant
  if (
    entry.permissionLevel === "BLOCKED" ||
    entry.permissionLevel === "WATCH_ONLY"
  ) {
    return "Entry class is not applicable at this permission level. Resolve blockers and improve confirmation first.";
  }

  switch (cls) {
    case "BREAKOUT":
      if (entry.permissionLevel === "EXACT")
        return "Futures market leading with high direction agreement and spot markets confirming. Breakout structure is execution-ready — the move is initiating from futures with spot validation confirmed.";
      return "Futures market is leading with spot markets forming alignment. Breakout class — the move is initiating from futures, but spot confirmation is still developing. Entry is conditional.";
    case "RECLAIM":
      if (entry.permissionLevel === "EXACT")
        return "Spot market(s) confirming after a prior gap period. Reclaim structure is execution-ready — the asset has recovered the structure required for entry.";
      return "Spot market(s) showing recovery signs after a lagging period. Reclaim class — often a second-chance entry, but confirmation needs to solidify before execution.";
    case "PULLBACK":
      if (entry.permissionLevel === "EXACT")
        return "Strong underlying structure with temporary retracement completed. Pullback structure is execution-ready — the dominant direction is intact and the asset is at a re-entry zone.";
      return "Strong underlying structure with one spot market temporarily lagging. Pullback class — the setup is valid but the retracement is still resolving. Entry is conditional.";
    case "CONTINUATION":
      if (entry.permissionLevel === "EXACT")
        return "All markets in high directional and maturity agreement with futures leading. Continuation structure is execution-ready — this is the highest-confidence entry class. The trend is intact and extending.";
      return "Markets showing continuation structure but maturity or confirmation not fully aligned. Continuation class — high-quality setup but not yet fully confirmed for execution.";
    case "REVERSAL":
      if (entry.permissionLevel === "EXACT")
        return "Prior direction conflict has resolved. Spot markets now confirming the new direction. Reversal structure is execution-ready — higher risk class but confirmation is present.";
      return "Direction conflict is resolving but not yet fully confirmed. Reversal class — higher-risk setup, execution only at full confirmation.";
    default:
      // UNCLASSIFIED — explain based on permission level
      if (entry.permissionLevel === "PROJECTED_ONLY") {
        return `Cross-market confirmation (${Math.round(entry.confirmationStrength)}%) or structural conditions are below the threshold required for class derivation. Monitor for one of the standard classes (BREAKOUT, CONTINUATION, RECLAIM, PULLBACK, REVERSAL) to emerge.`;
      }
      return `Entry class has not been assigned (UNCLASSIFIED). Cross-market confirmation (${Math.round(entry.confirmationStrength)}%) or structure is insufficient for any class derivation. This is not an entry-ready state.`;
  }
}

// ─── Time-ago helper ─────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, accent }: { label: string; accent?: string }) {
  return (
    <div
      className="flex items-center gap-2 mb-3"
      style={
        accent ? { borderLeft: `3px solid ${accent}`, paddingLeft: 8 } : {}
      }
    >
      <span
        className="text-[10px] font-mono font-bold uppercase tracking-widest"
        style={{ color: accent ?? "#9CA3AF" }}
      >
        {label}
      </span>
    </div>
  );
}

function ConfBar({ value }: { value: number }) {
  const color = confirmationColor(value);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-[#1a1f26]">
        <div
          className="h-1 rounded-full transition-all"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
      <span
        className="text-[9px] font-mono font-bold w-6 text-right"
        style={{ color }}
      >
        {Math.round(value)}
      </span>
    </div>
  );
}

function PendingField({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20">
      <span className="text-[9px] font-mono text-muted-foreground/50">
        {label}
      </span>
      <span className="text-[9px] font-mono text-muted-foreground/30 italic">
        pending
      </span>
    </div>
  );
}

// ─── Panel 1: Entry State ─────────────────────────────────────────────────────

function EntryStatePanel({
  entry,
  compact,
}: {
  entry: EntryEngineOutput;
  compact: boolean;
}) {
  const permColor = permissionColor(entry.permissionLevel);
  const displayClass = displayEntryClass(entry.entryClass);
  const clsColor = entryClassColor(entry.entryClass);
  const sideColor =
    entry.side === "LONG"
      ? "#22C55E"
      : entry.side === "SHORT"
        ? "#EF4444"
        : "#6B7280";
  const sideLabel =
    entry.side === "LONG"
      ? "▲ LONG"
      : entry.side === "SHORT"
        ? "▼ SHORT"
        : "— NONE";

  // Semantic consistency: is the card truly entry-executable?
  const isExecutable = entry.permissionLevel === "EXACT";
  const isConditional = entry.permissionLevel === "PROVISIONAL";
  const isNonExecutable =
    entry.permissionLevel === "BLOCKED" ||
    entry.permissionLevel === "WATCH_ONLY" ||
    entry.permissionLevel === "PROJECTED_ONLY";

  return (
    <div
      className="rounded border p-3 space-y-3"
      style={{ borderColor: `${permColor}30`, background: `${permColor}08` }}
    >
      {/* Top identity row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Side */}
        <div>
          <div className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-0.5">
            SIDE
          </div>
          <span
            className="text-[13px] font-mono font-bold"
            style={{ color: isNonExecutable ? `${sideColor}80` : sideColor }}
          >
            {sideLabel}
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-border/30" />

        {/* Permission */}
        <div>
          <div className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-0.5">
            PERMISSION
          </div>
          <span
            className="text-[12px] font-mono font-bold"
            style={{ color: permColor }}
          >
            {entry.permissionLevel}
          </span>
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-border/30" />

        {/* Entry class — display UNCLASSIFIED for NONE */}
        <div>
          <div className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-0.5">
            CLASS
          </div>
          <span
            className="text-[12px] font-mono font-bold"
            style={{ color: clsColor }}
          >
            {displayClass}
          </span>
        </div>
      </div>

      {/* Confirmation bar */}
      <div>
        <div className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-1">
          CROSS-MARKET CONFIRMATION
        </div>
        <ConfBar value={entry.confirmationStrength} />
      </div>

      {/* Markets grid */}
      {!compact && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-1">
              STRONGEST CONFIRMING
            </div>
            <span
              className="text-[10px] font-mono font-bold"
              style={{ color: marketColor(entry.strongestConfirmingMarket) }}
            >
              {marketShortLabel(entry.strongestConfirmingMarket)}
            </span>
          </div>
          <div>
            <div className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-1">
              LAGGING / BLOCKING
            </div>
            <span
              className="text-[10px] font-mono font-bold"
              style={{
                color:
                  entry.laggingOrBlockingMarket === "NONE"
                    ? "#22C55E"
                    : "#F87171",
              }}
            >
              {marketShortLabel(entry.laggingOrBlockingMarket)}
            </span>
          </div>
        </div>
      )}

      {/* Trust */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <div className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-0.5">
            TRUST
          </div>
          <span
            className="text-[11px] font-mono font-bold"
            style={{ color: trustColor(entry.invalidationClarity) }}
          >
            {Math.round(entry.invalidationClarity)}%
          </span>
        </div>
        <div>
          <div className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-0.5">
            REWARD FEASIBILITY
          </div>
          <span
            className="text-[11px] font-mono font-bold"
            style={{
              color: isNonExecutable
                ? "#4B5563"
                : confirmationColor(entry.rewardFeasibility),
            }}
          >
            {isNonExecutable ? "N/A" : Math.round(entry.rewardFeasibility)}
          </span>
        </div>
      </div>

      {/* Blocker — must always be shown when present; never hidden */}
      {entry.mainBlocker && (
        <div
          className="flex items-start gap-2 px-2.5 py-2 rounded"
          style={{ background: "#200a0a", border: "1px solid #3a1010" }}
        >
          <span className="text-[#EF4444] text-[10px] flex-shrink-0">■</span>
          <span className="text-[10px] font-mono text-[#F87171] leading-snug">
            BLOCKED: {entry.mainBlocker}
          </span>
        </div>
      )}

      {/* Conditional notice for PROVISIONAL — makes clear this is NOT exact */}
      {isConditional && !entry.mainBlocker && (
        <div
          className="flex items-start gap-2 px-2.5 py-2 rounded"
          style={{ background: "#031820", border: "1px solid #0d4060" }}
        >
          <span className="text-[#67E8F9] text-[10px] flex-shrink-0">◐</span>
          <span className="text-[10px] font-mono text-[#67E8F9]/80 leading-snug">
            CONDITIONAL: Exact prerequisites not yet cleared. Entry at operator
            discretion only.
          </span>
        </div>
      )}

      {/* Next unlock — only for non-blocked, non-executable states */}
      {!entry.mainBlocker &&
        !isExecutable &&
        !isConditional &&
        entry.nextUnlockCondition && (
          <div
            className="flex items-start gap-2 px-2.5 py-2 rounded"
            style={{ background: "#0a1a2a", border: "1px solid #1a3060" }}
          >
            <span className="text-[#67E8F9] text-[10px] flex-shrink-0">○</span>
            <span className="text-[10px] font-mono text-[#67E8F9]/80 leading-snug">
              NEXT: {entry.nextUnlockCondition}
            </span>
          </div>
        )}

      {/* Next unlock for PROVISIONAL — shows path to EXACT */}
      {isConditional && entry.nextUnlockCondition && (
        <div
          className="flex items-start gap-2 px-2.5 py-2 rounded"
          style={{ background: "#0a1a0a", border: "1px solid #0f3030" }}
        >
          <span className="text-[#22C55E] text-[10px] flex-shrink-0">→</span>
          <span className="text-[10px] font-mono text-[#22C55E]/70 leading-snug">
            TO EXACT: {entry.nextUnlockCondition}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Panel 2: Execution Map ───────────────────────────────────────────────────
// Source truth display: shows exactly where the price came from, symbol used,
// and how old the data is. Sanity guard: if price is too old, marks map invalid.

type ExecutionMapValues = {
  entryPrice: number | null;
  initialSL: number | null;
  tp1: number | null;
  tp2: number | null;
  breakEven: number | null;
  isLong: boolean;
  isComputed: boolean;
  priceAge: number | null; // seconds since capture
  priceAgeStatus: "fresh" | "stale" | "invalid";
};

function computeExecutionMap(
  entry: EntryEngineOutput,
  priceData: AssetPriceData | null,
): ExecutionMapValues {
  const isLong = entry.side === "LONG";
  const isBlocked =
    entry.permissionLevel === "BLOCKED" ||
    entry.permissionLevel === "WATCH_ONLY";
  const isNone = entry.side === "NONE";

  if (!priceData || priceData.currentPrice <= 0 || isNone) {
    return {
      entryPrice: null,
      initialSL: null,
      tp1: null,
      tp2: null,
      breakEven: null,
      isLong,
      isComputed: false,
      priceAge: null,
      priceAgeStatus: "fresh",
    };
  }

  const { currentPrice, high24h, low24h, capturedAt } = priceData;
  const priceAge = Math.round((Date.now() - capturedAt) / 1000);
  const ageStatus = priceAgeStatus(capturedAt);

  // If price is too old, we still show the reference price but mark the map invalid
  // so the operator knows the execution numbers cannot be trusted
  if (ageStatus === "invalid") {
    return {
      entryPrice: currentPrice,
      initialSL: null,
      tp1: null,
      tp2: null,
      breakEven: null,
      isLong,
      isComputed: false,
      priceAge,
      priceAgeStatus: ageStatus,
    };
  }

  // If entry is blocked / watch-only, show price reference but no SL/TP
  if (isBlocked) {
    return {
      entryPrice: currentPrice,
      initialSL: null,
      tp1: null,
      tp2: null,
      breakEven: null,
      isLong,
      isComputed: false,
      priceAge,
      priceAgeStatus: ageStatus,
    };
  }

  // SL distance based on daily range (ATR proxy)
  const range = Math.max(high24h - low24h, currentPrice * 0.005);
  const clarityFactor = 1 - (entry.invalidationClarity / 100) * 0.3;
  let slFactor = 0.25 * clarityFactor;

  if (entry.permissionLevel === "EXACT") slFactor *= 0.9;
  else if (entry.permissionLevel === "PROVISIONAL") slFactor *= 1.1;

  const slDistance = range * slFactor;
  const initialSL = isLong
    ? currentPrice - slDistance
    : currentPrice + slDistance;

  const RR1 = 1.5;
  const RR2 = 3.0;
  const BREAKEVEN_FACTOR = 0.8;

  const tp1 = isLong
    ? currentPrice + slDistance * RR1
    : currentPrice - slDistance * RR1;
  const tp2 = isLong
    ? currentPrice + slDistance * RR2
    : currentPrice - slDistance * RR2;
  const breakEven = isLong
    ? currentPrice + slDistance * BREAKEVEN_FACTOR
    : currentPrice - slDistance * BREAKEVEN_FACTOR;

  return {
    entryPrice: currentPrice,
    initialSL,
    tp1,
    tp2,
    breakEven,
    isLong,
    isComputed: true,
    priceAge,
    priceAgeStatus: ageStatus,
  };
}

function formatPrice(value: number): string {
  if (value >= 10000)
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (value >= 100)
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  if (value >= 1)
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  });
}

type ExecFieldProps = {
  label: string;
  value: number | null;
  isPositive?: boolean;
  priceLabel?: boolean;
  blocked?: boolean;
};

function ExecField({
  label,
  value,
  isPositive,
  priceLabel,
  blocked,
}: ExecFieldProps) {
  if (value === null) {
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-border/20">
        <span className="text-[9px] font-mono text-muted-foreground/50">
          {label}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/30 italic">
          {blocked ? "not permitted" : "pending"}
        </span>
      </div>
    );
  }
  const color = priceLabel
    ? "#E2E8F0"
    : isPositive === true
      ? "#22C55E"
      : isPositive === false
        ? "#F87171"
        : "#67E8F9";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/20">
      <span className="text-[9px] font-mono text-muted-foreground/50">
        {label}
      </span>
      <span className="text-[10px] font-mono font-semibold" style={{ color }}>
        {formatPrice(value)}
      </span>
    </div>
  );
}

function ExecutionMapPanel({
  entry,
  priceData,
  isLiveBacked = true,
  runtimeMode = "HYBRID_LIVE",
  priceSymbol,
  priceSourceMarket,
}: {
  entry: EntryEngineOutput;
  priceData: AssetPriceData | null;
  isLiveBacked?: boolean;
  runtimeMode?: string;
  priceSymbol?: string | null;
  priceSourceMarket?: string | null;
}) {
  const exec = computeExecutionMap(entry, priceData);
  const isBlocked =
    entry.permissionLevel === "BLOCKED" ||
    entry.permissionLevel === "WATCH_ONLY";
  const isProvisional = entry.permissionLevel === "PROVISIONAL";

  // Not live-backed (dev/mock mode) — block all execution values
  if (!isLiveBacked) {
    return (
      <div className="rounded border border-border/30 bg-[#0b0f14] p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-[#92400e]/70 uppercase tracking-widest">
            LIVE SOURCE REQUIRED
          </span>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground/40 leading-relaxed">
          Connect to live markets for execution map. Simulated data cannot
          produce operator-ready entry numbers.
        </p>
      </div>
    );
  }

  // Price sanity guard — price is too old to trust
  if (priceData && exec.priceAgeStatus === "invalid") {
    return (
      <div
        className="rounded border p-3 space-y-2"
        style={{ borderColor: "#3a1010", background: "#140a0a" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-[#EF4444]">
            ⚠ PRICE SOURCE MISMATCH
          </span>
        </div>
        <div className="text-[8px] font-mono text-[#EF4444]/60 uppercase tracking-widest">
          EXECUTION MAP INVALID
        </div>
        <p className="text-[9px] font-mono text-muted-foreground/50 leading-relaxed">
          Price data is {exec.priceAge !== null ? `${exec.priceAge}s` : "too"}{" "}
          old (threshold: {PRICE_STALE_INVALID_SEC}s). Execution targets cannot
          be trusted. Refresh live connection to restore map.
        </p>
        {exec.entryPrice !== null && (
          <div className="text-[9px] font-mono text-muted-foreground/40">
            Last known price: {formatPrice(exec.entryPrice)}
          </div>
        )}
      </div>
    );
  }

  // Derive management state — must be semantically consistent with permission
  let mgmtState: string;
  if (entry.permissionLevel === "EXACT") {
    mgmtState = "Execution ready — await operator confirmation";
  } else if (isProvisional) {
    mgmtState = "Conditional — operator discretion required";
  } else if (isBlocked) {
    mgmtState = "Not applicable — entry not permitted at this level";
  } else {
    mgmtState = "Pre-entry monitoring — no execution plan active";
  }

  // Determine best available price source for source truth display
  const displaySource = priceSourceMarket
    ? marketFullLabel(priceSourceMarket)
    : "Best available";
  const displaySymbol = priceSymbol ?? entry.asset;

  return (
    <div className="rounded border border-border/40 bg-[#0b0f14] p-3">
      {!exec.isComputed && !exec.entryPrice && (
        <div className="space-y-0">
          <PendingField label="Entry Price" />
          <PendingField label="Initial SL" />
          <PendingField label="TP1" />
          <PendingField label="TP2" />
          <PendingField label="Break-Even Trigger" />
        </div>
      )}
      {exec.entryPrice !== null && (
        <div className="space-y-0">
          <ExecField label="Entry Price" value={exec.entryPrice} priceLabel />
          <ExecField
            label="Initial SL"
            value={exec.initialSL}
            isPositive={false}
            blocked={isBlocked}
          />
          <ExecField
            label="TP1  (1.5R)"
            value={exec.tp1}
            isPositive={true}
            blocked={isBlocked}
          />
          <ExecField
            label="TP2  (3.0R)"
            value={exec.tp2}
            isPositive={true}
            blocked={isBlocked}
          />
          <ExecField
            label="Break-Even"
            value={exec.breakEven}
            isPositive={exec.isLong}
            blocked={isBlocked}
          />
        </div>
      )}

      {/* Stale warning — amber, not fully invalid */}
      {exec.priceAgeStatus === "stale" && (
        <div
          className="flex items-center gap-2 mt-2 px-2 py-1.5 rounded"
          style={{ background: "#1a1000", border: "1px solid #3a2800" }}
        >
          <span className="text-[#FACC15] text-[9px]">⚠</span>
          <span className="text-[9px] font-mono text-[#FACC15]/70">
            Price data is {exec.priceAge}s old — execution targets may be
            slightly stale
          </span>
        </div>
      )}

      {/* Source truth footer */}
      <div className="mt-2.5 pt-2 border-t border-border/20 space-y-1.5">
        {/* Management state */}
        <div className="flex items-start gap-2">
          <span className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest flex-shrink-0 mt-0.5">
            MANAGEMENT STATE
          </span>
          <span
            className="text-[9px] font-mono leading-snug"
            style={{
              color: isBlocked
                ? "#6B7280"
                : isProvisional
                  ? "#67E8F9"
                  : "#9CA3AF",
            }}
          >
            {mgmtState}
          </span>
        </div>

        {/* Source truth: runtime mode, source, symbol, age */}
        <div className="rounded bg-[#080b10] border border-border/20 p-2 space-y-1">
          <div className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-widest mb-1">
            EXECUTION SOURCE TRUTH
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <div className="flex items-center gap-1">
              <span className="text-[7px] font-mono text-muted-foreground/30 uppercase">
                Mode
              </span>
              <span className="text-[8px] font-mono text-muted-foreground/60">
                {runtimeMode}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[7px] font-mono text-muted-foreground/30 uppercase">
                Source
              </span>
              <span className="text-[8px] font-mono text-muted-foreground/60">
                {priceData ? displaySource : "—"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[7px] font-mono text-muted-foreground/30 uppercase">
                Symbol
              </span>
              <span className="text-[8px] font-mono text-muted-foreground/60">
                {displaySymbol}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[7px] font-mono text-muted-foreground/30 uppercase">
                Captured
              </span>
              <span
                className="text-[8px] font-mono"
                style={{
                  color:
                    exec.priceAgeStatus === "invalid"
                      ? "#EF4444"
                      : exec.priceAgeStatus === "stale"
                        ? "#FACC15"
                        : "#9CA3AF",
                }}
              >
                {exec.priceAge !== null
                  ? exec.priceAge < 60
                    ? `${exec.priceAge}s ago`
                    : exec.priceAge < 3600
                      ? `${Math.floor(exec.priceAge / 60)}m ago`
                      : "stale"
                  : priceData
                    ? "—"
                    : "no data"}
              </span>
            </div>
          </div>
        </div>

        {!priceData && !isBlocked && (
          <p className="text-[8px] font-mono text-muted-foreground/30 italic">
            Live price data will populate once hydration completes.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Panel 3: Entry Reasoning ─────────────────────────────────────────────────

function EntryReasoningPanel({
  entry,
  correlation,
  compact,
}: {
  entry: EntryEngineOutput;
  correlation?: HybridCorrelationState | null;
  compact: boolean;
}) {
  const { why, mustImprove, couldInvalidate } = permissionRationale(
    entry.permissionLevel,
    entry,
    correlation,
  );
  const displayClass = displayEntryClass(entry.entryClass);
  const classReason = entryClassRationale(entry.entryClass, entry);

  // Color-code the section header based on whether this is an executable state
  const isExecutable = entry.permissionLevel === "EXACT";
  const isConditional = entry.permissionLevel === "PROVISIONAL";
  const isNonExecutable =
    entry.permissionLevel === "BLOCKED" ||
    entry.permissionLevel === "WATCH_ONLY";

  const whyHeaderColor = isExecutable
    ? "#22C55E"
    : isConditional
      ? "#67E8F9"
      : isNonExecutable
        ? "#F87171"
        : "#9CA3AF";

  return (
    <div className="rounded border border-border/30 bg-[#0a0c10] p-3 space-y-3">
      {/* Why this permission */}
      <div>
        <div
          className="text-[7px] font-mono uppercase tracking-widest mb-1"
          style={{ color: `${whyHeaderColor}60` }}
        >
          WHY {entry.permissionLevel}
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/80 leading-relaxed">
          {why}
        </p>
      </div>

      {/* Why this class — skip for non-executable if class is UNCLASSIFIED */}
      {!compact && !(isNonExecutable && entry.entryClass === "NONE") && (
        <div>
          <div className="text-[7px] font-mono text-[#a78bfa]/60 uppercase tracking-widest mb-1">
            WHY {displayClass} CLASS
          </div>
          <p className="text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
            {classReason}
          </p>
        </div>
      )}

      {/* What must improve */}
      {!isNonExecutable && (
        <div>
          <div className="text-[7px] font-mono text-[#FACC15]/60 uppercase tracking-widest mb-1">
            {isExecutable ? "MAINTAIN" : "WHAT MUST IMPROVE"}
          </div>
          <p className="text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
            {mustImprove}
          </p>
        </div>
      )}

      {/* For non-executable: show must-improve as unlock path */}
      {isNonExecutable && (
        <div>
          <div className="text-[7px] font-mono text-[#FACC15]/60 uppercase tracking-widest mb-1">
            UNLOCK PATH
          </div>
          <p className="text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
            {mustImprove}
          </p>
        </div>
      )}

      {/* What could invalidate — hidden in compact */}
      {!compact && (
        <div>
          <div className="text-[7px] font-mono text-[#F87171]/60 uppercase tracking-widest mb-1">
            {isNonExecutable ? "N/A" : "WHAT COULD INVALIDATE"}
          </div>
          <p className="text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
            {couldInvalidate}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Panel 4: Thesis Status ───────────────────────────────────────────────────

type ThesisLevel = "STRONG" | "MODERATE" | "WEAK";

function thesisLevel(value: number): ThesisLevel {
  if (value >= 61) return "STRONG";
  if (value >= 31) return "MODERATE";
  return "WEAK";
}

function thesisColor(level: ThesisLevel): string {
  switch (level) {
    case "STRONG":
      return "#22C55E";
    case "MODERATE":
      return "#FACC15";
    case "WEAK":
      return "#EF4444";
  }
}

function invalidationPressureLevel(
  mainBlocker: string | null,
  laggingMarket: string,
): { label: string; color: string } {
  if (mainBlocker) return { label: "HIGH", color: "#EF4444" };
  if (laggingMarket && laggingMarket !== "NONE")
    return { label: "MEDIUM", color: "#FACC15" };
  return { label: "LOW", color: "#22C55E" };
}

function ThesisStatusPanel({ entry }: { entry: EntryEngineOutput }) {
  const isNonExecutable =
    entry.permissionLevel === "BLOCKED" ||
    entry.permissionLevel === "WATCH_ONLY";

  // For non-executable states, thesis strength is suppressed
  const thesisStr = isNonExecutable
    ? "WEAK"
    : thesisLevel(entry.rewardFeasibility);
  const contPressure = isNonExecutable
    ? "WEAK"
    : thesisLevel(entry.confirmationStrength);
  const invPressure = invalidationPressureLevel(
    entry.mainBlocker,
    entry.laggingOrBlockingMarket,
  );

  const rows: Array<{ label: string; value: string; color: string }> = [
    {
      label: "Thesis Strength",
      value: isNonExecutable ? "NOT ACTIVE" : thesisStr,
      color: isNonExecutable
        ? "#4B5563"
        : thesisColor(thesisStr as ThesisLevel),
    },
    {
      label: "Continuation Pressure",
      value: isNonExecutable ? "NOT ACTIVE" : contPressure,
      color: isNonExecutable
        ? "#4B5563"
        : thesisColor(contPressure as ThesisLevel),
    },
    {
      label: "Invalidation Pressure",
      value: invPressure.label,
      color: invPressure.color,
    },
  ];

  return (
    <div className="rounded border border-border/30 bg-[#0a0c10] p-3 space-y-2.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between py-0.5"
        >
          <span className="text-[9px] font-mono text-muted-foreground/50">
            {row.label}
          </span>
          <span
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
            style={{
              color: row.color,
              background: `${row.color}14`,
              border: `1px solid ${row.color}30`,
            }}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Panel 5: Recent Changes ──────────────────────────────────────────────────

function severityIcon(severity: SurveillanceEvent["severity"]): string {
  switch (severity) {
    case "POSITIVE":
      return "▲";
    case "NEGATIVE":
      return "▼";
    case "URGENT":
      return "■";
    default:
      return "●";
  }
}

function severityEventColor(severity: SurveillanceEvent["severity"]): string {
  switch (severity) {
    case "POSITIVE":
      return "#22C55E";
    case "NEGATIVE":
      return "#F87171";
    case "URGENT":
      return "#F97316";
    default:
      return "#6B7280";
  }
}

function RecentChangesPanel({ events }: { events: SurveillanceEvent[] }) {
  const displayed = events.slice(0, 5);
  return (
    <div className="rounded border border-border/30 bg-[#0a0c10] p-3 space-y-1.5">
      {displayed.map((ev) => (
        <div key={ev.eventId} className="flex items-start gap-2">
          <span
            className="text-[9px] flex-shrink-0 mt-0.5"
            style={{ color: severityEventColor(ev.severity) }}
          >
            {severityIcon(ev.severity)}
          </span>
          <span
            className="flex-1 text-[9px] font-mono leading-snug"
            style={{ color: `${severityEventColor(ev.severity)}cc` }}
          >
            {ev.description}
          </span>
          <span className="text-[8px] font-mono text-muted-foreground/30 flex-shrink-0">
            {timeAgo(ev.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function EntryDetailCard({
  entry,
  correlation,
  mode = "full",
  events,
  priceData,
  runtimeMode = "HYBRID_LIVE",
  priceSymbol,
  priceSourceMarket,
  isLiveBacked = true,
}: EntryDetailCardProps) {
  const compact = mode === "compact";
  const permColor = permissionColor(entry.permissionLevel);
  const hasEvents = events && events.length > 0;

  // Semantic status label — ENTRY OPEN only for EXACT
  const statusLabel = entryStatusLabel(entry.permissionLevel);

  return (
    <div className="space-y-3" data-ocid="entry.detail.card">
      {/* ─── Section header ─── */}
      {!compact && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div
              className="w-1 h-4 rounded-full"
              style={{ background: permColor }}
            />
            <span className="text-[11px] font-mono font-bold text-foreground uppercase tracking-widest">
              ENTRY ENGINE
            </span>
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
              style={{
                color: permColor,
                borderColor: `${permColor}40`,
                background: `${permColor}10`,
              }}
            >
              {entry.asset}
            </span>
          </div>
          {/* Semantically correct entry status badge */}
          <span
            className="text-[8px] font-mono px-1.5 py-0.5 rounded border font-bold"
            style={{
              color: statusLabel.color,
              background: statusLabel.bg,
              border: `1px solid ${statusLabel.border}`,
            }}
          >
            {statusLabel.label}
          </span>
        </div>
      )}

      {/* ─── Panel 1: ENTRY STATE ─── */}
      <div>
        <SectionHeader label="Entry State" accent={permColor} />
        <EntryStatePanel entry={entry} compact={compact} />
      </div>

      {/* ─── Panel 2: EXECUTION MAP ─── */}
      <div>
        <SectionHeader label="Execution Map" accent="#4B5563" />
        <ExecutionMapPanel
          entry={entry}
          priceData={priceData ?? null}
          isLiveBacked={isLiveBacked}
          runtimeMode={runtimeMode}
          priceSymbol={priceSymbol}
          priceSourceMarket={priceSourceMarket}
        />
      </div>

      {/* ─── Panel 3: REASONING ─── */}
      <div>
        <SectionHeader label="Entry Reasoning" accent="#67E8F9" />
        <EntryReasoningPanel
          entry={entry}
          correlation={correlation}
          compact={compact}
        />
      </div>

      {/* ─── Panel 4: THESIS STATUS — full mode only ─── */}
      {!compact && (
        <div>
          <SectionHeader label="Thesis Status" accent="#a78bfa" />
          <ThesisStatusPanel entry={entry} />
        </div>
      )}

      {/* ─── Panel 5: RECENT CHANGES — when events are provided ─── */}
      {hasEvents && (
        <div>
          <SectionHeader label="Recent Changes" accent="#F97316" />
          <RecentChangesPanel events={events!} />
        </div>
      )}
    </div>
  );
}

// ─── Shared utility: build EntryEngineOutput from UniverseTopEntryRecord ──────
// Exported so callers (UniverseBoard, SurveillanceCard) can share a single
// implementation instead of each maintaining their own duplicate.

export function buildEntryFromRecord(
  record: UniverseTopEntryRecord,
): EntryEngineOutput {
  return {
    asset: record.asset,
    permitted:
      record.permissionLevel === "EXACT" ||
      record.permissionLevel === "PROVISIONAL",
    side: record.side,
    entryClass: record.entryClass as EntryEngineOutput["entryClass"],
    permissionLevel:
      record.permissionLevel as EntryEngineOutput["permissionLevel"],
    confirmationStrength: record.confirmationStrength,
    invalidationClarity: record.invalidationClarity,
    rewardFeasibility: record.rewardFeasibility,
    mainBlocker: record.mainBlocker,
    nextUnlockCondition: record.nextUnlockCondition ?? null,
    strongestConfirmingMarket: (record.strongestConfirmingMarket ||
      "NONE") as EntryEngineOutput["strongestConfirmingMarket"],
    laggingOrBlockingMarket: (record.laggingOrBlockingMarket ||
      "NONE") as EntryEngineOutput["laggingOrBlockingMarket"],
    reasoningSummary: record.whyRanked.join(". "),
  };
}
