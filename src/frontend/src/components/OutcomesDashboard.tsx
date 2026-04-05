// D16 Hybrid v0.7 — Outcomes Dashboard
// First-class analytics surface: 6 panels + full audit trail.
// Precision is reported honestly. No vanity metrics.

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useIsMobile } from "../hooks/use-mobile";
import type { HybridAssetBundle } from "../hybridTypes";
import type {
  BlockerEffectivenessRecord,
  OutcomeClass,
  PrecisionBucket,
  PrecisionMetrics,
} from "../outcomeTypes";
import type { OutcomeEngineResult } from "../useOutcomeEngine";
import { OutcomeReplayView } from "./OutcomeReplayView";

// ─── Color helpers ─────────────────────────────────────────────────────────────

function hitRateColor(rate: number | null): string {
  if (rate === null) return "#9AA3AD";
  if (rate >= 60) return "#22C55E";
  if (rate >= 45) return "#FACC15";
  return "#EF4444";
}

function returnColor(ret: number | null): string {
  if (ret === null) return "#9AA3AD";
  if (ret > 0) return "#22C55E";
  if (ret < 0) return "#EF4444";
  return "#9AA3AD";
}

const OUTCOME_CLASS_COLOR: Record<OutcomeClass, string> = {
  STRONG_SUCCESS: "#22C55E",
  PARTIAL_SUCCESS: "#86EFAC",
  NEUTRAL: "#9AA3AD",
  EARLY_FALSE_POSITIVE: "#FACC15",
  FAILED: "#EF4444",
  INSUFFICIENT_FORWARD_DATA: "#6B7280",
};

const OUTCOME_CLASS_LABEL: Record<OutcomeClass, string> = {
  STRONG_SUCCESS: "STRONG SUCCESS",
  PARTIAL_SUCCESS: "PARTIAL",
  NEUTRAL: "NEUTRAL",
  EARLY_FALSE_POSITIVE: "FALSE POS",
  FAILED: "FAILED",
  INSUFFICIENT_FORWARD_DATA: "PENDING",
};

// ─── Shared sub-components ────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      {sub && (
        <span className="text-[9px] font-mono text-muted-foreground/40">
          {sub}
        </span>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  color = "#9AA3AD",
  sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
        {label}
      </span>
      <span className="text-[14px] font-mono font-bold" style={{ color }}>
        {value}
      </span>
      {sub && (
        <span className="text-[9px] font-mono text-muted-foreground/40">
          {sub}
        </span>
      )}
    </div>
  );
}

