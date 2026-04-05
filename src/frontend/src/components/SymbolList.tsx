import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { D16State, RankingMode } from "../d16Engine";
import { DirectionBadge, MaturityBadge, PriorityBadge } from "./D16Badges";

type SymbolListProps = {
  states: D16State[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewScenario: () => void;
  rankingMode: RankingMode;
};

export function SymbolList({
  states,
  selectedId,
  onSelect,
  onNewScenario,
  rankingMode,
}: SymbolListProps) {
  return (
    <div className="flex flex-col h-full" data-ocid="sidebar.panel">
      {/* Brand Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-primary/20 border border-primary/40 flex items-center justify-center flex-shrink-0">
            <span className="text-[8px] font-mono font-bold text-primary">
              D16
            </span>
          </div>
          <div>
            <div className="text-[13px] font-bold tracking-widest text-foreground">
              D16
            </div>
            <div className="text-[9px] text-muted-foreground tracking-widest uppercase">
              Engine Lab
            </div>
          </div>
        </div>
      </div>

      {/* Symbol List Header */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Scenarios ({states.length})
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {rankingMode}
        </span>
      </div>

      {/* Symbol Entries */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {states.length === 0 ? (
            <div
              className="px-4 py-8 text-center"
              data-ocid="sidebar.empty_state"
            >
              <p className="text-[11px] text-muted-foreground">
                No scenarios yet
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Save one or load a preset
              </p>
            </div>
          ) : (
            states.map((s, idx) => {
              const isActive = s.id
                ? s.id.toString() === selectedId
                : s.symbol === selectedId;
              return (
                <button
                  type="button"
                  key={s.id?.toString() ?? s.symbol}
                  onClick={() => onSelect(s.id ? s.id.toString() : s.symbol)}
                  className={`w-full text-left px-4 py-2.5 transition-colors hover:bg-accent/30 border-b border-border/40 ${
                    isActive ? "bg-accent/50 border-l-2 border-l-primary" : ""
                  }`}
                  data-ocid={`sidebar.item.${idx + 1}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            s.canonical.maturity === "LIVE"
                              ? "bg-[#22C55E] d16-pulse"
                              : s.canonical.maturity === "DECAY" ||
                                  s.canonical.maturity === "CANCELLED"
                                ? "bg-[#EF4444]"
                                : "bg-[#4DA6FF]"
                          }`}
                        />
                        <span className="text-[11px] font-semibold truncate text-foreground">
                          {s.symbol}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <MaturityBadge
                          maturity={s.canonical.maturity}
                          size="sm"
                        />
                        <DirectionBadge direction={s.canonical.direction} />
                      </div>
                    </div>
                    <PriorityBadge priority={s.canonical.operatorPriority} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* New Scenario Button */}
      <div className="flex-shrink-0 p-4 border-t border-border">
        <Button
          onClick={onNewScenario}
          size="sm"
          className="w-full h-8 text-[11px] bg-secondary hover:bg-accent border border-border text-foreground"
          data-ocid="sidebar.new_scenario_button"
        >
          + New Scenario
        </Button>
      </div>
    </div>
  );
}
