// D16 Hybrid v0.7 — Snapshot Ledger
// Capture layer: records canonical engine state at meaningful moments.
// Only captures on significant events — NOT on every tick.

import type { HybridAssetBundle } from "./hybridTypes";
import type { EngineMode, RuntimeState } from "./liveAdapterTypes";
import type { CaptureReason, HybridOutcomeSnapshot } from "./outcomeTypes";

// ─── Minimum relevance threshold ───────────────────────────────────────────────
// Assets below this threshold are not interval-snapshotted (prevent noise).
// "Active candidate" = permission level is not BLOCKED and entry class is not NONE.

function isActiveCandidate(bundle: HybridAssetBundle): boolean {
  const perm = bundle.entry.permissionLevel;
  return perm !== "BLOCKED";
}

// ─── Fingerprint (deduplication) ────────────────────────────────────────────
// A compact string summarizing all trigger-relevant fields for an asset.
// If the fingerprint hasn't changed since last capture, skip.

function computeFingerprint(bundle: HybridAssetBundle): string {
  const { correlation, entry } = bundle;
  const bsMaturity = bundle.assetState.binanceSpot?.maturity ?? "null";
  const bfMaturity = bundle.assetState.binanceFutures?.maturity ?? "null";
  const cbMaturity = bundle.assetState.coinbaseSpot?.maturity ?? "null";
  return [
    correlation.hybridPermission,
    entry.permissionLevel,
    entry.entryClass,
    correlation.divergenceType,
    correlation.leadMarket,
    correlation.mainBlocker ?? "null",
    bsMaturity,
    bfMaturity,
    cbMaturity,
  ].join("|");
}

// ─── Snapshot ID generator ─────────────────────────────────────────────────

let _snapshotCounter = 0;

export function generateSnapshotId(asset: string): string {
  return `snap_${asset}_${Date.now()}_${++_snapshotCounter}`;
}

// ─── Reference price extraction ────────────────────────────────────────────
// Best available price from the bundle. Prefer futures mid, then spot.

export function extractReferencePrice(bundle: HybridAssetBundle): number {
  // In MOCK mode, per-market states don't have a price field directly—
  // use entryReadiness as a proxy for now; in LIVE mode the normalizer
  // preserves structural/activation scores that encode price magnitude.
  // Real price is tracked by the price history store in useOutcomeEngine.
  const bf = bundle.assetState.binanceFutures;
  const bs = bundle.assetState.binanceSpot;
  const cb = bundle.assetState.coinbaseSpot;
  // entryReadiness is not a price — return 0 here;
  // the hook layer substitutes the real price from the live price store.
  if (bf ?? bs ?? cb) return 0;
  return 0;
}

// ─── Snapshot builder ────────────────────────────────────────────────────────

export function buildSnapshot(
  bundle: HybridAssetBundle,
  mode: EngineMode,
  runtime: RuntimeState,
  reason: CaptureReason,
  priceOverride: number,
): HybridOutcomeSnapshot {
  const { assetState, correlation, entry } = bundle;
  const assetHydration = runtime.assets[assetState.asset];

  const overallTrust = Math.round(
    Object.values(runtime.adapters).reduce(
      (sum, a) => sum + a.runtimeTrustContribution,
      0,
    ) / 3,
  );

  return {
    snapshotId: generateSnapshotId(assetState.asset),
    capturedAt: Date.now(),
    asset: assetState.asset,
    mode,
    perMarket: {
      binanceSpot: assetState.binanceSpot,
      binanceFutures: assetState.binanceFutures,
      coinbaseSpot: assetState.coinbaseSpot,
    },
    hybrid: correlation,
    entry,
    referencePrice: priceOverride,
    runtime: {
      overallTrust,
      connectedMarkets: runtime.connectedMarketCount,
      staleMarkets: runtime.staleMarketCount,
      hybridReady: assetHydration?.hybridReady ?? false,
    },
    tags: {
      leadMarket: correlation.leadMarket,
      divergenceType: correlation.divergenceType,
      permissionLevel: entry.permissionLevel,
      entryClass: entry.entryClass,
      mainBlocker: entry.mainBlocker ?? correlation.mainBlocker ?? null,
    },
    captureReason: reason,
  };
}

