// D16 Hybrid v0.7 — Outcome Replay View
// Full audit surface for a single snapshot and its forward outcomes.
// Answers: "What did the engine think at that moment, and what happened next?"

import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  HorizonResult,
  HybridOutcomeSnapshot,
  OutcomeClass,
  SnapshotOutcome,
} from "../outcomeTypes";

// ─── Color / label helpers ─────────────────────────────────────────────────────

const OUTCOME_COLOR: Record<OutcomeClass, string> = {
  STRONG_SUCCESS: "#22C55E",
  PARTIAL_SUCCESS: "#86EFAC",
  NEUTRAL: "#9AA3AD",
  EARLY_FALSE_POSITIVE: "#FACC15",
  FAILED: "#EF4444",
  INSUFFICIENT_FORWARD_DATA: "#6B7280",
};

const PERM_COLOR: Record<string, string> = {
  EXACT: "#22C55E",
  PROVISIONAL: "#86EFAC",
  PROJECTED_ONLY: "#67E8F9",
  WATCH_ONLY: "#FACC15",
  BLOCKED: "#EF4444",
};

function InfoRow({
  label,
  value,
  color = "#e2e8f0",
}: { label: string; value: string | null; color?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1 border-b border-border/20">
      <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider flex-shrink-0">
        {label}
      </span>
      <span
        className="text-[10px] font-mono font-semibold text-right"
        style={{ color }}
      >
        {value ?? "--"}
      </span>
    </div>
  );
}

function MarketCard({
  label,
  state,
}: {
  label: string;
  state: HybridOutcomeSnapshot["perMarket"]["binanceSpot"];
}) {
  if (!state) {
    return (
      <div className="bg-card border border-border/50 rounded p-3 space-y-2 opacity-40">
        <span className="text-[10px] font-mono font-semibold text-muted-foreground">
          {label}
        </span>
        <div className="text-[9px] font-mono text-muted-foreground/40">
          No data
        </div>
      </div>
    );
  }

  const trustColors: Record<string, string> = {
    HIGH_TRUST: "#22C55E",
    GOOD_TRUST: "#86EFAC",
    REDUCED_TRUST: "#FACC15",
    LOW_TRUST: "#F97316",
    INVALID_RUNTIME: "#EF4444",
  };

  const dirColors: Record<string, string> = {
    LONG: "#22C55E",
    SHORT: "#EF4444",
    NEUTRAL: "#9AA3AD",
  };

  return (
    <div className="bg-card border border-border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold text-foreground">
          {label}
        </span>
        <span
          className="text-[10px] font-mono font-bold"
          style={{ color: dirColors[state.direction] ?? "#9AA3AD" }}
        >
          {state.direction}
        </span>
      </div>
      <InfoRow label="Maturity" value={state.maturity} />
      <InfoRow
        label="Trust"
        value={state.trustClass}
        color={trustColors[state.trustClass] ?? "#9AA3AD"}
      />
      <InfoRow label="Permission" value={state.executionPermission} />
      <div className="grid grid-cols-3 gap-2 pt-1">
        {(
          [
            ["Struct", state.structuralScore],
            ["Activ", state.activationScore],
            ["Ready", state.entryReadiness],
          ] as [string, number][]
        ).map(([lbl, val]) => (
          <div key={lbl} className="text-center">
            <div className="text-[8px] font-mono text-muted-foreground/40">
              {lbl}
            </div>
            <div
              className="text-[11px] font-mono font-bold"
              style={{
                color:
                  val >= 60 ? "#22C55E" : val >= 40 ? "#FACC15" : "#EF4444",
              }}
            >
              {val}
            </div>
          </div>
        ))}
      </div>
      {state.mainBlocker && (
        <div className="text-[8px] font-mono text-[#F87171] leading-tight">
          ■ {state.mainBlocker}
        </div>
      )}
    </div>
  );
}

function HorizonCard({
  label,
  result,
}: {
  label: string;
  result: HorizonResult;
}) {
  const ret = result.returnPct;
  const correct = result.directionalCorrect;
  const color = ret === null ? "#9AA3AD" : ret > 0 ? "#22C55E" : "#EF4444";
  const correctLabel =
    correct === null ? "PENDING" : correct ? "CORRECT" : "WRONG";
  const correctColor =
    correct === null ? "#6B7280" : correct ? "#22C55E" : "#EF4444";

  return (
    <div className="bg-card border border-border rounded p-3 text-center space-y-2">
      <div className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
        +{label}
      </div>
      <div className="text-[18px] font-mono font-bold" style={{ color }}>
        {ret !== null ? `${ret > 0 ? "+" : ""}${ret.toFixed(2)}%` : "--"}
      </div>
      <div
        className="text-[9px] font-mono font-semibold"
        style={{ color: correctColor }}
      >
        {correctLabel}
      </div>
    </div>
  );
}

// ─── Main replay view ──────────────────────────────────────────────────────────────

