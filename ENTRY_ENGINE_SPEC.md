# D16 Hybrid — Canonical Entry Engine Spec

**Version:** v0.8 (locked)
**Status:** LOCKED — no changes without explicit authorization
**Date:** 2026-04-05
**Scope:** Defines the canonical doctrine, outputs, permission ladder, entry classes, prerequisites,
blocker hierarchy, and reasoning doctrine for the D16 Hybrid Entry Engine.

This spec is the authoritative reference for:
- The current `entryEngine.ts` implementation
- Universe ranking logic in `universeRanking.ts` (must read entry output — must not invent its own)
- All future position management and TP layers
- Any future threshold tuning (requires evidence from v0.7 outcome layer before authorization)

---

## 1. Entry Philosophy

Entry in the D16 system is **state-based, not indicator-based.**

- Entry decisions come from the resolved hybrid correlation layer, not from price patterns or
  technical indicators applied to raw price data.
- Entry is only allowed when multiple markets have reached structural and directional alignment,
  measured simultaneously across Binance Spot, Binance Futures, and Coinbase Spot.
- No single market alone can authorize entry. A signal in one market is a partial state update
  that must be validated through the full hybrid layer before entry is permissible.
- Every entry output must be fully explainable. The operator reads exactly why entry is allowed
  or blocked at any moment.
- Entry must not be retroactively justified. State at the moment of permission is the canonical record.

**Entry truth flows from the engine down, not from the operator up.**

---

## 2. Entry Output Fields

Every resolved entry produces a canonical `EntryEngineOutput`. All fields are mandatory.

| Field | Type | Description |
|---|---|---|
| `asset` | `string` | Canonical asset id (BTC, ETH, …) |
| `permitted` | `boolean` | `true` only when permissionLevel is PROVISIONAL or EXACT |
| `side` | `LONG \| SHORT \| NONE` | Majority direction across available markets |
| `permissionLevel` | see §3 | Position on the permission ladder |
| `entryClass` | see §4 | Structural class of the setup |
| `confirmationStrength` | 0–100 | Equals `crossMarketConfirmation` from hybrid layer |
| `invalidationClarity` | 0–100 | `structuralConfirmation × 0.6 + trustAgreement × 0.4` |
| `rewardFeasibility` | 0–100 | `maturityAgreement × 0.5 + (avgSpotExecRank × 25) × 0.5` |
| `mainBlocker` | `string \| null` | Human-readable block reason. `null` when EXACT. |
| `nextUnlockCondition` | `string \| null` | What must improve to advance permission. `null` when EXACT. |
| `strongestConfirmingMarket` | see below | Most advanced market in the entry direction |
| `laggingOrBlockingMarket` | see below | Market holding back or blocking the setup |
| `reasoningSummary` | `string` | Full operator-readable explanation |

**`strongestConfirmingMarket`**: `BINANCE_SPOT | COINBASE_SPOT | BINANCE_FUTURES | MULTI_MARKET | NONE`

**`laggingOrBlockingMarket`**: `BINANCE_SPOT | COINBASE_SPOT | BINANCE_FUTURES | MULTIPLE | NONE`

Priority for lagging/blocking:
1. Any `INVALID_RUNTIME` market is identified first.
2. Multiple `INVALID_RUNTIME` → `MULTIPLE`.
3. Otherwise, lowest maturity rank is the lagging market.
4. All equal maturity → `NONE`.

---

## 3. Permission Ladder

Internal `HybridPermission` maps 1:1 to operator-facing `permissionLevel`:

| HybridPermission (internal) | permissionLevel | permitted |
|---|---|---|
| `BLOCKED` | `BLOCKED` | false |
| `WATCH_ONLY` | `WATCH_ONLY` | false |
| `PROJECTED_ENTRY_ONLY` | `PROJECTED_ONLY` | false |
| `PROVISIONAL_ENTRY_ALLOWED` | `PROVISIONAL` | true |
| `EXACT_ENTRY_ALLOWED` | `EXACT` | true |

