// D16 Hybrid v0.8 — Universe Asset Card
// Single ranked asset card for the Universe operator board.
// Mobile: full-width stacked. Desktop: used inside table row.
// v0.9 UX: Removed whyRanked chip array from card body (now in detail sheet only).
//          Removed ENTRY button — card tap (onSelect) is now the only action that opens detail.
//          Simplified card body for faster scanning on mobile.

import { useIsMobile } from "../hooks/use-mobile";
import type {
  TopEntryCategory,
  UniverseTopEntryRecord,
} from "../universeTypes";

// ─── Badge helpers ──────────────────────────────────────────────────────────

function PermissionPill({ level }: { level: string }) {
  const styles: Record<string, string> = {
    EXACT: "bg-[#052010] text-[#22C55E] border-[#0f5030]",
    PROVISIONAL: "bg-[#0d1a00] text-[#86EFAC] border-[#1a3500]",
    PROJECTED_ONLY: "bg-[#0d1a2e] text-[#4DA6FF] border-[#1a3a60]",
    WATCH_ONLY: "bg-[#1a1000] text-[#FACC15] border-[#3a2800]",
    BLOCKED: "bg-[#1a0505] text-[#EF4444] border-[#401010]",
  };
  const s = styles[level] ?? styles.BLOCKED;
  return (
    <span
      className={`px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded border ${s}`}
    >
      {level.replace("_", " ")}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    TIER_1: "text-[#67E8F9] bg-[#05182a] border-[#0d3060]",
    TIER_2: "text-[#a78bfa] bg-[#16082a] border-[#3d1a60]",
    TIER_3: "text-[#9AA3AD] bg-[#111418] border-[#22282f]",
    EXCLUDED: "text-[#EF4444] bg-[#1a0505] border-[#401010]",
  };
  const s = styles[tier] ?? styles.TIER_3;
  return (
    <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${s}`}>
      {tier.replace("_", " ")}
    </span>
  );
}

function SideBadge({ side }: { side: string }) {
  if (side === "LONG")
    return (
      <span className="text-[11px] font-mono font-bold text-[#22C55E]">
        ▲ LONG
      </span>
    );
  if (side === "SHORT")
    return (
      <span className="text-[11px] font-mono font-bold text-[#EF4444]">
        ▼ SHORT
      </span>
    );
  return <span className="text-[11px] font-mono text-[#9AA3AD]">— NONE</span>;
}

function ConfirmationBar({ value }: { value: number }) {
  const color =
    value >= 75
      ? "#22C55E"
      : value >= 50
        ? "#4DA6FF"
        : value >= 25
          ? "#FACC15"
          : "#EF4444";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded-full bg-[#1a1f26]">
        <div
          className="h-1 rounded-full transition-all"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground w-6 text-right">
        {value}
      </span>
    </div>
  );
}

// ─── Main card ──────────────────────────────────────────────────────────

type UniverseAssetCardProps = {
  record: UniverseTopEntryRecord;
  rank: number;
  onSelect: (asset: string) => void;
  isSelected: boolean;
  onWatch?: (asset: string) => void;
  /** @deprecated No longer renders a button; kept for API compat. */
  onOpenEntry?: (asset: string) => void;
};

export function UniverseAssetCard({
  record,
  rank,
  onSelect,
  isSelected,
  onWatch,
}: UniverseAssetCardProps) {
  const isMobile = useIsMobile();

  const borderColor = isSelected
    ? "border-[#4DA6FF]/60"
    : record.permissionLevel === "EXACT"
      ? "border-[#22C55E]/30"
      : record.permissionLevel === "PROVISIONAL"
        ? "border-[#86EFAC]/20"
        : "border-border/40";

  const bgColor = isSelected
    ? "bg-[#05182a]"
    : record.permissionLevel === "EXACT"
      ? "bg-[#030f07]"
      : "bg-[#0b0f14]";

  return (
    <button
      type="button"
      className={`w-full text-left rounded-lg border ${borderColor} ${bgColor} p-3 transition-all hover:opacity-90 active:scale-[0.99]`}
      onClick={() => onSelect(record.asset)}
      data-ocid={`universe.asset_card.${record.asset}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <span className="text-[11px] font-mono text-muted-foreground/50 w-5 flex-shrink-0">
            #{rank}
          </span>
          <span className="text-[15px] font-bold text-foreground font-mono">
            {record.asset}
          </span>
          <TierBadge tier={record.tier} />
          <SideBadge side={record.side} />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          <PermissionPill level={record.permissionLevel} />
          {onWatch && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onWatch(record.asset);
              }}
              className="min-h-[28px] text-[8px] font-mono px-1.5 py-1 rounded border border-[#FACC15]/30 text-[#FACC15]/70 bg-[#1a1000] hover:bg-[#2a1800] hover:text-[#FACC15] transition-colors"
              title="Add to Surveillance"
              data-ocid={`universe.asset_card.${record.asset}.watch_btn`}
            >
              WATCH
            </button>
          )}
        </div>
      </div>

      {/* Entry class + divergence row */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {record.entryClass !== "NONE" && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-accent/20 text-[#67E8F9] border border-[#1a4080]/40">
            {record.entryClass}
          </span>
        )}
        {record.divergenceType !== "NONE" && (
          <span className="text-[9px] font-mono text-muted-foreground/60">
            {record.divergenceType.replace(/_/g, " ")}
          </span>
        )}
        {record.leadMarket !== "NONE" && (
          <span className="text-[9px] font-mono text-[#a78bfa]/70">
            {record.leadMarket.replace(/_/g, " ")} →
          </span>
        )}
      </div>

      {/* Confirmation bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-wider">
            X-MKT CONF
          </span>
        </div>
        <ConfirmationBar value={record.crossMarketConfirmation} />
      </div>

      {/* Blocker / unlock row — one line only */}
      {record.mainBlocker ? (
        <div className="flex items-start gap-1.5 mt-1">
          <span className="text-[8px] font-mono text-[#EF4444]/70 uppercase flex-shrink-0">
            BLOCKED:
          </span>
          <span className="text-[8px] font-mono text-muted-foreground/60 leading-relaxed line-clamp-1">
            {record.mainBlocker}
          </span>
        </div>
      ) : record.nextUnlockCondition ? (
        <div className="flex items-start gap-1.5 mt-1">
          <span className="text-[8px] font-mono text-[#4DA6FF]/70 uppercase flex-shrink-0">
            NEXT:
          </span>
          <span className="text-[8px] font-mono text-muted-foreground/60 leading-relaxed line-clamp-1">
            {record.nextUnlockCondition}
          </span>
        </div>
      ) : null}

      {/* Footer: trust + tap hint */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
        <span className="text-[8px] font-mono text-muted-foreground/40">
          TRUST {record.runtimeTrust}
          {record.isStale ? " · STALE" : ""}
        </span>
        {record.outcomeEvidence.hasHistory && (
          <span className="text-[8px] font-mono text-[#a78bfa]/60">
            EV:{" "}
            {record.outcomeEvidence.patternPrecision !== null
              ? `${record.outcomeEvidence.patternPrecision}% prec`
              : "history"}
          </span>
        )}
        {isMobile && (
          <span className="text-[9px] font-mono text-muted-foreground/35 ml-auto">
            tap for detail ›
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Desktop table row variant ─────────────────────────────────────────────────────────────

type UniverseTableRowProps = {
  record: UniverseTopEntryRecord;
  rank: number;
  onSelect: (asset: string) => void;
  isSelected: boolean;
  onWatch?: (asset: string) => void;
  /** @deprecated No longer renders a button; kept for API compat. */
  onOpenEntry?: (asset: string) => void;
};

export function UniverseTableRow({
  record,
  rank,
  onSelect,
  isSelected,
  onWatch,
}: UniverseTableRowProps) {
  const rowBg = isSelected
    ? "bg-[#05182a]"
    : record.permissionLevel === "EXACT"
      ? "bg-[#030f07]"
      : "";
  return (
    <tr
      className={`border-b border-border/30 hover:bg-accent/10 cursor-pointer transition-colors ${rowBg}`}
      onClick={() => onSelect(record.asset)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(record.asset);
      }}
      data-ocid={`universe.table_row.${record.asset}`}
    >
      <td className="px-2 py-2 text-[9px] font-mono text-muted-foreground/50">
        {rank}
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold font-mono text-foreground">
            {record.asset}
          </span>
          {onWatch && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onWatch(record.asset);
              }}
              className="text-[7px] font-mono px-1 py-0.5 rounded border border-[#FACC15]/30 text-[#FACC15]/60 bg-[#1a1000] hover:bg-[#2a1800] hover:text-[#FACC15] transition-colors"
              title="Watch in Surveillance"
            >
              WATCH
            </button>
          )}
        </div>
      </td>
      <td className="px-2 py-2">
        <TierBadge tier={record.tier} />
      </td>
      <td className="px-2 py-2">
        <SideBadge side={record.side} />
      </td>
      <td className="px-2 py-2">
        <PermissionPill level={record.permissionLevel} />
      </td>
      <td className="px-2 py-2">
        <span className="text-[9px] font-mono text-[#67E8F9]">
          {record.entryClass !== "NONE" ? record.entryClass : "—"}
        </span>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1 min-w-[80px]">
          <div className="flex-1 h-1 rounded-full bg-[#1a1f26]">
            <div
              className="h-1 rounded-full"
              style={{
                width: `${record.crossMarketConfirmation}%`,
                background:
                  record.crossMarketConfirmation >= 75
                    ? "#22C55E"
                    : record.crossMarketConfirmation >= 50
                      ? "#4DA6FF"
                      : "#FACC15",
              }}
            />
          </div>
          <span className="text-[9px] font-mono text-muted-foreground w-5">
            {record.crossMarketConfirmation}
          </span>
        </div>
      </td>
      <td className="px-2 py-2">
        <span className="text-[8px] font-mono text-[#a78bfa]/70">
          {record.leadMarket !== "NONE"
            ? record.leadMarket.replace(/_/g, " ")
            : "—"}
        </span>
      </td>
      <td className="px-2 py-2">
        <span className="text-[8px] font-mono text-muted-foreground/50">
          {record.divergenceType !== "NONE"
            ? record.divergenceType.replace(/_/g, " ")
            : "—"}
        </span>
      </td>
      <td className="px-2 py-2">
        <span className="text-[8px] font-mono text-muted-foreground/40">
          {record.runtimeTrust}
        </span>
      </td>
      <td className="px-2 py-2 max-w-[180px]">
        {record.mainBlocker ? (
          <span
            className="text-[8px] font-mono text-[#EF4444]/70 truncate block"
            title={record.mainBlocker}
          >
            {record.mainBlocker}
          </span>
        ) : (
          <div className="flex gap-1 flex-wrap">
            {record.whyRanked.slice(0, 2).map((chip) => (
              <span
                key={chip}
                className="text-[8px] font-mono text-muted-foreground/50 bg-accent/20 px-1 rounded"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Category label ────────────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<TopEntryCategory, string> = {
  TOP_EXACT: "Exact Now",
  TOP_PROVISIONAL: "Provisional",
  TOP_WATCH: "Watch",
  TOP_FUTURES_LEADS_SPOT: "Futures Leads",
  TOP_SPOT_CONFIRMED: "Spot Confirms",
  TOP_BREAKOUT: "Breakout",
  TOP_RECLAIM: "Reclaim",
  TOP_PULLBACK: "Pullback",
  TOP_CONTINUATION: "Continuation",
  TOP_REVERSAL: "Reversal",
};

export const ALL_CATEGORIES: TopEntryCategory[] = [
  "TOP_EXACT",
  "TOP_PROVISIONAL",
  "TOP_WATCH",
  "TOP_FUTURES_LEADS_SPOT",
  "TOP_SPOT_CONFIRMED",
  "TOP_BREAKOUT",
  "TOP_RECLAIM",
  "TOP_PULLBACK",
  "TOP_CONTINUATION",
  "TOP_REVERSAL",
];