export function OutcomeReplayView({
  snapshot,
  outcome,
  onBack,
}: {
  snapshot: HybridOutcomeSnapshot;
  outcome: SnapshotOutcome | null;
  onBack: () => void;
}) {
  const { hybrid, entry, perMarket, runtime, tags } = snapshot;
  const outcomeClass = outcome?.outcomeClass ?? null;

  // Engine verdict
  const engineVerdict =
    outcomeClass === null
      ? "PENDING EVALUATION"
      : outcomeClass === "STRONG_SUCCESS"
        ? "ENGINE WAS CORRECT — Thesis confirmed with strong excursion"
        : outcomeClass === "PARTIAL_SUCCESS"
          ? "ENGINE WAS CORRECT — Thesis confirmed but magnitude modest"
          : outcomeClass === "NEUTRAL"
            ? "ENGINE WAS INCONCLUSIVE — No meaningful move"
            : outcomeClass === "EARLY_FALSE_POSITIVE"
              ? "ENGINE WAS EARLY — Adverse move dominated before confirmation"
              : outcomeClass === "FAILED"
                ? "ENGINE WAS WRONG — Directional thesis contradicted"
                : "INSUFFICIENT DATA — Forward window not yet complete";

  return (
    <ScrollArea className="h-full">
      <div className="px-3 md:px-5 py-4 space-y-5">
        {/* Back button + header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-1">
            <button
              type="button"
              onClick={onBack}
              className="text-[9px] font-mono text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              ← BACK TO OUTCOMES
            </button>
            <div className="flex items-center gap-3">
              <span className="text-[18px] font-mono font-bold text-foreground">
                {snapshot.asset}
              </span>
              <span
                className="text-[11px] font-mono font-bold px-2 py-0.5 rounded border"
                style={{
                  color: PERM_COLOR[tags.permissionLevel] ?? "#9AA3AD",
                  borderColor: `${PERM_COLOR[tags.permissionLevel] ?? "#9AA3AD"}40`,
                  backgroundColor: `${PERM_COLOR[tags.permissionLevel] ?? "#9AA3AD"}15`,
                }}
              >
                {tags.permissionLevel}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {tags.entryClass !== "NONE" ? tags.entryClass : ""}
              </span>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/50">
              Captured: {new Date(snapshot.capturedAt).toLocaleString()} • Mode:{" "}
              {snapshot.mode} • Trigger:{" "}
              {snapshot.captureReason.replace(/_/g, " ")}
            </div>
          </div>

          {/* Outcome class */}
          {outcomeClass && (
            <div
              className="px-4 py-2 rounded border text-center flex-shrink-0"
              style={{
                color: OUTCOME_COLOR[outcomeClass],
                borderColor: `${OUTCOME_COLOR[outcomeClass]}40`,
                backgroundColor: `${OUTCOME_COLOR[outcomeClass]}10`,
              }}
            >
              <div className="text-[9px] font-mono opacity-60 uppercase tracking-widest mb-0.5">
                Outcome
              </div>
              <div className="text-[12px] font-mono font-bold">
                {outcomeClass.replace(/_/g, " ")}
              </div>
            </div>
          )}
        </div>

        {/* Engine verdict */}
        <div
          className="px-4 py-3 rounded border"
          style={{
            borderColor: outcomeClass
              ? `${OUTCOME_COLOR[outcomeClass]}30`
              : "#1a2a3a",
            backgroundColor: outcomeClass
              ? `${OUTCOME_COLOR[outcomeClass]}08`
              : "#0a0d14",
          }}
        >
          <div className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest mb-1">
            Engine Verdict
          </div>
          <div
            className="text-[11px] font-mono font-semibold"
            style={{
              color: outcomeClass ? OUTCOME_COLOR[outcomeClass] : "#9AA3AD",
            }}
          >
            {engineVerdict}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground/60 mt-1.5 leading-relaxed">
            {entry.reasoningSummary}
          </div>
        </div>

        {/* Forward outcomes */}
        {outcome && (
          <div className="space-y-2">
            <div className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
              Forward Outcomes — Ref Price:{" "}
              {outcome.referencePrice > 0
                ? `$${outcome.referencePrice.toLocaleString()}`
                : "N/A"}{" "}
              • Direction: {outcome.referenceDirection}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <HorizonCard label="15m" result={outcome.after15m} />
              <HorizonCard label="1h" result={outcome.after1h} />
              <HorizonCard label="4h" result={outcome.after4h} />
              <HorizonCard label="24h" result={outcome.after24h} />
            </div>
            {/* MFE / MAE */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card border border-[#0f5030] rounded p-3 flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-mono text-muted-foreground/50 uppercase">
                    Max Favorable Excursion (MFE)
                  </div>
                  <div className="text-[14px] font-mono font-bold text-[#22C55E]">
                    {outcome.mfePct !== null
                      ? `+${outcome.mfePct.toFixed(2)}%`
                      : "--"}
                  </div>
                </div>
                <span className="text-[24px] opacity-20">↗</span>
              </div>
              <div className="bg-card border border-[#401010] rounded p-3 flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-mono text-muted-foreground/50 uppercase">
                    Max Adverse Excursion (MAE)
                  </div>
                  <div className="text-[14px] font-mono font-bold text-[#EF4444]">
                    {outcome.maePct !== null
                      ? `${outcome.maePct.toFixed(2)}%`
                      : "--"}
                  </div>
                </div>
                <span className="text-[24px] opacity-20">↘</span>
              </div>
            </div>
          </div>
        )}

        {/* Per-market states */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
            Per-Market State at Capture
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MarketCard label="Binance Spot" state={perMarket.binanceSpot} />
            <MarketCard
              label="Binance Futures"
              state={perMarket.binanceFutures}
            />
            <MarketCard label="Coinbase Spot" state={perMarket.coinbaseSpot} />
          </div>
        </div>

        {/* Hybrid state */}
        <div className="bg-card border border-border rounded p-4 space-y-2">
          <div className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
            Hybrid Correlation
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
            <InfoRow
              label="Direction Agreement"
              value={`${hybrid.directionAgreement}`}
            />
            <InfoRow
              label="Maturity Agreement"
              value={`${hybrid.maturityAgreement}`}
            />
            <InfoRow
              label="Trust Agreement"
              value={`${hybrid.trustAgreement}`}
            />
            <InfoRow
              label="Structural Confirmation"
              value={`${hybrid.structuralConfirmation}`}
            />
            <InfoRow
              label="Cross-Market Conf."
              value={`${hybrid.crossMarketConfirmation}`}
            />
            <InfoRow
              label="Lead Market"
              value={hybrid.leadMarket}
              color="#67E8F9"
            />
            <InfoRow
              label="Lagging Market"
              value={String(hybrid.laggingMarket)}
            />
            <InfoRow
              label="Divergence Type"
              value={hybrid.divergenceType}
              color="#FACC15"
            />
            <InfoRow
              label="Hybrid Permission"
              value={hybrid.hybridPermission}
            />
          </div>
          {hybrid.mainBlocker && (
            <div className="text-[9px] font-mono text-[#F87171] pt-1">
              ■ {hybrid.mainBlocker}
            </div>
          )}
          {hybrid.nextUnlockCondition && (
            <div className="text-[9px] font-mono text-[#67E8F9]/60 pt-0.5">
              ↪ {hybrid.nextUnlockCondition}
            </div>
          )}
        </div>

        {/* Entry engine output */}
        <div className="bg-card border border-border rounded p-4 space-y-2">
          <div className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
            Entry Engine Output
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
            <InfoRow
              label="Permitted"
              value={entry.permitted ? "YES" : "NO"}
              color={entry.permitted ? "#22C55E" : "#EF4444"}
            />
            <InfoRow
              label="Side"
              value={entry.side}
              color={
                entry.side === "LONG"
                  ? "#22C55E"
                  : entry.side === "SHORT"
                    ? "#EF4444"
                    : "#9AA3AD"
              }
            />
            <InfoRow
              label="Entry Class"
              value={entry.entryClass}
              color="#67E8F9"
            />
            <InfoRow
              label="Permission Level"
              value={entry.permissionLevel}
              color={PERM_COLOR[entry.permissionLevel] ?? "#9AA3AD"}
            />
            <InfoRow
              label="Confirmation"
              value={`${entry.confirmationStrength}`}
            />
            <InfoRow
              label="Invalidation Clarity"
              value={`${entry.invalidationClarity}`}
            />
            <InfoRow
              label="Reward Feasibility"
              value={`${entry.rewardFeasibility}`}
            />
            <InfoRow
              label="Strongest Market"
              value={entry.strongestConfirmingMarket}
              color="#86EFAC"
            />
            <InfoRow
              label="Lagging/Blocking"
              value={entry.laggingOrBlockingMarket}
              color="#F97316"
            />
          </div>
          {entry.mainBlocker && (
            <div className="text-[9px] font-mono text-[#F87171] pt-1">
              ■ {entry.mainBlocker}
            </div>
          )}
        </div>

        {/* Runtime */}
        <div className="bg-card border border-border rounded p-3">
          <div className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Runtime at Capture
          </div>
          <div className="flex items-center gap-6 flex-wrap">
            <Stat label="Trust" value={`${runtime.overallTrust}`} />
            <Stat label="Connected" value={`${runtime.connectedMarkets}/3`} />
            <Stat label="Stale" value={`${runtime.staleMarkets}`} />
            <Stat
              label="Hybrid Ready"
              value={runtime.hybridReady ? "YES" : "NO"}
              color={runtime.hybridReady ? "#22C55E" : "#EF4444"}
            />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

function Stat({
  label,
  value,
  color = "#9AA3AD",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
        {label}
      </span>
      <span className="text-[11px] font-mono font-bold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