### BLOCKED
Entry structurally forbidden. Triggered by ANY of:
- `DIRECTION_CONFLICT` divergence type
- `trustAgreement < 20`
- Lead market has `INVALID_RUNTIME` trust class

### WATCH_ONLY
Setup developing but below minimum entry standards. Triggered by (not BLOCKED, plus any of):
- `crossMarketConfirmation < 40`
- `FUTURES_OVEREXTENDED` divergence
- `TRUST_CONFLICT` divergence
- `MATURITY_CONFLICT` divergence

### PROJECTED_ONLY
Futures leading, spot not yet confirmed. Conditions:
- `crossMarketConfirmation ≥ 40` and `< 60`

### PROVISIONAL
Sufficient alignment for entry with confirmation still building. ALL of:
- `crossMarketConfirmation ≥ 60`
- ≥ 2 of 3 markets at `PROVISIONAL_PLAN` execution or higher
- Divergence type NOT in: `DIRECTION_CONFLICT`, `FUTURES_OVEREXTENDED`, `TRUST_CONFLICT`, `SPOT_WEAKNESS_VS_FUTURES`

### EXACT
All conditions fully met. ALL of:
- `crossMarketConfirmation ≥ 75`
- `directionAgreement ≥ 85`
- `structuralConfirmation ≥ 70`
- At least one market at `EXACT_PLAN` or `LIVE_MANAGEMENT` execution permission

---

## 4. Entry Classes

Entry class is **resolver-derived**. Not manually assigned. Not overridable.

First-match priority chain. Check in order. First match wins.

**Preconditions (fail → NONE before any rule):**
- `crossMarketConfirmation < 30` → NONE
- `side = NONE` → NONE
- `DIRECTION_CONFLICT` AND `hybridPermission = BLOCKED` → NONE

### Rule 1 — REVERSAL (highest priority)
Conditions (all required):
- divergenceType ≠ `DIRECTION_CONFLICT`
- `maturityAgreement ≥ 35`
- At least one spot market confirms current side
- `permissionLevel ≥ WATCH_ONLY`
- Futures direction = current side
- divergenceType is `SPOT_WEAKNESS_VS_FUTURES` or `MATURITY_CONFLICT`

### Rule 2 — BREAKOUT
Conditions (all required):
- divergenceType = `FUTURES_LEADS_SPOT`
- `directionAgreement ≥ 70`
- `permissionLevel ≥ PROJECTED_ONLY`
- `maturityAgreement ≥ 50`

### Rule 3 — CONTINUATION
Conditions (all required):
- `directionAgreement ≥ 85`
- `maturityAgreement ≥ 70`
- `structuralConfirmation ≥ 65`
- `permissionLevel ≥ PROVISIONAL`
- `leadMarket = BINANCE_FUTURES`

### Rule 4 — RECLAIM
Conditions (any spot-lead pattern + maturity):
- divergenceType = `SPOT_CONFIRMS_FUTURES`, OR
- `BINANCE_SPOT_LEADS_COINBASE` with spot confirming side, OR
- `COINBASE_LEADS_BINANCE_SPOT` with spot confirming side, OR
- Binance Spot maturity rank > Binance Futures maturity rank, with Binance Spot directional
AND: `maturityAgreement ≥ 50`

### Rule 5 — PULLBACK
Conditions (all required):
- `structuralConfirmation ≥ 65`
- laggingMarket = `BINANCE_SPOT` or `COINBASE_SPOT`
- `permissionLevel ≥ WATCH_ONLY`
- `maturityAgreement ≥ 40` and `< 70`

### Rule 6 — NONE (fallback)
No structural pattern identified.

### Summary Table

| Class | Core Signal | Min Permission | Min Dir Agree | Min Mat Agree |
|---|---|---|---|---|
| REVERSAL | Conflict resolving via SPOT_WEAKNESS/MATURITY_CONFLICT | WATCH_ONLY | — | ≥ 35 |
| BREAKOUT | Futures lead, FUTURES_LEADS_SPOT | PROJECTED_ONLY | ≥ 70 | ≥ 50 |
| CONTINUATION | Full alignment, futures leading | PROVISIONAL | ≥ 85 | ≥ 70 |
| RECLAIM | Spot leads/confirms | any | — | ≥ 50 |
| PULLBACK | Strong structure, one spot lagging | WATCH_ONLY | — | ≥ 40, < 70 |
| NONE | No pattern | — | — | — |

