import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { D16State, Dimensions } from "../d16Engine";
import { getScoreColor } from "../d16Engine";
import { DIMENSION_LABELS, GROUP_DIMS, PRESET_SCENARIOS } from "../mockData";

type DimensionEditorProps = {
  dims: Dimensions;
  symbolName: string;
  onDimsChange: (dims: Dimensions) => void;
  onSymbolNameChange: (name: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  isSaving?: boolean;
  isEditing?: boolean;
  resolvedState: D16State;
  consoleLog: string[];
  onDimsCommit?: (dims: Dimensions) => void;
  /** When true, groups default to collapsible with only first open (mobile overlay mode) */
  isMobileOverlay?: boolean;
};

const GROUP_HEADERS: {
  key: keyof typeof GROUP_DIMS;
  label: string;
  shortLabel: string;
  color: string;
}[] = [
  {
    key: "contextBase",
    label: "Group A — Context Base",
    shortLabel: "A",
    color: "#67E8F9",
  },
  {
    key: "structuralTruth",
    label: "Group B — Structural Truth",
    shortLabel: "B",
    color: "#86EFAC",
  },
  {
    key: "executionFeasibility",
    label: "Group C — Execution Feasibility",
    shortLabel: "C",
    color: "#FACC15",
  },
  {
    key: "reliability",
    label: "Group D — Reliability",
    shortLabel: "D",
    color: "#F87171",
  },
];

export function DimensionEditor({
  dims,
  symbolName,
  onDimsChange,
  onSymbolNameChange,
  onSave,
  onDelete,
  isSaving,
  isEditing,
  resolvedState,
  consoleLog,
  onDimsCommit,
  isMobileOverlay = false,
}: DimensionEditorProps) {
  const [presetValue, setPresetValue] = useState<string>("");
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDimsRef = useRef<Dimensions>(dims);

  // Collapsible group state: on mobile overlay, only first group open by default
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    isMobileOverlay
      ? {
          contextBase: true,
          structuralTruth: false,
          executionFeasibility: false,
          reliability: false,
        }
      : {
          contextBase: true,
          structuralTruth: true,
          executionFeasibility: true,
          reliability: true,
        },
  );

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSliderChange = useCallback(
    (key: keyof Dimensions, value: number[]) => {
      const newDims = { ...dims, [key]: value[0] };
      latestDimsRef.current = newDims;
      onDimsChange(newDims);
    },
    [dims, onDimsChange],
  );

  // Commit audit on pointer up with 400ms debounce
  const handleSliderPointerUp = useCallback(() => {
    if (!onDimsCommit) return;
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      onDimsCommit(latestDimsRef.current);
    }, 400);
  }, [onDimsCommit]);

  const handlePresetSelect = useCallback(
    (presetName: string) => {
      const preset = PRESET_SCENARIOS.find((p) => p.name === presetName);
      if (preset) {
        onDimsChange(preset.dims);
        onSymbolNameChange(preset.name);
        setPresetValue(presetName);
      }
    },
    [onDimsChange, onSymbolNameChange],
  );

  return (
    <div className="flex flex-col h-full" data-ocid="editor.panel">
      {/* Header (hidden on mobile overlay since App.tsx handles the title) */}
      {!isMobileOverlay && (
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-foreground tracking-wide">
            Dimension Editor
          </h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Manual input — live resolver
          </p>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-4">
          {/* Preset Selector */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Preset Scenario
            </span>
            <Select value={presetValue} onValueChange={handlePresetSelect}>
              <SelectTrigger
                className="h-9 text-[11px] bg-secondary border-border"
                data-ocid="editor.select"
              >
                <SelectValue placeholder="Load a preset..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {PRESET_SCENARIOS.map((p) => (
                  <SelectItem
                    key={p.name}
                    value={p.name}
                    className="text-[11px]"
                  >
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-border" />

          {/* Dimension Sliders grouped (collapsible) */}
          {GROUP_HEADERS.map(({ key, label, shortLabel, color }) => {
            const isOpen = openGroups[key] ?? true;
            return (
              <div key={key} className="space-y-0">
                {/* Group header — tap to collapse */}
                <button
                  type="button"
                  onClick={() => toggleGroup(key)}
                  className="w-full flex items-center justify-between py-2 gap-2 transition-colors hover:bg-accent/10 rounded"
                  data-ocid={`editor.group_${shortLabel}.toggle`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: color }}
                    />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color }}
                    >
                      {label}
                    </span>
                  </div>
                  <span className="text-muted-foreground/50">
                    {isOpen ? (
                      <ChevronDown size={13} />
                    ) : (
                      <ChevronRight size={13} />
                    )}
                  </span>
                </button>

                {/* Sliders — shown when group is open */}
                {isOpen && (
                  <div className="space-y-3 pb-3">
                    {GROUP_DIMS[key].map((dimKey) => {
                      const val = dims[dimKey];
                      const col = getScoreColor(val);
                      const label2 = DIMENSION_LABELS[dimKey];

                      return (
                        <div
                          key={dimKey}
                          className="space-y-1 min-h-[44px]"
                          data-ocid={`editor.${dimKey}.input`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">
                              {label2}
                            </span>
                            <span
                              className="text-[11px] font-mono font-semibold"
                              style={{ color: col }}
                            >
                              {val.toFixed(0)}
                            </span>
                          </div>
                          <Slider
                            min={0}
                            max={100}
                            step={1}
                            value={[val]}
                            onValueChange={(v) => handleSliderChange(dimKey, v)}
                            onPointerUp={handleSliderPointerUp}
                            className="d16-slider"
                            style={
                              { "--thumb-color": col } as React.CSSProperties
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <Separator className="bg-border opacity-50" />
              </div>
            );
          })}

          {/* Save controls */}
          <div className="space-y-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Save Scenario
            </span>
            <Input
              value={symbolName}
              onChange={(e) => onSymbolNameChange(e.target.value)}
              placeholder="Scenario name..."
              className="h-9 text-[12px] bg-secondary border-border font-mono"
              data-ocid="editor.name_input"
            />
            <div className="flex gap-2">
              <Button
                onClick={onSave}
                disabled={isSaving || !symbolName.trim()}
                size="sm"
                className="flex-1 h-9 text-[12px] bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                data-ocid="editor.save_button"
              >
                {isSaving
                  ? "Saving..."
                  : isEditing
                    ? "Update"
                    : "Save Scenario"}
              </Button>
              {onDelete && (
                <Button
                  onClick={onDelete}
                  size="sm"
                  variant="destructive"
                  className="h-9 text-[12px]"
                  data-ocid="editor.delete_button"
                >
                  Delete
                </Button>
              )}
            </div>
          </div>

          {/* Live Console */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Resolver Log
            </span>
            <div className="bg-[#0a0c10] border border-border rounded p-2 min-h-[80px] max-h-[120px] overflow-y-auto">
              {consoleLog.length === 0 ? (
                <p className="text-[10px] font-mono text-muted-foreground">
                  Awaiting resolver events...
                </p>
              ) : (
                consoleLog.slice(-5).map((line) => (
                  <p
                    key={line}
                    className="text-[10px] font-mono text-[#86EFAC] leading-5"
                  >
                    {line}
                  </p>
                ))
              )}
            </div>
          </div>

          {/* Current resolved state summary */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Current Resolution
            </span>
            <div
              className="bg-[#0a0c10] border border-border rounded p-2 space-y-1"
              data-ocid="editor.resolver_output"
            >
              <div className="flex justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">
                  maturity
                </span>
                <span className="text-[10px] font-mono text-foreground">
                  {resolvedState.canonical.maturity}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">
                  direction
                </span>
                <span className="text-[10px] font-mono text-foreground">
                  {resolvedState.canonical.direction}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">
                  execution
                </span>
                <span className="text-[10px] font-mono text-foreground">
                  {resolvedState.canonical.executionPermission}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">
                  priority
                </span>
                <span className="text-[10px] font-mono text-foreground">
                  {resolvedState.canonical.operatorPriority}
                </span>
              </div>
              {resolvedState.canonical.mainBlocker && (
                <div className="pt-1 border-t border-border">
                  <span className="text-[10px] font-mono text-[#F87171]">
                    ■ {resolvedState.canonical.mainBlocker}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