function MiniBar({
  value,
  max = 100,
  color,
}: { value: number; max?: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function NoData({ msg = "No data yet" }: { msg?: string }) {
  return (
    <div className="py-8 text-center text-[11px] font-mono text-muted-foreground/40">
      {msg}
    </div>
  );
}

// ─── Panel 1: Outcome Summary ────────────────────────────────────────────────────

function OutcomeSummaryPanel({
  metrics,
  storageSnapshotCount,
  onRefresh,
}: {
  metrics: PrecisionMetrics | null;
  storageSnapshotCount: number;
  onRefresh: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded p-4 space-y-4">
      <SectionHeader title="Outcome Summary" sub="all evaluated snapshots" />
      {(!metrics || metrics.totalSnapshots === 0) &&
      storageSnapshotCount === 0 ? (
        <NoData msg="Capture snapshots to begin measuring precision." />
      ) : (!metrics || metrics.totalSnapshots === 0) &&
        storageSnapshotCount > 0 ? (
        <div className="flex items-center gap-2 px-4 py-6">
          <span className="text-[11px] font-mono text-muted-foreground/60">
            Computing metrics from {storageSnapshotCount} snapshots...
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="text-[10px] font-mono text-[#67E8F9] hover:underline"
          >
            REFRESH NOW
          </button>
        </div>
      ) : metrics ? (
        <>
          {/* Top stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCell
              label="Snapshots"
              value={metrics.totalSnapshots}
              color="#67E8F9"
            />
            <StatCell
              label="Evaluated"
              value={metrics.evaluatedSnapshots}
              color="#67E8F9"
            />
            <StatCell
              label="Lifecycles"
              value={metrics.totalLifecycles}
              color="#a78bfa"
            />
            <StatCell
              label="Open"
              value={metrics.openLifecycles}
              color="#FACC15"
            />
          </div>

          {/* Hit rates */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
              Directional Hit Rate
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(
                [
                  ["15m", metrics.overallHitRate15m],
                  ["1h", metrics.overallHitRate1h],
                  ["4h", metrics.overallHitRate4h],
                  ["24h", metrics.overallHitRate24h],
                ] as [string, number | null][]
              ).map(([label, rate]) => (
                <div key={label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">
                      {label}
                    </span>
                    <span
                      className="text-[11px] font-mono font-bold"
                      style={{ color: hitRateColor(rate) }}
                    >
                      {rate !== null ? `${rate}%` : "--"}
                    </span>
                  </div>
                  <MiniBar value={rate ?? 0} color={hitRateColor(rate)} />
                </div>
              ))}
            </div>
          </div>

          {/* Outcome class distribution */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
              Outcome Distribution
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {(
                Object.entries(metrics.outcomeClassDistribution) as [
                  OutcomeClass,
                  number,
                ][]
              ).map(
                ([cls, count]) =>
                  count > 0 && (
                    <div
                      key={cls}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-mono"
                      style={{
                        color: OUTCOME_CLASS_COLOR[cls],
                        borderColor: `${OUTCOME_CLASS_COLOR[cls]}40`,
                        backgroundColor: `${OUTCOME_CLASS_COLOR[cls]}15`,
                      }}
                    >
                      <span className="font-bold">{count}</span>
                      <span className="opacity-70">
                        {OUTCOME_CLASS_LABEL[cls]}
                      </span>
                    </div>
                  ),
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ─── Generic precision bucket table ──────────────────────────────────────────────

function PrecisionTable({
  title,
  sub,
  data,
  rowOrder,
}: {
  title: string;
  sub?: string;
  data: Record<string, PrecisionBucket>;
  rowOrder?: string[];
}) {
  const entries = rowOrder
    ? rowOrder.map((k) => data[k]).filter(Boolean)
    : Object.values(data).sort((a, b) => b.count - a.count);

  return (
    <div className="bg-card border border-border rounded p-4 space-y-3">
      <SectionHeader title={title} sub={sub} />
      {entries.length === 0 ? (
        <NoData />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-1.5 pr-3 text-muted-foreground/50 font-normal">
                  LABEL
                </th>
                <th className="text-right py-1.5 px-2 text-muted-foreground/50 font-normal">
                  N
                </th>
                <th className="text-right py-1.5 px-2 text-muted-foreground/50 font-normal">
                  HIT%
                </th>
                <th className="text-right py-1.5 px-2 text-muted-foreground/50 font-normal">
                  15m
                </th>
                <th className="text-right py-1.5 px-2 text-muted-foreground/50 font-normal">
                  1h
                </th>
                <th className="text-right py-1.5 px-2 text-muted-foreground/50 font-normal">
                  4h
                </th>
                <th className="text-right py-1.5 px-2 text-muted-foreground/50 font-normal">
                  24h
                </th>
                <th className="text-right py-1.5 px-2 text-muted-foreground/50 font-normal">
                  FAIL%
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((bucket) => (
                <tr
                  key={bucket.label}
                  className="border-b border-border/20 hover:bg-accent/5"
                >
                  <td className="py-1.5 pr-3 font-semibold text-foreground truncate max-w-[160px]">
                    {bucket.label}
                  </td>
                  <td className="text-right px-2 text-muted-foreground">
                    {bucket.count}
                  </td>
                  <td
                    className="text-right px-2 font-bold"
                    style={{ color: hitRateColor(bucket.hitRate) }}
                  >
                    {bucket.count > 0 ? `${bucket.hitRate}%` : "--"}
                  </td>
                  {(
                    [
                      bucket.avgReturn15m,
                      bucket.avgReturn1h,
                      bucket.avgReturn4h,
                      bucket.avgReturn24h,
                    ] as (number | null)[]
                  ).map((ret, idx) => (
                    <td
                      key={["15m", "1h", "4h", "24h"][idx]}
                      className="text-right px-2"
                      style={{ color: returnColor(ret) }}
                    >
                      {ret !== null
                        ? `${ret > 0 ? "+" : ""}${ret.toFixed(1)}%`
                        : "--"}
                    </td>
                  ))}
                  <td
                    className="text-right px-2"
                    style={{
                      color: bucket.failRate > 40 ? "#EF4444" : "#9AA3AD",
                    }}
                  >
                    {bucket.count > 0 ? `${bucket.failRate}%` : "--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Panel 5: Blocker Effectiveness ───────────────────────────────────────────────

function BlockerEffectivenessPanel({
  records,
}: {
  records: BlockerEffectivenessRecord[];
}) {
  const NET_VALUE_COLOR = {
    VALUABLE: "#22C55E",
    NEUTRAL: "#9AA3AD",
    OVER_CONSERVATIVE: "#FACC15",
  };

  return (
    <div className="bg-card border border-border rounded p-4 space-y-3">
      <SectionHeader
        title="Blocker Effectiveness"
        sub="blocked entries — would the block have been right?"
      />
      {records.length === 0 ? (
        <NoData msg="No blocked entry data yet." />
      ) : (
        <div className="space-y-2">
          {records.map((rec) => (
            <div
              key={rec.blocker}
              className="px-3 py-2.5 rounded border border-border bg-background/50 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-[10px] font-mono text-foreground font-medium leading-tight flex-1">
                  {rec.blocker}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {rec.appearances}x
                  </span>
                  <span
                    className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border"
                    style={{
                      color: NET_VALUE_COLOR[rec.netValue],
                      borderColor: `${NET_VALUE_COLOR[rec.netValue]}40`,
                      backgroundColor: `${NET_VALUE_COLOR[rec.netValue]}15`,
                    }}
                  >
                    {rec.netValue.replace("_", " ")}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[9px] font-mono text-muted-foreground/50">
                      Saved loss rate
                    </span>
                    <span
                      className="text-[9px] font-mono"
                      style={{
                        color: rec.savedLossRate >= 0.5 ? "#22C55E" : "#9AA3AD",
                      }}
                    >
                      {Math.round(rec.savedLossRate * 100)}%
                    </span>
                  </div>
                  <MiniBar value={rec.savedLossRate * 100} color="#22C55E" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[9px] font-mono text-muted-foreground/50">
                      Over-conservative
                    </span>
                    <span
                      className="text-[9px] font-mono"
                      style={{
                        color:
                          rec.overConservativeRate >= 0.5
                            ? "#FACC15"
                            : "#9AA3AD",
                      }}
                    >
                      {Math.round(rec.overConservativeRate * 100)}%
                    </span>
                  </div>
                  <MiniBar
                    value={rec.overConservativeRate * 100}
                    color="#FACC15"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Snapshot ledger table (audit trail) ────────────────────────────────────────

function SnapshotLedgerTable({
  engineResult,
  onReplay,
}: {
  engineResult: OutcomeEngineResult;
  onReplay: (snapshotId: string) => void;
}) {
  const { engineState } = engineResult;
  const { snapshots, outcomes } = engineState;

  const sorted = [...snapshots]
    .sort((a, b) => b.capturedAt - a.capturedAt)
    .slice(0, 50);

  return (
    <div className="bg-card border border-border rounded p-4 space-y-3">
      <SectionHeader
        title="Snapshot Ledger"
        sub={`${snapshots.length} total — showing last 50`}
      />
      {sorted.length === 0 ? (
        <NoData msg="No snapshots captured yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-1.5 pr-2 text-muted-foreground/50 font-normal">
                  TIME
                </th>
                <th className="text-left py-1.5 px-2 text-muted-foreground/50 font-normal">
                  ASSET
                </th>
                <th className="text-left py-1.5 px-2 text-muted-foreground/50 font-normal">
                  PERM
                </th>
                <th className="text-left py-1.5 px-2 text-muted-foreground/50 font-normal">
                  CLASS
                </th>
                <th className="text-left py-1.5 px-2 text-muted-foreground/50 font-normal">
                  DIVERGE
                </th>
                <th className="text-left py-1.5 px-2 text-muted-foreground/50 font-normal">
                  TRIGGER
                </th>
                <th className="text-left py-1.5 px-2 text-muted-foreground/50 font-normal">
                  OUTCOME
                </th>
                <th className="py-1.5 px-2" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((snap) => {
                const outcome = outcomes[snap.snapshotId];
                const cls = outcome?.outcomeClass;
                return (
                  <tr
                    key={snap.snapshotId}
                    className="border-b border-border/20 hover:bg-accent/5 cursor-pointer"
                    onClick={() => onReplay(snap.snapshotId)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && onReplay(snap.snapshotId)
                    }
                  >
                    <td className="py-1.5 pr-2 text-muted-foreground/60">
                      {new Date(snap.capturedAt).toLocaleTimeString()}
                    </td>
                    <td className="px-2 font-bold text-foreground">
                      {snap.asset}
                    </td>
                    <td className="px-2">
                      <PermBadge level={snap.tags.permissionLevel} />
                    </td>
                    <td className="px-2 text-muted-foreground">
                      {snap.tags.entryClass}
                    </td>
                    <td className="px-2 text-muted-foreground/70 max-w-[120px] truncate">
                      {snap.tags.divergenceType}
                    </td>
                    <td className="px-2 text-muted-foreground/50">
                      {snap.captureReason.replace(/_/g, " ")}
                    </td>
                    <td className="px-2">
                      {cls ? (
                        <span
                          className="text-[8px] font-semibold"
                          style={{ color: OUTCOME_CLASS_COLOR[cls] }}
                        >
                          {OUTCOME_CLASS_LABEL[cls]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                    <td className="px-2">
                      <span className="text-[8px] text-[#67E8F9]/60 hover:text-[#67E8F9]">
                        REPLAY →
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PermBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    EXACT: "#22C55E",
    PROVISIONAL: "#86EFAC",
    PROJECTED_ONLY: "#67E8F9",
    WATCH_ONLY: "#FACC15",
    BLOCKED: "#EF4444",
  };
  const color = colors[level] ?? "#9AA3AD";
  return (
    <span className="text-[8px] font-mono font-semibold" style={{ color }}>
      {level}
    </span>
  );
}

// ─── Dashboard tabs ────────────────────────────────────────────────────────────────

type DashTab =
  | "summary"
  | "precision"
  | "divergence"
  | "leadMarket"
  | "blockers"
  | "assets"
  | "ledger";

const DASH_TABS: { id: DashTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "precision", label: "Entry Precision" },
  { id: "divergence", label: "Divergence" },
  { id: "leadMarket", label: "Lead Market" },
  { id: "blockers", label: "Blockers" },
  { id: "assets", label: "Assets" },
  { id: "ledger", label: "Ledger" },
];

const PERMISSION_ORDER = [
  "EXACT",
  "PROVISIONAL",
  "PROJECTED_ONLY",
  "WATCH_ONLY",
  "BLOCKED",
];

const DIVERGENCE_ORDER = [
  "NONE",
  "FUTURES_LEADS_SPOT",
  "BINANCE_SPOT_LEADS_COINBASE",
  "COINBASE_LEADS_BINANCE_SPOT",
  "SPOT_CONFIRMS_FUTURES",
  "FUTURES_OVEREXTENDED",
  "SPOT_WEAKNESS_VS_FUTURES",
  "DIRECTION_CONFLICT",
  "TRUST_CONFLICT",
  "MATURITY_CONFLICT",
];

const LEAD_MARKET_ORDER = [
  "BINANCE_FUTURES",
  "BINANCE_SPOT",
  "COINBASE_SPOT",
  "NONE",
];

const ASSET_ORDER = ["BTC", "ETH", "SOL", "XRP", "DOGE", "ADA", "LINK", "AVAX"];

// ─── Main Dashboard ────────────────────────────────────────────────────────────────

type Props = {
  engineResult: OutcomeEngineResult;
  activeBundles: HybridAssetBundle[];
  onManualCapture: (asset: string) => void;
};

export function OutcomesDashboard({
  engineResult,
  activeBundles,
  onManualCapture,
}: Props) {
  const [activeTab, setActiveTab] = useState<DashTab>("summary");
  const isMobile = useIsMobile();
  const [replaySnapshotId, setReplaySnapshotId] = useState<string | null>(null);
  const { metrics, engineState, storageStats, clearAll, refreshMetrics } =
    engineResult;

  // Replay view
  if (replaySnapshotId) {
    const snap = engineState.snapshots.find(
      (s) => s.snapshotId === replaySnapshotId,
    );
    const outcome = engineState.outcomes[replaySnapshotId] ?? null;
    if (snap) {
      return (
        <div className="flex-1 h-full overflow-hidden">
          <OutcomeReplayView
            snapshot={snap}
            outcome={outcome}
            onBack={() => setReplaySnapshotId(null)}
          />
        </div>
      );
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-[#0a0d14] px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-[12px] font-mono font-semibold text-foreground">
              Outcomes — Precision Validation Layer
            </h2>
            <p className="text-[10px] text-muted-foreground/50">
              Measuring engine precision over time. Evidence before tuning.
            </p>
          </div>

          {/* Storage stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {(
                [
                  ["snaps", storageStats.snapshotCount],
                  ["outcomes", storageStats.outcomeCount],
                  ["lifecycles", storageStats.lifecycleCount],
                  [`~${storageStats.estimatedKB}KB`, ""],
                ] as [string, string | number][]
              ).map(([label, val]) => (
                <div key={label} className="flex items-center gap-1">
                  {val !== "" && (
                    <span className="text-[11px] font-mono font-bold text-[#67E8F9]">
                      {val}
                    </span>
                  )}
                  <span className="text-[9px] font-mono text-muted-foreground/40">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshMetrics}
                className="px-2.5 py-1 text-[9px] font-mono rounded border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors"
              >
                REFRESH
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Clear all outcome data? This cannot be undone.",
                    )
                  ) {
                    clearAll();
                  }
                }}
                className="px-2.5 py-1 text-[9px] font-mono rounded border border-[#401010] text-[#EF4444]/60 hover:text-[#EF4444] hover:border-[#EF4444]/50 transition-colors"
              >
                CLEAR
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard sub-tabs — dropdown on mobile, tabs on desktop */}
        {isMobile ? (
          <div className="mt-2 flex items-center gap-2">
            <Select
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as DashTab)}
            >
              <SelectTrigger
                className="h-8 text-[11px] bg-secondary border-border flex-1"
                data-ocid="outcomes.tab.select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {DASH_TABS.map(({ id, label }) => (
                  <SelectItem key={id} value={id} className="text-[11px]">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 mt-2 overflow-x-auto">
            {DASH_TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`px-2.5 py-1 text-[9px] font-mono font-medium rounded transition-colors flex-shrink-0 ${
                  activeTab === id
                    ? "bg-[#0d2540] text-[#67E8F9] border border-[#1a4080]"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/20"
                }`}
              >
                {label.toUpperCase()}
              </button>
            ))}

            {/* Manual capture for active asset */}
            {activeBundles.length > 0 && (
              <>
                <span className="w-px h-4 bg-border/40 mx-2 flex-shrink-0" />
                <span className="text-[9px] font-mono text-muted-foreground/40 mr-1">
                  CAPTURE:
                </span>
                {activeBundles.slice(0, 4).map((b) => (
                  <button
                    key={b.assetState.asset}
                    type="button"
                    onClick={() => onManualCapture(b.assetState.asset)}
                    className="px-2 py-0.5 text-[8px] font-mono rounded border border-[#1a4080]/60 text-[#67E8F9]/60 hover:text-[#67E8F9] hover:border-[#1a4080] transition-colors flex-shrink-0"
                  >
                    {b.assetState.asset}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="px-5 py-4 space-y-4">
          {activeTab === "summary" && (
            <OutcomeSummaryPanel
              metrics={metrics}
              storageSnapshotCount={storageStats.snapshotCount}
              onRefresh={refreshMetrics}
            />
          )}

          {activeTab === "precision" && (
            <PrecisionTable
              title="Entry Precision by Permission Level"
              sub="directional hit rate and return at each horizon"
              data={metrics?.byPermissionLevel ?? {}}
              rowOrder={PERMISSION_ORDER}
            />
          )}

          {activeTab === "divergence" && (
            <PrecisionTable
              title="Divergence Type Precision"
              sub="which divergence patterns are most predictive"
              data={metrics?.byDivergenceType ?? {}}
              rowOrder={DIVERGENCE_ORDER}
            />
          )}

          {activeTab === "leadMarket" && (
            <PrecisionTable
              title="Lead Market Precision"
              sub="which leading market produces the best outcomes"
              data={metrics?.byLeadMarket ?? {}}
              rowOrder={LEAD_MARKET_ORDER}
            />
          )}

          {activeTab === "blockers" && (
            <BlockerEffectivenessPanel
              records={metrics?.blockerEffectiveness ?? []}
            />
          )}

          {activeTab === "assets" && (
            <PrecisionTable
              title="Asset Precision"
              sub="per-asset hit rate and average returns"
              data={metrics?.byAsset ?? {}}
              rowOrder={ASSET_ORDER}
            />
          )}

          {activeTab === "ledger" && (
            <SnapshotLedgerTable
              engineResult={engineResult}
              onReplay={setReplaySnapshotId}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
