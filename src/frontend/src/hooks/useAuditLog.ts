// D16 Phase 3 — Audit Log Hook
// Tracks state transitions with committed-change discipline

import { useCallback, useState } from "react";
import type { D16State } from "../d16Engine";
import { DIMENSION_LABELS } from "../mockData";
import type { AuditEntry } from "../validationData";

const MAX_AUDIT_ENTRIES = 50;

function buildAuditEntry(
  prev: D16State,
  curr: D16State,
  source: "editor" | "run",
  scenarioName: string,
): AuditEntry | null {
  // Diff dimensions
  const changedDims: AuditEntry["changedDims"] = [];
  for (const key of Object.keys(
    prev.dimensions,
  ) as (keyof typeof prev.dimensions)[]) {
    const p = prev.dimensions[key];
    const c = curr.dimensions[key];
    if (Math.abs(p - c) >= 0.5) {
      changedDims.push({
        key,
        label: DIMENSION_LABELS[key] ?? key,
        prev: Math.round(p),
        curr: Math.round(c),
      });
    }
  }

  // Diff group scores
  const changedGroups: AuditEntry["changedGroups"] = [];
  for (const key of Object.keys(prev.groups) as (keyof typeof prev.groups)[]) {
    const p = prev.groups[key];
    const c = curr.groups[key];
    if (Math.abs(p - c) > 0.5) {
      changedGroups.push({ key, prev: p, curr: c });
    }
  }

  // Diff canonical outputs
  const changedOutputs: AuditEntry["changedOutputs"] = [];
  const fields: (keyof typeof prev.canonical)[] = [
    "direction",
    "maturity",
    "executionPermission",
    "trustClass",
    "operatorPriority",
    "mainBlocker",
  ];
  for (const field of fields) {
    const p = prev.canonical[field];
    const c = curr.canonical[field];
    if (p !== c) {
      changedOutputs.push({
        field,
        prev: p as string | number | null,
        curr: c as string | number | null,
      });
    }
  }

  // No changes at all — skip
  if (
    changedDims.length === 0 &&
    changedGroups.length === 0 &&
    changedOutputs.length === 0
  ) {
    return null;
  }

  // Build trigger explanation
  let triggerExplanation = "";
  const maturityChange = changedOutputs.find((o) => o.field === "maturity");
  const directionChange = changedOutputs.find((o) => o.field === "direction");
  const execChange = changedOutputs.find(
    (o) => o.field === "executionPermission",
  );
  const blockerChange = changedOutputs.find((o) => o.field === "mainBlocker");

  if (maturityChange) {
    triggerExplanation += `Maturity transitioned ${maturityChange.prev} → ${maturityChange.curr}. `;
  }
  if (directionChange) {
    triggerExplanation += `Direction changed ${directionChange.prev} → ${directionChange.curr}. `;
  }
  if (execChange) {
    triggerExplanation += `Execution permission: ${execChange.prev} → ${execChange.curr}. `;
  }
  if (blockerChange) {
    if (blockerChange.curr === null) {
      triggerExplanation += `Blocker cleared (was: ${blockerChange.prev}). `;
    } else if (blockerChange.prev === null) {
      triggerExplanation += `New blocker: ${blockerChange.curr}. `;
    } else {
      triggerExplanation += `Blocker changed: ${blockerChange.curr}. `;
    }
  }
  if (changedDims.length > 0 && !maturityChange && !directionChange) {
    const topDim = changedDims[0];
    triggerExplanation += `${topDim.label}: ${topDim.prev} → ${topDim.curr}. `;
  }
  if (!triggerExplanation) {
    triggerExplanation = `${changedDims.length} dimension(s) changed, group scores updated.`;
  }

  const now = new Date();
  return {
    id: `audit_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now.toISOString(),
    source,
    scenarioName,
    prevState: {
      maturity: prev.canonical.maturity,
      direction: prev.canonical.direction,
      executionPermission: prev.canonical.executionPermission,
      trustClass: prev.canonical.trustClass,
      operatorPriority: prev.canonical.operatorPriority,
      contextBase: prev.groups.contextBase,
      structuralTruth: prev.groups.structuralTruth,
      executionFeasibility: prev.groups.executionFeasibility,
      reliability: prev.groups.reliability,
      mainBlocker: prev.canonical.mainBlocker,
    },
    currState: {
      maturity: curr.canonical.maturity,
      direction: curr.canonical.direction,
      executionPermission: curr.canonical.executionPermission,
      trustClass: curr.canonical.trustClass,
      operatorPriority: curr.canonical.operatorPriority,
      contextBase: curr.groups.contextBase,
      structuralTruth: curr.groups.structuralTruth,
      executionFeasibility: curr.groups.executionFeasibility,
      reliability: curr.groups.reliability,
      mainBlocker: curr.canonical.mainBlocker,
    },
    changedDims,
    changedGroups,
    changedOutputs,
    triggerExplanation: triggerExplanation.trim(),
  };
}

export function useAuditLog() {
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  const addAuditEntry = useCallback(
    (
      prev: D16State,
      curr: D16State,
      source: "editor" | "run",
      scenarioName: string,
    ) => {
      const entry = buildAuditEntry(prev, curr, source, scenarioName);
      if (!entry) return;
      setAuditEntries((prev) => [entry, ...prev].slice(0, MAX_AUDIT_ENTRIES));
    },
    [],
  );

  const clearAuditLog = useCallback(() => {
    setAuditEntries([]);
  }, []);

  return { auditEntries, addAuditEntry, clearAuditLog };
}
