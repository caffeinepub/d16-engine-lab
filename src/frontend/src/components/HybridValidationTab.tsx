// D16 Hybrid Branch — Hybrid Validation Tab
// Phase H10: Hybrid validation harness for resolver and entry engine

import { ScrollArea } from "@/components/ui/scroll-area";
import { useCallback, useMemo, useState } from "react";
import {
  type HybridValidationResult,
  runHybridValidation,
} from "../hybridValidationData";

type HybridValidationTabProps = Record<string, never>;

function PassBadge({ pass }: { pass: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ${
        pass
          ? "bg-[#052010] text-[#22C55E] border border-[#0f5030]"
          : "bg-[#200a0a] text-[#EF4444] border border-[#4a1010]"
      }`}
    >
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}

function FieldRow({
  field,
  expected,
  actual,
  pass,
}: {
  field: string;
  expected: string;
  actual: string;
  pass: boolean;
}) {
  return (
    <tr className="border-t border-border/30">
      <td className="py-1.5 text-muted-foreground text-[10px] font-mono w-32">
        {field}
      </td>
      <td className="py-1.5 text-[10px] font-mono text-[#67E8F9]">
        {expected}
      </td>
      <td
        className="py-1.5 text-[10px] font-mono"
        style={{ color: pass ? "#22C55E" : "#F87171" }}
      >
        {actual}
      </td>
      <td className="py-1.5 text-center">
        <PassBadge pass={pass} />
      </td>
    </tr>
  );
}

export function HybridValidationTab(_props: HybridValidationTabProps) {
  const [results, setResults] = useState<HybridValidationResult[] | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [hasRun, setHasRun] = useState(false);

  const handleRun = useCallback(() => {
    const r = runHybridValidation();
    setResults(r);
    setHasRun(true);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const summary = useMemo(() => {
    if (!results) return null;
    const total = results.length;
    const passed = results.filter((r) => r.overallPass).length;
    const failed = total - passed;
    return { total, passed, failed };
  }, [results]);

  return (
    <div className="flex flex-col h-full" data-ocid="hybrid.validation.panel">
      <ScrollArea className="flex-1">
        <div className="px-5 py-4 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-foreground uppercase tracking-wider">
                Hybrid Validation Harness
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                11 canonical scenarios across all hybrid architecture layers
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasRun && (
                <button
                  type="button"
                  onClick={handleRun}
                  className="px-3 py-1.5 text-[10px] font-mono bg-secondary hover:bg-accent/30 text-muted-foreground border border-border rounded transition-colors"
                  data-ocid="hybrid.validation.rerun_button"
                >
                  &#8635; Re-Run
                </button>
              )}
              <button
                type="button"
                onClick={handleRun}
                className="px-3 py-1.5 text-[11px] font-mono font-semibold bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 rounded transition-colors"
                data-ocid="hybrid.validation.run_button"
              >
                &#9654; Run All Scenarios
              </button>
            </div>
          </div>

          {/* Summary pills */}
          {summary && (
            <div
              className="flex items-center gap-3"
              data-ocid="hybrid.validation.summary.panel"
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 border border-border rounded">
                <span className="text-[10px] text-muted-foreground font-mono">
                  Total:
                </span>
                <span className="text-[11px] font-mono font-bold text-foreground">
                  {summary.total}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#052010] border border-[#0f5030] rounded">
                <span className="text-[10px] text-muted-foreground font-mono">
                  Passed:
                </span>
                <span className="text-[11px] font-mono font-bold text-[#22C55E]">
                  {summary.passed}
                </span>
              </div>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded border ${
                  summary.failed > 0
                    ? "bg-[#1a0505] border-[#4a1010]"
                    : "bg-secondary/50 border-border"
                }`}
              >
                <span className="text-[10px] text-muted-foreground font-mono">
                  Failed:
                </span>
                <span
                  className="text-[11px] font-mono font-bold"
                  style={{ color: summary.failed > 0 ? "#EF4444" : "#9AA3AD" }}
                >
                  {summary.failed}
                </span>
              </div>
            </div>
          )}

          {/* Not run yet */}
          {!hasRun && (
            <div
              className="text-center py-12 text-muted-foreground text-[11px] font-mono border border-dashed border-border rounded"
              data-ocid="hybrid.validation.empty_state"
            >
              Click “Run All Scenarios” to execute hybrid validation
            </div>
          )}

          {/* Scenario table */}
          {results && (
            <div>
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Scenarios
              </h4>
              <div className="border border-border rounded overflow-hidden">
                <table
                  className="w-full text-[10px] font-mono"
                  data-ocid="hybrid.validation.table"
                >
                  <thead>
                    <tr className="bg-secondary border-b border-border text-muted-foreground">
                      <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold w-8" />
                      <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                        Scenario
                      </th>
                      <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                        Lead Market
                      </th>
                      <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                        Divergence
                      </th>
                      <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                        Hybrid Perm
                      </th>
                      <th className="px-3 py-2 text-center uppercase tracking-wider font-semibold">
                        Entry
                      </th>
                      <th className="px-3 py-2 text-left uppercase tracking-wider font-semibold">
                        Blocker
                      </th>
                      <th className="px-3 py-2 text-center uppercase tracking-wider font-semibold">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => {
                      const isExpanded = expandedIds.has(r.scenario.id);
                      return (
                        <>
                          <tr
                            key={r.scenario.id}
                            className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-secondary/30 ${
                              r.overallPass ? "" : "bg-[#1a0505]/30"
                            }`}
                            onClick={() => toggleExpand(r.scenario.id)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && toggleExpand(r.scenario.id)
                            }
                            data-ocid={`hybrid.validation.item.${i + 1}`}
                          >
                            <td className="px-3 py-2 text-muted-foreground">
                              {isExpanded ? "▲" : "▼"}
                            </td>
                            <td className="px-3 py-2">
                              <div className="font-semibold text-foreground">
                                {r.scenario.name}
                              </div>
                              <div className="text-[9px] text-muted-foreground mt-0.5">
                                {r.scenario.description.slice(0, 60)}
                                {r.scenario.description.length > 60 ? "…" : ""}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-[#67E8F9]">
                                {r.actualCorrelation.leadMarket}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[#FACC15]">
                              {r.actualCorrelation.divergenceType}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`${
                                  r.actualCorrelation.hybridPermission ===
                                  "EXACT_ENTRY_ALLOWED"
                                    ? "text-[#22C55E]"
                                    : r.actualCorrelation.hybridPermission ===
                                        "BLOCKED"
                                      ? "text-[#EF4444]"
                                      : "text-[#FACC15]"
                                }`}
                              >
                                {r.actualCorrelation.hybridPermission}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`font-bold ${
                                  r.actualEntry.permitted
                                    ? "text-[#22C55E]"
                                    : "text-[#EF4444]"
                                }`}
                              >
                                {r.actualEntry.permitted ? "YES" : "NO"}
                              </span>
                            </td>
                            <td className="px-3 py-2 max-w-[140px]">
                              {r.actualCorrelation.mainBlocker ? (
                                <span className="text-[#F87171] truncate block">
                                  {r.actualCorrelation.mainBlocker.slice(0, 30)}
                                  …
                                </span>
                              ) : (
                                <span className="text-[#22C55E]">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <PassBadge pass={r.overallPass} />
                            </td>
                          </tr>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <tr
                              key={`${r.scenario.id}-detail`}
                              className="border-b border-border/50"
                            >
                              <td
                                colSpan={8}
                                className="px-5 py-3 bg-secondary/10"
                              >
                                <div className="space-y-3">
                                  {/* Scenario description */}
                                  <p className="text-[10px] text-muted-foreground italic">
                                    {r.scenario.description}
                                  </p>

                                  {/* Field-level results */}
                                  <table className="w-full text-[10px] font-mono max-w-xl">
                                    <thead>
                                      <tr className="text-muted-foreground">
                                        <th className="pb-1.5 text-left font-semibold w-32">
                                          Field
                                        </th>
                                        <th className="pb-1.5 text-left font-semibold">
                                          Expected
                                        </th>
                                        <th className="pb-1.5 text-left font-semibold">
                                          Actual
                                        </th>
                                        <th className="pb-1.5 text-center font-semibold w-16">
                                          Status
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.fieldResults.map((fr) => (
                                        <FieldRow key={fr.field} {...fr} />
                                      ))}
                                    </tbody>
                                  </table>

                                  {/* Entry engine section */}
                                  <div className="border-t border-border/30 pt-2">
                                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1.5">
                                      Entry Engine
                                    </div>
                                    <div className="flex items-center gap-4 flex-wrap text-[10px] font-mono">
                                      <span>
                                        <span className="text-muted-foreground">
                                          Class:{" "}
                                        </span>
                                        <span className="text-foreground font-bold">
                                          {r.actualEntry.entryClass}
                                        </span>
                                      </span>
                                      <span>
                                        <span className="text-muted-foreground">
                                          Level:{" "}
                                        </span>
                                        <span className="text-foreground font-bold">
                                          {r.actualEntry.permissionLevel}
                                        </span>
                                      </span>
                                      <span>
                                        <span className="text-muted-foreground">
                                          Side:{" "}
                                        </span>
                                        <span
                                          style={{
                                            color:
                                              r.actualEntry.side === "LONG"
                                                ? "#22C55E"
                                                : r.actualEntry.side === "SHORT"
                                                  ? "#EF4444"
                                                  : "#9AA3AD",
                                          }}
                                        >
                                          {r.actualEntry.side}
                                        </span>
                                      </span>
                                      <span>
                                        <span className="text-muted-foreground">
                                          Confirmation:{" "}
                                        </span>
                                        <span className="text-foreground">
                                          {Math.round(
                                            r.actualEntry.confirmationStrength,
                                          )}
                                        </span>
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground italic mt-1.5">
                                      {r.actualEntry.reasoningSummary}
                                    </p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