---

## 5. Entry Prerequisites

**Direction Agreement:** Majority of available markets must agree (LONG or SHORT). Futures breaks ties.

**Structural Confirmation:** Composite of per-market structural and activation scores. Below 40 = too weak for any constructive class. EXACT requires ≥ 70.

**Runtime Trust:** `trustAgreement ≥ 20` for anything above BLOCKED. Lead market must not be `INVALID_RUNTIME`.

**Invalidation Clarity:** `structuralConfirmation × 0.6 + trustAgreement × 0.4`. Low clarity associated with BLOCKED/WATCH_ONLY. Strong EXACT entries typically ≥ 65.

**Reward Feasibility:** `maturityAgreement × 0.5 + (avgSpotExecPermission × 25) × 0.5`. Soft signal only — does not hard-block but contributes to ranking.

**Market Confirmation (PROVISIONAL+):** At least 2 of 3 markets must have `PROVISIONAL_PLAN` or higher execution permission.

---

## 6. Blocker Hierarchy

Applied in priority order. First applicable becomes `mainBlocker`.

### Hard Blockers → BLOCKED
1. **Direction Conflict** — two or more markets opposing (LONG vs SHORT)
2. **Trust Floor Breach** — `trustAgreement < 20`
3. **Lead Market Runtime Failure** — lead market is `INVALID_RUNTIME`

### Structural Blockers → WATCH_ONLY
4. **Trust Conflict** — non-lead market is `INVALID_RUNTIME` (`TRUST_CONFLICT` divergence)
5. **Maturity Conflict** — maturity spread ≥ 4 bands (`MATURITY_CONFLICT` divergence)
6. **Futures Overextended** — `FUTURES_OVEREXTENDED` divergence
7. **Weak Confirmation** — `crossMarketConfirmation < 40`

### Soft Blockers → PROJECTED_ONLY
8. **Futures Leads (forming)** — `FUTURES_LEADS_SPOT` with confirmation 40–60
9. **Insufficient Confirmation** — `crossMarketConfirmation < 60` (general)

### Execution Blockers (prevent EXACT)
10. **Spot Weakness vs Futures** — `SPOT_WEAKNESS_VS_FUTURES` divergence disqualifies PROVISIONAL
11. **Insufficient Structural Confirmation** — `structuralConfirmation < 70` at PROVISIONAL level
12. **Low Trust Agreement** — `trustAgreement < 40`

---

## 7. Entry Reasoning Doctrine

Every `reasoningSummary` must accurately describe the state.

| permissionLevel | Template |
|---|---|
| EXACT / PROVISIONAL | "All three markets aligned [long/short] for [ASSET] with strong cross-market confirmation ([X]%). [ENTRYCLASS] entry permitted." |
| PROJECTED_ONLY | "[Futures are / Markets are] leading [long/short] for [ASSET], but spot markets are still forming. Entry is projected-only until spot structure confirms." |
| WATCH_ONLY | "[ASSET] shows developing [long/short] structure but cross-market confirmation ([X]%) is insufficient for entry. Monitoring for confirmation." |
| BLOCKED | "Entry blocked for [ASSET]: [mainBlocker text]" |
| NONE | "No entry class identified for [ASSET]. Hybrid conditions not met for directional bias." |

**Integrity rules:**
- Must never claim strength that scores don't support
- Must not suggest entry when `permitted = false`
- Must not say "strong" when `crossMarketConfirmation < 60`
- Must reference the correct side direction

---

## 8. Entry and Universe Relationship

The Universe selector does not implement its own entry logic.

**Non-negotiable pipeline:**
```
CanonicalAssetState
  → resolveHybridCorrelation()   [hybridEngine.ts]
  → resolveEntryEngine()         [entryEngine.ts]
  → buildRankedRecord()          [universeRanking.ts]
```

