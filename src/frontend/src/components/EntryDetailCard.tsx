// D16 Engine Lab — Entry Detail Card
// Dedicated, operator-facing Entry Engine execution surface.
// Presents the full entry engine output as four explicit panels:
//   1. ENTRY STATE     — core entry engine fields
//   2. EXECUTION MAP   — price targets (explicit placeholders until mgmt layer built)
//   3. REASONING       — permission rationale, class rationale, improvement path, invalidation
//   4. THESIS STATUS   — thesis strength, continuation pressure, invalidation pressure
// Optional panel 5: RECENT CHANGES — last N surveillance events (if events prop passed)
//
// mode="full"    — used in HybridDetailInspector and Universe detail
// mode="compact" — used in SurveillanceCard expansion
//
// v0.9: Added ThesisStatusPanel, RecentChangesPanel, buildEntryFromRecord export

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
};

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
      return "#9CA3AF";
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

// ─── PermissionSection — explains WHY the permission level was assigned ──────

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
        why: `All hybrid prerequisites cleared. Cross-market confirmation at ${conf}% with direction, maturity, and structural agreement sufficient for immediate entry.`,
        mustImprove:
          "Maintain current cross-market alignment. No degradation allowed before entry execution.",
        couldInvalidate:
          entry.laggingOrBlockingMarket !== "NONE"
            ? `${marketShortLabel(entry.laggingOrBlockingMarket)} re-diverging, trust degradation, or direction reversal in any confirming market.`
            : "Trust degradation, loss of structural confirmation, or direction reversal in any market.",
      };
    case "PROVISIONAL":
      return {
        why: `Direction and structure agree but full confirmation not yet reached (${conf}%). Entry is allowed with provisional parameters — execution at operator discretion.`,
        mustImprove:
          matAgreement !== null
            ? `Maturity agreement (${matAgreement}%) must strengthen. At least one additional market needs to mature into ARMED or READY state.`
            : "Maturity agreement and structural confirmation must strengthen before exact permission.",
        couldInvalidate: entry.mainBlocker
          ? `${entry.mainBlocker}. Also: direction conflict in any market, or trust class degrading to INVALID_RUNTIME.`
          : "Direction conflict in any market, or trust class degrading to INVALID_RUNTIME.",
      };
    case "PROJECTED_ONLY":
      return {
        why: `${
          correlation?.leadMarket === "BINANCE_FUTURES"
            ? "Futures market is leading, but spot markets have not yet confirmed the direction."
            : "Lead market is developing, but cross-market confirmation is insufficient for entry."
        } Cross-market confirmation at ${conf}%. Observation posture only.`,
        mustImprove:
          strConf !== null
            ? `Spot markets must close the maturity gap. Structural confirmation (${strConf}%) needs to reach ≥65%. At least 2-of-3 markets must align direction.`
            : "Spot markets must confirm direction and close the maturity gap before provisional entry becomes available.",
        couldInvalidate:
          "Lead market reversal before spot confirmation, or trust degradation in any market.",
      };
    case "WATCH_ONLY":
      return {
        why: `Cross-market confirmation too low (${conf}%) for any entry type. Directional structure is developing but not yet ready for a plan. Monitoring posture only.`,
        mustImprove:
          dirAgreement !== null
            ? `Direction agreement (${dirAgreement}%) must reach ≥70%. All three markets must show the same directional bias with adequate maturity.`
            : "All three markets must show consistent directional bias with adequate maturity and trust.",
        couldInvalidate:
          "Direction disagreement across markets, trust collapse, or maturity stagnation.",
      };
    case "BLOCKED":
      return {
        why: entry.mainBlocker
          ? `Hard block active: ${entry.mainBlocker}`
          : "Entry is blocked. One or more hard preconditions are not met (direction conflict, trust failure, or insufficient confirmation).",
        mustImprove: entry.nextUnlockCondition
          ? entry.nextUnlockCondition
          : "Resolve all active blockers before this asset can be re-evaluated for entry.",
        couldInvalidate:
          "N/A — entry is already blocked. The blocker must be resolved before this field is relevant.",
      };
    default:
      return {
        why: "Permission level undetermined.",
        mustImprove: "—",
        couldInvalidate: "—",
      };
  }
}

// ─── EntryClass rationale ─────────────────────────────────────────────────────

