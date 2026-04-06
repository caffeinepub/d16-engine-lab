// D16 Engine Lab — Candidate Detail Sheet
// Full-screen slide-up sheet for unified candidate detail.
// Shows Entry Detail first; optional collapsed Hybrid section below.
// Replaces both the old EntryBottomSheet (Universe) and SurveillanceCard inline expansion.

import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { EntryEngineOutput, HybridCorrelationState } from "../hybridTypes";
import type { HybridAssetBundle, PerMarketState } from "../hybridTypes";
import type { SurveillanceEvent } from "../surveillanceTypes";
import type { AssetPriceData } from "../universeTypes";
import { EntryDetailCard } from "./EntryDetailCard";

export type CandidateDetailSheetProps = {
  asset: string | null; // null = closed
  entryOutput: EntryEngineOutput | null;
  correlation: HybridCorrelationState | null;
  surveillanceEvents?: SurveillanceEvent[];
  hybridBundle: HybridAssetBundle | null;
  priceData?: AssetPriceData | null;
  isWatched: boolean;
  onClose: () => void;
  onWatch: (asset: string) => void;
  /** Pass the engine mode so the execution map integrity check can work.
   * When "MOCK", execution map shows "Live source required" instead of
   * simulated numbers. Defaults to "HYBRID_LIVE" (safe/live assumption). */
  engineMode?: string;
};

// ─── Permission color ────────────────────────────────────────────────────

