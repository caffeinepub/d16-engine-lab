// D16 Hybrid v0.7 — Forward Outcome Evaluator
// For each snapshot: measure what happened at +15m, +1h, +4h, +24h horizons.
// Deterministic outcome classification from explicit rules.
// This is the truth core of v0.7.

import type {
  HorizonResult,
  HybridOutcomeSnapshot,
  OutcomeClass,
  PriceTick,
  SnapshotOutcome,
} from "./outcomeTypes";

// ─── Horizon windows (ms) ────────────────────────────────────────────────────

export const HORIZON_15M = 15 * 60 * 1000;
export const HORIZON_1H = 60 * 60 * 1000;
export const HORIZON_4H = 4 * 60 * 60 * 1000;
export const HORIZON_24H = 24 * 60 * 60 * 1000;

// Tolerance window: accept a price tick as "at horizon" if it falls within
// ±3 minutes of the target time.
const TOLERANCE_MS = 3 * 60 * 1000;

// ─── Price history store ─────────────────────────────────────────────────────
// Maintained by useOutcomeEngine. Holds recent price ticks per asset for
// forward-window evaluation. Pruned to last 25h of data.

export type PriceHistoryStore = Map<string, PriceTick[]>;

const MAX_PRICE_HISTORY_MS = 25 * 60 * 60 * 1000; // 25h

export function appendPriceTick(
  store: PriceHistoryStore,
  tick: PriceTick,
): PriceHistoryStore {
  const ticks = store.get(tick.asset) ?? [];
  const now = Date.now();
  const pruned = ticks.filter((t) => now - t.ts <= MAX_PRICE_HISTORY_MS);
  const updated = [...pruned, tick];
  const next = new Map(store);
  next.set(tick.asset, updated);
  return next;
}

export function getLatestPrice(
  store: PriceHistoryStore,
  asset: string,
): number | null {
  const ticks = store.get(asset);
  if (!ticks || ticks.length === 0) return null;
  return ticks[ticks.length - 1].price;
}

// ─── Horizon price lookup ────────────────────────────────────────────────────
// Find the closest tick to the target timestamp within tolerance.

function findPriceAtHorizon(
  ticks: PriceTick[],
  capturedAt: number,
  horizonMs: number,
): number | null {
  const target = capturedAt + horizonMs;
  const now = Date.now();

  // Not enough time has passed yet
  if (now < target - TOLERANCE_MS) return null;

  let best: PriceTick | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const tick of ticks) {
    const diff = Math.abs(tick.ts - target);
    if (diff <= TOLERANCE_MS && diff < bestDiff) {
      bestDiff = diff;
      best = tick;
    }
  }

  // If no tick in tolerance window, use the closest one after the target
  if (!best) {
    for (const tick of ticks) {
      if (tick.ts >= target) {
        const diff = tick.ts - target;
        if (diff < bestDiff) {
          bestDiff = diff;
          best = tick;
        }
      }
    }
  }

  return best?.price ?? null;
}

// ─── MFE / MAE calculation ──────────────────────────────────────────────────────
// Over all ticks within the 24h forward window, find max favorable and
// max adverse excursion relative to the reference price.

function calcMfeMae(
  ticks: PriceTick[],
  capturedAt: number,
  referencePrice: number,
  direction: "LONG" | "SHORT" | "NONE",
): { mfePct: number | null; maePct: number | null } {
  if (referencePrice <= 0 || direction === "NONE")
    return { mfePct: null, maePct: null };

  const endWindow = capturedAt + HORIZON_24H;
  const windowTicks = ticks.filter(
    (t) => t.ts > capturedAt && t.ts <= endWindow,
  );

  if (windowTicks.length === 0) return { mfePct: null, maePct: null };

  let mfe = 0;
  let mae = 0;

  for (const tick of windowTicks) {
    const changePct = ((tick.price - referencePrice) / referencePrice) * 100;
    if (direction === "LONG") {
      mfe = Math.max(mfe, changePct);
      mae = Math.min(mae, changePct);
    } else {
      // SHORT: favorable is negative price change
      mfe = Math.max(mfe, -changePct);
      mae = Math.min(mae, -changePct);
    }
  }

  return { mfePct: mfe, maePct: mae };
}

// ─── Horizon result builder ────────────────────────────────────────────────────

function buildHorizonResult(
  ticks: PriceTick[],
  capturedAt: number,
  horizonMs: number,
  referencePrice: number,
  direction: "LONG" | "SHORT" | "NONE",
): HorizonResult {
  const horizonPrice = findPriceAtHorizon(ticks, capturedAt, horizonMs);
  if (horizonPrice === null || referencePrice <= 0) {
    return { returnPct: null, directionalCorrect: null };
  }

  const returnPct = ((horizonPrice - referencePrice) / referencePrice) * 100;
  let directionalCorrect: boolean | null = null;

  if (direction === "LONG") directionalCorrect = returnPct > 0;
  else if (direction === "SHORT") directionalCorrect = returnPct < 0;
  else directionalCorrect = null;

  return {
    returnPct: Math.round(returnPct * 100) / 100,
    directionalCorrect,
  };
}

// ─── Outcome classification ─────────────────────────────────────────────────────
// Deterministic rules. No vague heuristics.

