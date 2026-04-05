// D16 Hybrid Branch — Entry Board
// Phase H9 + v0.7.1 Mobile Adaptation

import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo, useState } from "react";
import { useIsMobile } from "../hooks/use-mobile";
import type { HybridAssetBundle } from "../hybridTypes";
import { DivergenceBadge } from "./HybridDashboard";

type EntryBoardProps = {
  bundles: HybridAssetBundle[];
  onSelectAsset: (asset: string) => void;
  _dataSource?: "MOCK" | "LIVE";
};

type FilterMode = "all" | "long" | "short" | "permitted" | "projected_plus";

const PERMISSION_RANK: Record<string, number> = {
  EXACT: 5,
  PROVISIONAL: 4,
  PROJECTED_ONLY: 3,
  WATCH_ONLY: 2,
  BLOCKED: 1,
};

function EntryClassBadge({ cls }: { cls: string }) {
  const MAP: Record<string, string> = {
    NONE: "text-[#9AA3AD] bg-[#1a1a2e] border-[#2A3038]",
    BREAKOUT: "text-[#22C55E] bg-[#052010] border-[#0f5030]",
    RECLAIM: "text-[#67E8F9] bg-[#0d2540] border-[#1a4080]",
    PULLBACK: "text-[#FACC15] bg-[#1a1a10] border-[#3a3010]",
    CONTINUATION: "text-[#10b981] bg-[#051a10] border-[#0f4030]",
    REVERSAL: "text-[#FB923C] bg-[#1a0a00] border-[#3a2000]",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono border font-bold ${
        MAP[cls] ?? MAP.NONE
      }`}
    >
      {cls}
    </span>
  );
}

function PermissionBadge({ level }: { level: string }) {
  const MAP: Record<string, string> = {
    EXACT: "bg-[#052010] text-[#22C55E] border-[#0f5030]",
    PROVISIONAL: "bg-[#0d2540] text-[#67E8F9] border-[#1a4080]",
    PROJECTED_ONLY: "bg-[#0d1a40] text-[#93C5FD] border-[#1a3080]",
    WATCH_ONLY: "bg-[#1a1a10] text-[#FACC15] border-[#3a3010]",
    BLOCKED: "bg-[#200a0a] text-[#EF4444] border-[#4a1010]",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono border ${
        MAP[level] ?? MAP.BLOCKED
      }`}
    >
      {level}
    </span>
  );
}

function MarketBadge({ market }: { market: string }) {
  const MAP: Record<string, { label: string; color: string }> = {
    BINANCE_FUTURES: { label: "FUTURES", color: "#67E8F9" },
    BINANCE_SPOT: { label: "BN-SPOT", color: "#86EFAC" },
    COINBASE_SPOT: { label: "CB-SPOT", color: "#86EFAC" },
    MULTI_MARKET: { label: "MULTI", color: "#FACC15" },
    MULTIPLE: { label: "MULTIPLE", color: "#FACC15" },
    NONE: { label: "—", color: "#9AA3AD" },
  };
  const { label, color } = MAP[market] ?? { label: market, color: "#9AA3AD" };
  return (
    <span className="text-[9px] font-mono font-bold" style={{ color }}>
      {label}
    </span>
  );
}

const FILTER_LABELS: { id: FilterMode; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "long", label: "LONG" },
  { id: "short", label: "SHORT" },
  { id: "permitted", label: "PERMITTED ONLY" },
  { id: "projected_plus", label: "PROJECTED+" },
];

// ─── Mobile asset card ───