Ranking weight by permission level (×0.30 factor):

| permissionLevel | Rank contribution |
|---|---|
| EXACT | 100 |
| PROVISIONAL | 75 |
| PROJECTED_ONLY | 50 |
| WATCH_ONLY | 25 |
| BLOCKED | 0 |

BLOCKED assets must never appear in actionable entry lists. Universe ranking must not produce a higher classification than the entry engine produces.

---

## 9. Entry and Future Management Relationship

All future layers (TP, trailing logic, position sizing, adaptive exit) must read this locked output.

They must not:
- Recompute entry permission independently
- Override entry class
- Substitute their own threshold logic for the permission ladder
- Treat PROVISIONAL and EXACT as equivalent

They may:
- Read `permissionLevel`, `entryClass`, `confirmationStrength`, `invalidationClarity`, `rewardFeasibility` as canonical inputs
- Use `mainBlocker` / `nextUnlockCondition` to determine hold/tighten/exit behavior
- Use `laggingOrBlockingMarket` to detect deteriorating confirmation
- Use `strongestConfirmingMarket` to anchor the primary truth source

**Position management reads engine state. It does not override it.**

Degradation from EXACT → BLOCKED during an active position is a canonical invalidation signal.

---

## 10. Locked Thresholds (current baseline)

Locked until explicitly authorized. No changes without v0.7 outcome evidence.

| Threshold | Value | Location |
|---|---|---|
| trustAgreement hard block | < 20 | hybridEngine.ts |
| crossMarketConfirmation watch floor | < 40 | hybridEngine.ts |
| crossMarketConfirmation projected floor | ≥ 40, < 60 | hybridEngine.ts |
| crossMarketConfirmation provisional floor | ≥ 60 | hybridEngine.ts |
| crossMarketConfirmation exact floor | ≥ 75 | hybridEngine.ts |
| directionAgreement exact requirement | ≥ 85 | hybridEngine.ts |
| structuralConfirmation exact requirement | ≥ 70 | hybridEngine.ts |
| Maturity conflict spread | ≥ 4 bands | hybridEngine.ts |
| crossMarketConfirmation entry class hard floor | < 30 → NONE | entryEngine.ts |
| BREAKOUT directionAgreement | ≥ 70 | entryEngine.ts |
| BREAKOUT maturityAgreement | ≥ 50 | entryEngine.ts |
| CONTINUATION directionAgreement | ≥ 85 | entryEngine.ts |
| CONTINUATION maturityAgreement | ≥ 70 | entryEngine.ts |
| CONTINUATION structuralConfirmation | ≥ 65 | entryEngine.ts |
| RECLAIM maturityAgreement | ≥ 50 | entryEngine.ts |
| PULLBACK structuralConfirmation | ≥ 65 | entryEngine.ts |
| PULLBACK maturityAgreement range | ≥ 40, < 70 | entryEngine.ts |
| REVERSAL maturityAgreement | ≥ 35 | entryEngine.ts |

---

## 11. Doctrine Violations (prohibited without authorization)

1. Granting EXACT without all 4 EXACT conditions simultaneously
2. Deriving `side` from a single market
3. Allowing DIRECTION_CONFLICT to resolve to anything other than BLOCKED
4. Overriding `mainBlocker` with a weaker message
5. Deriving entry class from price action or external indicators
6. Treating `invalidationClarity` or `rewardFeasibility` as operator-overridable
7. Universe ranking producing higher classification than entry engine
8. `permitted = true` at any level below PROVISIONAL
9. Modifying §10 thresholds without outcome evidence
10. Introducing a new entry class without going through the full derivation chain

---

## 12. Revision Policy

This spec may be revised only when:
1. v0.7 outcome layer has produced measurable evidence of systematic error
2. The revision is explicitly authorized by the operator before any code change
3. The change is documented here as a versioned entry before the code is touched
4. Any §10 threshold change states the evidence that justifies it

**This document is the primary truth source. Code must match this spec. If they diverge, the spec wins.**