function permColor(level: string | undefined): string {
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

// ─── Inline hybrid breakdown (lightweight, no HybridDetailInspector import) ─

function MetricBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 75
      ? "#22C55E"
      : value >= 60
        ? "#67E8F9"
        : value >= 40
          ? "#FACC15"
          : "#EF4444";
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[10px] font-mono font-bold" style={{ color }}>
          {Math.round(value)}
        </span>
      </div>
      <div
        className="h-1 rounded-full"
        style={{ background: "oklch(0.21 0.009 240)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function MarketStateCard({
  label,
  market,
}: { label: string; market: PerMarketState | null }) {
  if (!market) {
    return (
      <div className="rounded border border-border/30 bg-[#0a0e14] px-3 py-2">
        <div className="text-[9px] font-mono text-muted-foreground/50 mb-1">
          {label}
        </div>
        <div className="text-[8px] font-mono text-muted-foreground/30">
          No data
        </div>
      </div>
    );
  }
  const dirColor =
    market.direction === "LONG"
      ? "#22C55E"
      : market.direction === "SHORT"
        ? "#F87171"
        : "#9CA3AF";
  const trustColor =
    market.trustClass === "HIGH_TRUST"
      ? "#22C55E"
      : market.trustClass === "REDUCED_TRUST"
        ? "#FACC15"
        : "#EF4444";

  return (
    <div className="rounded border border-border/30 bg-[#0a0e14] px-3 py-2 space-y-1.5">
      <div className="text-[9px] font-mono text-muted-foreground/50">
        {label}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-mono font-bold"
          style={{ color: dirColor }}
        >
          {market.direction === "LONG"
            ? "▲ LONG"
            : market.direction === "SHORT"
              ? "▼ SHORT"
              : "— NONE"}
        </span>
        <span
          className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
          style={{
            color: trustColor,
            borderColor: `${trustColor}40`,
            background: `${trustColor}12`,
          }}
        >
          {market.trustClass.replace(/_/g, " ")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[8px] font-mono text-muted-foreground/40">
          Mat{" "}
        </span>
        <span className="text-[8px] font-mono text-muted-foreground/70">
          {market.maturity}
        </span>
        <span className="text-[8px] font-mono text-muted-foreground/30">·</span>
        <span className="text-[8px] font-mono text-muted-foreground/40">
          Str{" "}
        </span>
        <span className="text-[8px] font-mono text-muted-foreground/70">
          {market.structuralScore}
        </span>
      </div>
    </div>
  );
}

function HybridBreakdown({ bundle }: { bundle: HybridAssetBundle }) {
  const { assetState, correlation } = bundle;
  const leadColor = correlation.leadMarket !== "NONE" ? "#67E8F9" : "#9CA3AF";

  return (
    <div className="space-y-4">
      {/* Per-market grid */}
      <div>
        <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-2">
          Per-Market State
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MarketStateCard
            label="Binance Spot"
            market={assetState.binanceSpot}
          />
          <MarketStateCard
            label="Coinbase Spot"
            market={assetState.coinbaseSpot}
          />
          <MarketStateCard
            label="Binance Futures"
            market={assetState.binanceFutures}
          />
        </div>
      </div>

      {/* Agreement metrics */}
      <div>
        <div className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest mb-2">
          Agreement Metrics
        </div>
        <div className="bg-[#0a0e14] border border-border/30 rounded p-3 space-y-2.5">
          <MetricBar
            label="Direction Agreement"
            value={correlation.directionAgreement}
          />
          <MetricBar
            label="Maturity Agreement"
            value={correlation.maturityAgreement}
          />
          <MetricBar
            label="Trust Agreement"
            value={correlation.trustAgreement}
          />
          <MetricBar
            label="Structural Confirmation"
            value={correlation.structuralConfirmation}
          />
          <div className="pt-1.5 border-t border-border/20">
            <MetricBar
              label="Cross-Market Confirmation"
              value={correlation.crossMarketConfirmation}
            />
          </div>
        </div>
      </div>

      {/* Lead + Divergence */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="text-[9px] font-mono">
          <span className="text-muted-foreground/40">Lead </span>
          <span style={{ color: leadColor }}>
            {correlation.leadMarket !== "NONE"
              ? correlation.leadMarket.replace(/_/g, " ")
              : "—"}
          </span>
        </div>
        <div className="text-[9px] font-mono">
          <span className="text-muted-foreground/40">Lag </span>
          <span className="text-muted-foreground/70">
            {correlation.laggingMarket !== "NONE"
              ? correlation.laggingMarket.replace(/_/g, " ")
              : "—"}
          </span>
        </div>
        {correlation.divergenceType !== "NONE" && (
          <div className="text-[9px] font-mono">
            <span className="text-muted-foreground/40">Div </span>
            <span className="text-[#FACC15]/80">
              {correlation.divergenceType.replace(/_/g, " ")}
            </span>
          </div>
        )}
      </div>

      {/* Blocker / unlock */}
      {correlation.mainBlocker && (
        <div className="text-[9px] font-mono text-[#F87171]/80 leading-snug">
          ■ {correlation.mainBlocker}
        </div>
      )}
      {!correlation.mainBlocker && correlation.nextUnlockCondition && (
        <div className="text-[9px] font-mono text-[#67E8F9]/70 leading-snug">
          ↑ {correlation.nextUnlockCondition}
        </div>
      )}
    </div>
  );
}

// ─── Main sheet ──────────────────────────────────────────────────────────────

export function CandidateDetailSheet({
  asset,
  entryOutput,
  correlation,
  surveillanceEvents,
  hybridBundle,
  priceData,
  isWatched,
  onClose,
  onWatch,
  engineMode = "HYBRID_LIVE",
}: CandidateDetailSheetProps) {
  const [showHybrid, setShowHybrid] = useState(false);
  const isOpen = asset !== null && entryOutput !== null;
  const pColor = permColor(entryOutput?.permissionLevel);

  // Reset hybrid section when sheet changes asset
  // (intentionally simple — reopening to a new asset collapses hybrid)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cds-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.72)" }}
            onClick={onClose}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            role="button"
            tabIndex={0}
            aria-label="Close candidate detail"
          />

          {/* Sheet */}
          <motion.div
            key="cds-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl flex flex-col"
            style={{
              background: "oklch(0.09 0.008 240)",
              borderTop: `2px solid ${pColor}50`,
              maxHeight: "96vh",
              paddingBottom: "env(safe-area-inset-bottom, 8px)",
            }}
            data-ocid="candidate.detail.sheet"
          >
            {/* Header bar */}
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border/30">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                  className="w-1.5 h-5 rounded-full flex-shrink-0"
                  style={{ background: pColor }}
                />
                <span className="text-[15px] font-mono font-bold text-foreground truncate">
                  {asset}
                </span>
                {entryOutput && (
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0"
                    style={{
                      color: pColor,
                      borderColor: `${pColor}40`,
                      background: `${pColor}12`,
                    }}
                  >
                    {entryOutput.permissionLevel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isWatched && asset && (
                  <button
                    type="button"
                    onClick={() => onWatch(asset)}
                    className="text-[9px] font-mono px-2.5 py-1.5 rounded border transition-colors min-h-[32px]"
                    style={{
                      color: "#FACC15",
                      borderColor: "#FACC1540",
                      background: "#1a1000",
                    }}
                    data-ocid="candidate.detail.watch_button"
                  >
                    + WATCH
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors text-[16px] font-light"
                  data-ocid="candidate.detail.close_button"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 py-4 space-y-6">
                {/* Section 1 — Entry Detail */}
                <div>
                  {entryOutput && (
                    <EntryDetailCard
                      entry={entryOutput}
                      correlation={correlation ?? undefined}
                      mode="full"
                      events={surveillanceEvents}
                      priceData={priceData ?? null}
                      isLiveBacked={engineMode !== "MOCK"}
                    />
                  )}
                </div>

                {/* Section 2 — View Hybrid (collapsible) */}
                <div className="border-t border-border/20 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowHybrid((v) => !v)}
                    className="flex items-center gap-2 w-full text-left group mb-3"
                    data-ocid="candidate.detail.hybrid_toggle"
                  >
                    <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest group-hover:text-muted-foreground/80 transition-colors">
                      {showHybrid
                        ? "▲ HIDE HYBRID DETAIL"
                        : "▼ VIEW HYBRID DETAIL"}
                    </span>
                    <div className="flex-1 h-px bg-border/20" />
                  </button>

                  {showHybrid && (
                    <div data-ocid="candidate.detail.hybrid_section">
                      {hybridBundle ? (
                        <HybridBreakdown bundle={hybridBundle} />
                      ) : (
                        <div
                          className="text-[9px] font-mono leading-relaxed rounded px-3 py-2.5 border border-border/30"
                          style={{
                            color: "oklch(0.52 0.010 240)",
                            background: "oklch(0.11 0.007 240)",
                          }}
                        >
                          Hybrid state not available for this asset (requires
                          LIVE mode or Hybrid tab data).
                          <br />
                          <span className="opacity-60">
                            Switch to the Hybrid tab to inspect market-state
                            composition for the anchor assets.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