function MobileEntryCard({
  bundle,
  onSelectAsset,
  rank,
}: {
  bundle: HybridAssetBundle;
  onSelectAsset: (asset: string) => void;
  rank: number;
}) {
  const { entry } = bundle;
  const isBlocked = entry.permissionLevel === "BLOCKED";

  return (
    <button
      type="button"
      onClick={() => onSelectAsset(entry.asset)}
      className={`w-full text-left bg-card border rounded-lg p-4 transition-colors hover:bg-secondary/20 ${
        isBlocked ? "opacity-50" : "border-border"
      }`}
      style={{
        borderLeft:
          entry.side === "LONG"
            ? "3px solid #22C55E"
            : entry.side === "SHORT"
              ? "3px solid #EF4444"
              : undefined,
      }}
      data-ocid={`entry.board.item.${rank}`}
    >
      {/* Row 1: Asset + side + permission */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-mono font-bold text-foreground">
            {entry.asset}
          </span>
          {entry.side === "LONG" && (
            <span className="text-[11px] font-mono text-[#22C55E] font-bold">
              ▲ LONG
            </span>
          )}
          {entry.side === "SHORT" && (
            <span className="text-[11px] font-mono text-[#EF4444] font-bold">
              ▼ SHORT
            </span>
          )}
        </div>
        <PermissionBadge level={entry.permissionLevel} />
      </div>

      {/* Row 2: Entry class + confirmation */}
      <div className="flex items-center gap-3 mb-2">
        <EntryClassBadge cls={entry.entryClass} />
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono text-muted-foreground/50">
            CONF:
          </span>
          <span
            className="text-[11px] font-mono font-bold"
            style={{
              color:
                entry.confirmationStrength >= 75
                  ? "#22C55E"
                  : entry.confirmationStrength >= 60
                    ? "#67E8F9"
                    : entry.confirmationStrength >= 40
                      ? "#FACC15"
                      : "#EF4444",
            }}
          >
            {Math.round(entry.confirmationStrength)}
          </span>
        </div>
      </div>

      {/* Row 3: Markets */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono text-muted-foreground/50">
            STRONG:
          </span>
          <MarketBadge market={entry.strongestConfirmingMarket} />
        </div>
        {entry.laggingOrBlockingMarket !== "NONE" && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-mono text-muted-foreground/50">
              BLOCK:
            </span>
            <MarketBadge market={entry.laggingOrBlockingMarket} />
          </div>
        )}
      </div>

      {/* Row 4: Blocker */}
      {entry.mainBlocker && (
        <p className="text-[10px] font-mono text-[#F87171] truncate">
          ■ {entry.mainBlocker}
        </p>
      )}

      <div className="flex justify-end mt-1">
        <span className="text-[9px] font-mono text-muted-foreground/40">
          Inspect →
        </span>
      </div>
    </button>
  );
}

export function EntryBoard({
  bundles,
  onSelectAsset,
  _dataSource = "MOCK",
}: EntryBoardProps) {
  const [filter, setFilter] = useState<FilterMode>("all");
  const isMobile = useIsMobile();

  const filtered = useMemo(() => {
    return bundles
      .filter((b) => {
        if (filter === "long") return b.entry.side === "LONG";
        if (filter === "short") return b.entry.side === "SHORT";
        if (filter === "permitted") return b.entry.permitted;
        if (filter === "projected_plus")
          return ["PROJECTED_ONLY", "PROVISIONAL", "EXACT"].includes(
            b.entry.permissionLevel,
          );
        return true;
      })
      .sort((a, b) => {
        const csDiff =
          b.entry.confirmationStrength - a.entry.confirmationStrength;
        if (Math.abs(csDiff) > 1) return csDiff;
        return (
          (PERMISSION_RANK[b.entry.permissionLevel] ?? 0) -
          (PERMISSION_RANK[a.entry.permissionLevel] ?? 0)
        );
      });
  }, [bundles, filter]);

  // Summary counts
  const permitted = bundles.filter((b) => b.entry.permitted).length;
  const projected = bundles.filter(
    (b) => b.entry.permissionLevel === "PROJECTED_ONLY",
  ).length;
  const watchOnly = bundles.filter(
    (b) => b.entry.permissionLevel === "WATCH_ONLY",
  ).length;
  const blocked = bundles.filter(
    (b) => b.entry.permissionLevel === "BLOCKED",
  ).length;

  return (
    <div className="flex flex-col h-full" data-ocid="entry.board.panel">
      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-5 py-3 border-b border-border bg-background/60">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-[13px] font-semibold text-foreground">
            Entry Board
          </h2>
          <div className="flex items-center gap-2 md:gap-3 text-[10px] font-mono flex-wrap">
            <span>
              <span className="text-[#22C55E] font-bold">{permitted}</span>{" "}
              permitted
            </span>
            <span className="text-border hidden md:inline">|</span>
            <span className="hidden md:inline">
              <span className="text-[#93C5FD] font-bold">{projected}</span>{" "}
              projected
            </span>
            <span className="text-border hidden md:inline">|</span>
            <span className="hidden md:inline">
              <span className="text-[#FACC15] font-bold">{watchOnly}</span>{" "}
              watch-only
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="text-[#EF4444] font-bold">{blocked}</span>{" "}
              blocked
            </span>
          </div>
        </div>

        {/* Filter row — horizontally scrollable on mobile */}
        <div
          className="flex items-center gap-1 overflow-x-auto"
          data-ocid="entry.board.filter.tab"
        >
          {FILTER_LABELS.map(({ id, label }) => (
            <button
              type="button"
              key={id}
              onClick={() => setFilter(id)}
              className={`px-2.5 py-1.5 text-[10px] font-mono rounded transition-colors flex-shrink-0 ${
                filter === id
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30 border border-transparent"
              }`}
              data-ocid={`entry.board.${id}.tab`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="px-3 md:px-5 py-3">
          {filtered.length === 0 ? (
            <div
              className="text-center py-12 text-muted-foreground text-[11px] font-mono border border-dashed border-border rounded"
              data-ocid="entry.board.empty_state"
            >
              No entries match the current filter.
            </div>
          ) : isMobile ? (
            /* Mobile: cards */
            <div className="space-y-3">
              {filtered.map((bundle, i) => (
                <MobileEntryCard
                  key={bundle.entry.asset}
                  bundle={bundle}
                  onSelectAsset={onSelectAsset}
                  rank={i + 1}
                />
              ))}
            </div>
          ) : (
            /* Desktop: table */
            <div className="border border-border rounded overflow-hidden">
              <table
                className="w-full text-[10px] font-mono"
                data-ocid="entry.board.table"
              >
                <thead>
                  <tr className="bg-secondary border-b border-border text-muted-foreground">
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Asset
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Side
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Entry Class
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Permission
                    </th>
                    <th className="px-3 py-2 text-right uppercase tracking-wider font-semibold">
                      Confirm
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Strongest Mkt
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Blocking Mkt
                    </th>
                    <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                      Main Blocker
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((bundle, i) => {
                    const { entry } = bundle;
                    const isBlocked = entry.permissionLevel === "BLOCKED";
                    const isLong = entry.side === "LONG";
                    const isShort = entry.side === "SHORT";

                    return (
                      <tr
                        key={entry.asset}
                        onClick={() => onSelectAsset(entry.asset)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && onSelectAsset(entry.asset)
                        }
                        className={`border-b border-border/50 cursor-pointer transition-colors ${
                          isBlocked
                            ? "opacity-40 hover:opacity-60"
                            : "hover:bg-secondary/30"
                        }`}
                        style={{
                          borderLeft: isLong
                            ? "2px solid #22C55E"
                            : isShort
                              ? "2px solid #EF4444"
                              : undefined,
                        }}
                        data-ocid={`entry.board.item.${i + 1}`}
                      >
                        <td className="px-3 py-2 font-bold text-foreground text-[11px]">
                          {entry.asset}
                        </td>
                        <td className="px-3 py-2">
                          {entry.side === "LONG" ? (
                            <span className="text-[#22C55E]">▲ LONG</span>
                          ) : entry.side === "SHORT" ? (
                            <span className="text-[#EF4444]">▼ SHORT</span>
                          ) : (
                            <span className="text-[#9AA3AD]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <EntryClassBadge cls={entry.entryClass} />
                        </td>
                        <td className="px-3 py-2">
                          <PermissionBadge level={entry.permissionLevel} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className="font-bold"
                            style={{
                              color:
                                entry.confirmationStrength >= 75
                                  ? "#22C55E"
                                  : entry.confirmationStrength >= 60
                                    ? "#67E8F9"
                                    : entry.confirmationStrength >= 40
                                      ? "#FACC15"
                                      : "#EF4444",
                            }}
                          >
                            {Math.round(entry.confirmationStrength)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <MarketBadge
                            market={entry.strongestConfirmingMarket}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <MarketBadge market={entry.laggingOrBlockingMarket} />
                        </td>
                        <td className="px-3 py-2 max-w-[160px]">
                          {entry.mainBlocker ? (
                            <span className="text-[#F87171] truncate block">
                              {entry.mainBlocker.slice(0, 38)}
                              {entry.mainBlocker.length > 38 ? "…" : ""}
                            </span>
                          ) : (
                            <span className="text-[#22C55E]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export { DivergenceBadge };