// ─── Capture trigger evaluator ─────────────────────────────────────────────
// Given old and new bundle state for an asset, determine if a capture is warranted
// and what reason triggered it.

export function shouldCapture(
  prev: HybridAssetBundle | null,
  next: HybridAssetBundle,
): CaptureReason | null {
  if (!prev) return "HYBRID_PERMISSION_CHANGE"; // first time seen

  const pc = prev.correlation;
  const nc = next.correlation;
  const pe = prev.entry;
  const ne = next.entry;
  const pas = prev.assetState;
  const nas = next.assetState;

  if (pc.hybridPermission !== nc.hybridPermission)
    return "HYBRID_PERMISSION_CHANGE";
  if (pe.permissionLevel !== ne.permissionLevel)
    return "ENTRY_PERMISSION_CHANGE";
  if (pe.entryClass !== ne.entryClass) return "ENTRY_CLASS_CHANGE";
  if (pc.divergenceType !== nc.divergenceType) return "DIVERGENCE_TYPE_CHANGE";
  if (pc.leadMarket !== nc.leadMarket) return "LEAD_MARKET_CHANGE";

  // Main blocker change (entry level takes priority)
  const prevBlocker = pe.mainBlocker ?? pc.mainBlocker;
  const nextBlocker = ne.mainBlocker ?? nc.mainBlocker;
  if (prevBlocker !== nextBlocker) return "MAIN_BLOCKER_CHANGE";

  // Maturity change in any market
  if (pas.binanceSpot?.maturity !== nas.binanceSpot?.maturity)
    return "MATURITY_CHANGE";
  if (pas.binanceFutures?.maturity !== nas.binanceFutures?.maturity)
    return "MATURITY_CHANGE";
  if (pas.coinbaseSpot?.maturity !== nas.coinbaseSpot?.maturity)
    return "MATURITY_CHANGE";

  return null;
}

// ─── Interval capture check ──────────────────────────────────────────────────
// Every 5 minutes for active candidates only.

const INTERVAL_CAPTURE_MS = 5 * 60 * 1000;

export function shouldIntervalCapture(
  bundle: HybridAssetBundle,
  lastIntervalCaptureAt: number | null,
): boolean {
  if (!isActiveCandidate(bundle)) return false;
  if (!lastIntervalCaptureAt) return true;
  return Date.now() - lastIntervalCaptureAt >= INTERVAL_CAPTURE_MS;
}

// ─── Ledger state (in-memory; hook manages persistence) ──────────────────
// Per-asset tracking of last known fingerprint and last bundle.

export type LedgerAssetState = {
  lastFingerprint: string | null;
  lastBundle: HybridAssetBundle | null;
  lastIntervalCaptureAt: number | null;
};

export function makeLedgerAssetState(): LedgerAssetState {
  return {
    lastFingerprint: null,
    lastBundle: null,
    lastIntervalCaptureAt: null,
  };
}

// ─── Process bundle against ledger ────────────────────────────────────────────
// Returns { reason, updatedState } if a capture is warranted, null otherwise.

export type CaptureDecision = {
  reason: CaptureReason;
  updatedState: LedgerAssetState;
};

export function processBundleForCapture(
  bundle: HybridAssetBundle,
  ledgerState: LedgerAssetState,
): CaptureDecision | null {
  const fingerprint = computeFingerprint(bundle);

  // Check event-driven triggers (change-based)
  const eventReason = shouldCapture(ledgerState.lastBundle, bundle);
  if (eventReason && fingerprint !== ledgerState.lastFingerprint) {
    return {
      reason: eventReason,
      updatedState: {
        lastFingerprint: fingerprint,
        lastBundle: bundle,
        lastIntervalCaptureAt: ledgerState.lastIntervalCaptureAt,
      },
    };
  }

  // Check interval trigger
  if (shouldIntervalCapture(bundle, ledgerState.lastIntervalCaptureAt)) {
    const now = Date.now();
    return {
      reason: "INTERVAL_SNAPSHOT",
      updatedState: {
        lastFingerprint: fingerprint,
        lastBundle: bundle,
        lastIntervalCaptureAt: now,
      },
    };
  }

  return null;
}
