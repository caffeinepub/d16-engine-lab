// D16 Hybrid v0.8.1 — Surveillance Storage
// localStorage persistence for surveillance state.
// Handles Map serialization/deserialization and schema migration.

import type { SurveillanceState } from "./surveillanceTypes";

export const SURVEILLANCE_STORAGE_KEY = "d16_surveillance_v1";
const CURRENT_VERSION = 1;

// Safe JSON parse
function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export function loadSurveillanceState(): SurveillanceState | null {
  try {
    const raw = localStorage.getItem(SURVEILLANCE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = safeParseJSON(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const data = parsed as Record<string, unknown>;

    // Version check — discard incompatible versions
    if (typeof data.version !== "number" || data.version !== CURRENT_VERSION) {
      return null;
    }

    // Validate basic shape
    if (
      typeof data.candidates !== "object" ||
      !Array.isArray(data.pinnedAssets) ||
      typeof data.priorityOverrides !== "object"
    ) {
      return null;
    }

    const state: SurveillanceState = {
      candidates: data.candidates as Record<
        string,
        unknown
      > as SurveillanceState["candidates"],
      pinnedAssets: data.pinnedAssets as string[],
      priorityOverrides: data.priorityOverrides as Record<
        string,
        unknown
      > as SurveillanceState["priorityOverrides"],
      lastUpdatedAt:
        typeof data.lastUpdatedAt === "number" ? data.lastUpdatedAt : null,
      version: CURRENT_VERSION,
    };

    return state;
  } catch {
    return null;
  }
}

export function saveSurveillanceState(state: SurveillanceState): void {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(SURVEILLANCE_STORAGE_KEY, serialized);
  } catch {
    // Quota exceeded or unavailable — silently skip
  }
}

export function clearSurveillanceState(): void {
  try {
    localStorage.removeItem(SURVEILLANCE_STORAGE_KEY);
  } catch {
    // silently skip
  }
}

export function emptyState(): SurveillanceState {
  return {
    candidates: {},
    pinnedAssets: [],
    priorityOverrides: {},
    lastUpdatedAt: null,
    version: CURRENT_VERSION,
  };
}