function entryClassRationale(cls: string, entry: EntryEngineOutput): string {
  switch (cls) {
    case "BREAKOUT":
      return "Futures market leading with high direction agreement. Spot markets are forming alignment. Breakout class means the move is initiating from futures and spot confirmation is developing.";
    case "RECLAIM":
      return "Spot market(s) leading or confirming after a lagging period. Reclaim class means the asset is recovering structure that was lost — often a second-chance entry after a gap.";
    case "PULLBACK":
      return "Strong underlying structure with one spot market temporarily lagging. Pullback class means the setup is a re-entry on a retracement against the dominant direction.";
    case "CONTINUATION":
      return "All markets in high directional + maturity agreement with futures leading. Continuation class means the trend is intact and extending — highest-confidence entry class.";
    case "REVERSAL":
      return "Direction conflict was previously present but is resolving. Spot markets now confirming the new direction. Reversal class means the asset is changing structural direction — higher risk, higher potential.";
    case "NONE":
      return entry.permissionLevel === "BLOCKED"
        ? "No entry class while blocked. Class is only assigned when the asset clears minimum confirmation thresholds."
        : `Cross-market confirmation (${Math.round(entry.confirmationStrength)}%) or structure is below the threshold required for class derivation. Monitor for conditions improving.`;
    default:
      return "Entry class derivation not available.";
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
            style={{ color: sideColor }}
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

        {/* Entry class */}
        <div>
          <div className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-0.5">
            CLASS
          </div>
          <span
            className="text-[12px] font-mono font-bold"
            style={{
              color: entry.entryClass === "NONE" ? "#4B5563" : clsColor,
            }}
          >
            {entry.entryClass}
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
            style={{ color: confirmationColor(entry.rewardFeasibility) }}
          >
            {Math.round(entry.rewardFeasibility)}
          </span>
        </div>
      </div>

      {/* Blocker */}
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

      {/* Next unlock */}
      {!entry.mainBlocker && entry.nextUnlockCondition && (
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
    </div>
  );
}

// ─── Panel 2: Execution Map ───────────────────────────────────────────────────
// Computes numeric execution targets from price data + entry engine state.
//
// Computation logic (doctrine-aligned, no threshold changes):
// - entry_price  = current price (best available market price)
// - range        = high24h - low24h (daily range as ATR proxy)
// - SL distance  = max(range * SL_factor, min_SL) where SL_factor is based on
//                  permission level and invalidation clarity
// - initialSL    = entry_price ± SL_distance (based on side)
// - TP1          = entry_price ± (SL_distance * RR1) where RR1 = 1.5
// - TP2          = entry_price ± (SL_distance * RR2) where RR2 = 3.0
// - breakEven    = entry_price ± (SL_distance * 0.8)
//
// All values are estimates for planning. Position management layer (v0.9) will
// refine these with live structure analysis.

type ExecutionMapValues = {
  entryPrice: number | null;
  initialSL: number | null;
  tp1: number | null;
  tp2: number | null;
  breakEven: number | null;
  isLong: boolean;
  isComputed: boolean;
  priceAge: number | null; // seconds since capture
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
    };
  }

  const { currentPrice, high24h, low24h, capturedAt } = priceData;
  const priceAge = Math.round((Date.now() - capturedAt) / 1000);

  // If entry is blocked, show price reference but no SL/TP
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
    };
  }

  // SL distance based on daily range (ATR proxy)
  // Use invalidationClarity as a modifier: higher clarity = tighter SL
  const range = Math.max(high24h - low24h, currentPrice * 0.005); // min 0.5% of price
  const clarityFactor = 1 - (entry.invalidationClarity / 100) * 0.3; // 0.7–1.0
  let slFactor = 0.25 * clarityFactor; // SL at ~25% of daily range, adjusted

  // Tighten SL for EXACT, loosen for PROVISIONAL
  if (entry.permissionLevel === "EXACT") slFactor *= 0.9;
  else if (entry.permissionLevel === "PROVISIONAL") slFactor *= 1.1;

  const slDistance = range * slFactor;
  const initialSL = isLong
    ? currentPrice - slDistance
    : currentPrice + slDistance;

  // Risk/reward targets
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
  };
}

// Format a price value with appropriate decimal places
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
  isPositive?: boolean; // true=green (TP), false=red (SL), undefined=neutral
  priceLabel?: boolean; // entry price styling
};