function classifyOutcome(
  after1h: HorizonResult,
  after4h: HorizonResult,
  after24h: HorizonResult,
  mfePct: number | null,
  maePct: number | null,
  direction: "LONG" | "SHORT" | "NONE",
): OutcomeClass {
  if (direction === "NONE") return "NEUTRAL";

  // Not enough data yet
  const hasAnyResult =
    after1h.returnPct !== null ||
    after4h.returnPct !== null ||
    after24h.returnPct !== null;
  if (!hasAnyResult) return "INSUFFICIENT_FORWARD_DATA";

  // Use the best available horizon for primary classification
  // (prefer 4h, then 24h, then 1h)
  const primary =
    after4h.returnPct !== null
      ? after4h
      : after24h.returnPct !== null
        ? after24h
        : after1h;

  const primaryReturn = primary.returnPct ?? 0;
  const primaryCorrect = primary.directionalCorrect;

  const mfe = mfePct ?? 0;
  const mae = maePct ?? 0; // mae is negative or 0

  // FAILED: primary return clearly contradicts the thesis
  // (>1.5% adverse move AND not directionally correct)
  if (primaryCorrect === false && Math.abs(primaryReturn) > 1.5) {
    return "FAILED";
  }

  // STRONG_SUCCESS:
  // - directionally correct at primary horizon
  // - MFE >= 2% (meaningful favorable excursion)
  // - MAE > -2% (limited adverse excursion)
  if (primaryCorrect === true && mfe >= 2.0 && mae > -2.0) {
    return "STRONG_SUCCESS";
  }

  // PARTIAL_SUCCESS:
  // - directionally correct
  // - but magnitude modest OR adverse excursion also significant
  if (
    primaryCorrect === true &&
    (mfe >= 0.5 || Math.abs(primaryReturn) >= 0.5)
  ) {
    return "PARTIAL_SUCCESS";
  }

  // EARLY_FALSE_POSITIVE:
  // - thesis looked promising at 15m but 4h+ did not confirm
  // - adverse dominated before favorable
  if (mae < -1.0 && mfe < 1.0) {
    return "EARLY_FALSE_POSITIVE";
  }

  // NEUTRAL: no meaningful move either way
  if (Math.abs(primaryReturn) < 0.5 && mfe < 1.0 && Math.abs(mae) < 1.0) {
    return "NEUTRAL";
  }

  // Default: if we have some data but it's not conclusive
  if (primaryCorrect === null) return "INSUFFICIENT_FORWARD_DATA";
  if (primaryCorrect === false) return "FAILED";
  return "PARTIAL_SUCCESS";
}

// ─── Main evaluator ────────────────────────────────────────────────────────────
// Evaluates a snapshot against the price history store.
// Returns null if the snapshot has no reference price (cannot evaluate).

export function evaluateSnapshot(
  snapshot: HybridOutcomeSnapshot,
  priceStore: PriceHistoryStore,
): SnapshotOutcome | null {
  const { snapshotId, asset, capturedAt, referencePrice } = snapshot;
  const direction = snapshot.entry.side;

  if (referencePrice <= 0) return null;

  const ticks = priceStore.get(asset) ?? [];

  const after15m = buildHorizonResult(
    ticks,
    capturedAt,
    HORIZON_15M,
    referencePrice,
    direction,
  );
  const after1h = buildHorizonResult(
    ticks,
    capturedAt,
    HORIZON_1H,
    referencePrice,
    direction,
  );
  const after4h = buildHorizonResult(
    ticks,
    capturedAt,
    HORIZON_4H,
    referencePrice,
    direction,
  );
  const after24h = buildHorizonResult(
    ticks,
    capturedAt,
    HORIZON_24H,
    referencePrice,
    direction,
  );

  const { mfePct, maePct } = calcMfeMae(
    ticks,
    capturedAt,
    referencePrice,
    direction,
  );

  const outcomeClass = classifyOutcome(
    after1h,
    after4h,
    after24h,
    mfePct,
    maePct,
    direction,
  );

  return {
    snapshotId,
    asset,
    referencePrice,
    referenceDirection: direction,
    after15m,
    after1h,
    after4h,
    after24h,
    mfePct,
    maePct,
    outcomeClass,
    evaluatedAt: Date.now(),
  };
}

// ─── Batch re-evaluation ─────────────────────────────────────────────────────────
// Re-evaluate all snapshots that don't yet have a final outcome, or that
// have INSUFFICIENT_FORWARD_DATA. Returns the updated outcomes map.

export function batchEvaluateSnapshots(
  snapshots: HybridOutcomeSnapshot[],
  existingOutcomes: Record<string, SnapshotOutcome>,
  priceStore: PriceHistoryStore,
): Record<string, SnapshotOutcome> {
  const updated = { ...existingOutcomes };

  for (const snap of snapshots) {
    const existing = updated[snap.snapshotId];
    // Skip if already classified with a final outcome
    if (
      existing &&
      existing.outcomeClass !== "INSUFFICIENT_FORWARD_DATA" &&
      existing.outcomeClass !== "NEUTRAL"
    ) {
      // Only re-evaluate if it's been classified neutrally or insufficiently
      continue;
    }

    const result = evaluateSnapshot(snap, priceStore);
    if (result) {
      updated[snap.snapshotId] = result;
    }
  }

  return updated;
}