function ExecField({ label, value, isPositive, priceLabel }: ExecFieldProps) {
  if (value === null) {
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-border/20">
        <span className="text-[9px] font-mono text-muted-foreground/50">
          {label}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/30 italic">
          blocked
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
}: {
  entry: EntryEngineOutput;
  priceData: AssetPriceData | null;
}) {
  const exec = computeExecutionMap(entry, priceData);
  const isBlocked =
    entry.permissionLevel === "BLOCKED" ||
    entry.permissionLevel === "WATCH_ONLY";

  let mgmtState = "Pre-entry monitoring";
  if (entry.permissionLevel === "EXACT")
    mgmtState = "Execution ready — await operator confirmation";
  else if (entry.permissionLevel === "PROVISIONAL")
    mgmtState = "Provisional entry — at operator discretion";
  else if (isBlocked) mgmtState = "Not applicable — entry not permitted";

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
          />
          <ExecField label="TP1  (1.5R)" value={exec.tp1} isPositive={true} />
          <ExecField label="TP2  (3.0R)" value={exec.tp2} isPositive={true} />
          <ExecField
            label="Break-Even"
            value={exec.breakEven}
            isPositive={exec.isLong}
          />
        </div>
      )}
      <div className="mt-2.5 pt-2 border-t border-border/20 space-y-1">
        <div className="flex items-start gap-2">
          <span className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest flex-shrink-0 mt-0.5">
            MANAGEMENT STATE
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/50 leading-snug">
            {mgmtState}
          </span>
        </div>
        {exec.priceAge !== null && (
          <div className="flex items-center gap-2">
            <span className="text-[7px] font-mono text-muted-foreground/30 uppercase tracking-widest">
              PRICE CAPTURED
            </span>
            <span className="text-[8px] font-mono text-muted-foreground/30">
              {exec.priceAge < 60
                ? `${exec.priceAge}s ago`
                : exec.priceAge < 3600
                  ? `${Math.floor(exec.priceAge / 60)}m ago`
                  : "stale"}
            </span>
          </div>
        )}
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
  const classReason = entryClassRationale(entry.entryClass, entry);

  return (
    <div className="rounded border border-border/30 bg-[#0a0c10] p-3 space-y-3">
      {/* Why this permission */}
      <div>
        <div className="text-[7px] font-mono text-[#67E8F9]/60 uppercase tracking-widest mb-1">
          WHY {entry.permissionLevel}
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/80 leading-relaxed">
          {why}
        </p>
      </div>

      {/* Why this class */}
      {!compact && (
        <div>
          <div className="text-[7px] font-mono text-[#a78bfa]/60 uppercase tracking-widest mb-1">
            WHY {entry.entryClass} CLASS
          </div>
          <p className="text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
            {classReason}
          </p>
        </div>
      )}

      {/* What must improve */}
      <div>
        <div className="text-[7px] font-mono text-[#FACC15]/60 uppercase tracking-widest mb-1">
          WHAT MUST IMPROVE
        </div>
        <p className="text-[10px] font-mono text-muted-foreground/70 leading-relaxed">
          {mustImprove}
        </p>
      </div>

      {/* What could invalidate — hidden in compact */}
      {!compact && (
        <div>
          <div className="text-[7px] font-mono text-[#F87171]/60 uppercase tracking-widest mb-1">
            WHAT COULD INVALIDATE
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
  const thesisStr = thesisLevel(entry.rewardFeasibility);
  const contPressure = thesisLevel(entry.confirmationStrength);
  const invPressure = invalidationPressureLevel(
    entry.mainBlocker,
    entry.laggingOrBlockingMarket,
  );

  const rows: Array<{ label: string; value: string; color: string }> = [
    {
      label: "Thesis Strength",
      value: thesisStr,
      color: thesisColor(thesisStr),
    },
    {
      label: "Continuation Pressure",
      value: contPressure,
      color: thesisColor(contPressure),
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
}: EntryDetailCardProps) {
  const compact = mode === "compact";
  const permColor = permissionColor(entry.permissionLevel);
  const hasEvents = events && events.length > 0;

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
          <span
            className="text-[8px] font-mono px-1.5 py-0.5 rounded"
            style={{
              color: entry.permitted ? "#22C55E" : "#9CA3AF",
              background: entry.permitted ? "#05200f" : "#111418",
              border: `1px solid ${entry.permitted ? "#0f5030" : "#2a2f38"}`,
            }}
          >
            {entry.permitted ? "ENTRY OPEN" : "ENTRY CLOSED"}
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
        <ExecutionMapPanel entry={entry} priceData={priceData ?? null} />
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
