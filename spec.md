# D16 Engine Lab

## Current State

The operator-facing app has three selectable engine modes: MOCK, LIVE, and HYBRID_LIVE. MOCK is currently the default startup mode and is fully accessible in the main operator UI. MOCK language appears on primary screens (UniverseBoard shows "MOCK UNIVERSE", SurveillanceTab shows "MOCK" badge, RuntimeControlBar offers MOCK as a normal mode button). The app starts in MOCK mode. The `runtimeManager` defaults to `useState<EngineMode>("MOCK")`. When live data is unavailable, the system silently falls back to MOCK bundles (`activeBundles = isLiveMode && liveBundles !== null ? liveBundles : mockBundles`).

## Requested Changes (Diff)

### Add
- Honest runtime unavailability states: when in LIVE/HYBRID mode and no live connection is established yet, show clear messages: "Waiting for hydration", "No live market connection", "Runtime not ready" instead of silently using mock data
- Dev Tools section in MoreDrawer with a hidden MOCK mode toggle (clearly labeled as developer/testing only, visually separated)
- `isLiveConnectionReady` computed flag exposed from runtimeManager: true when live mode AND at least one market connected
- Execution map "source unavailable" state in EntryDetailCard: when data source is not live-backed, disable execution readiness and mark execution map as unavailable rather than showing potentially misleading computed values

### Modify
- `runtimeManager.ts`: Change default mode from `"MOCK"` to `"HYBRID_LIVE"`. Update `useState` initial value and `makeInitialRuntimeState` call. Auto-start adapters on mount when default is HYBRID_LIVE.
- `RuntimeControlBar.tsx`: Remove MOCK button from the mode selector row (both desktop and mobile expanded views). Mode selector now shows only LIVE and HYBRID_LIVE. Keep MOCK entirely absent from operator-facing controls.
- `App.tsx`: Remove `"Returned to MOCK mode"` toast from `handleSetEngineMode`. Remove any MOCK-specific conditional logic in the primary operator flow. Universe section mobile header no longer references `isMockMode` for primary display text.
- `MoreDrawer.tsx`: Add a "Dev Tools" section at the bottom (visually separated with a divider and a dim "DEV" label). Inside Dev Tools, show a MOCK toggle button — clearly labeled "MOCK (Dev/Testing only)". This is the only remaining access point for MOCK mode.
- `UniverseBoard.tsx`: Remove the "MOCK MODE" prominent badge/header from the primary board view. When isMockMode is true and reached from Dev Tools, show only a small compact "[DEV]" indicator, not a full operator-facing MOCK universe notice. Remove `mockModeNotice` banner from primary flow.
- `UniverseDiagnostics.tsx`: Remove MOCK-specific operator-facing language. When in MOCK (dev) mode, show compact "[DEV MODE]" label only.
- `SurveillanceTab.tsx`: Replace `{isLive ? "LIVE" : "MOCK"}` badge with `{isLive ? "LIVE" : "CONNECTING"}` — MOCK is no longer a normal operator state. When not live-connected, show "CONNECTING" or "NOT READY" rather than "MOCK".
- `LiveDiagnosticsPanel.tsx`: Remove MOCK mode box from primary diagnostics header. Runtime page should reflect real connection state. If not yet connected, show "Adapters initializing" state.
- `CandidateDetailSheet.tsx` and `EntryDetailCard.tsx`: Execution map values must only be shown as operator-ready when source is live-backed. When `dataSource !== 'LIVE'` or `priceData` has no live source, mark execution map as "Live source required" and disable execution readiness display.

### Remove
- MOCK button from RuntimeControlBar mode selector
- "MOCK" as a selectable mode in the main operator flow
- MOCK status badge from SurveillanceTab header (replace with CONNECTING/NOT READY states)
- `mockModeNotice` banner from UniverseBoard primary view
- "MOCK UNIVERSE" prominent header text from UniverseBoard
- `"Returned to MOCK mode"` toast message
- Any silent fallback that presents MOCK data as if it were live operator truth on primary screens

## Implementation Plan

1. **`runtimeManager.ts`** — Change default `useState<EngineMode>` initial value from `"MOCK"` to `"HYBRID_LIVE"`. Change `makeInitialRuntimeState("MOCK")` to `makeInitialRuntimeState("HYBRID_LIVE")`. Add a startup `useEffect` that auto-triggers `setMode("HYBRID_LIVE")` on mount so adapters initialize immediately.

2. **`RuntimeControlBar.tsx`** — Remove `"MOCK"` from the `EngineMode[]` array used for the mode selector buttons (both desktop and mobile expanded). The selector now only renders LIVE and HYBRID_LIVE buttons. Remove all MOCK-conditional styling blocks that are no longer needed. Add a connection-waiting state message when mode is not MOCK but no markets are connected yet.

3. **`App.tsx`** — Update `handleSetEngineMode` to remove the `"Returned to MOCK mode"` branch. Update the Universe section mobile header to remove `isMockMode`-conditional text that shows `"MOCK — Universe simulation"`. Add connection-state awareness to the sticky bar context. MoreDrawer `onNavigate` now receives a `onSetMode` prop so it can trigger MOCK from Dev Tools.

4. **`MoreDrawer.tsx`** — Add a second section below the existing items, separated by a visual divider. Label it `DEV TOOLS` (very small, muted). Add one item: "MOCK (Dev/Testing)" with a warning-style accent (amber/orange), description "Simulated data — not for trading decisions". This triggers `onSetMode("MOCK")` and closes the drawer.

5. **`UniverseBoard.tsx`** — Remove the prominent `MOCK MODE` header badge. Remove the `mockModeNotice` banner block. When `isMockMode` is true (reached via Dev Tools), show only a compact `[DEV]` chip in the source labels row. Keep `SourceLabel` but replace "Mock Universe" with "Simulated (Dev)".

6. **`UniverseDiagnostics.tsx`** — Remove operator-facing MOCK universe description text. Replace with compact `[DEV]` label when in mock mode.

7. **`SurveillanceTab.tsx`** — Replace `{isLive ? "LIVE" : "MOCK"}` badge logic. New logic: if `engineMode === "LIVE"` or `engineMode === "HYBRID_LIVE"` → show LIVE badge. If `engineMode === "MOCK"` → show tiny `[DEV]` label. Remove `isLive = engineMode !== "MOCK"` and replace with `isLiveMode = engineMode !== "MOCK"` but use it only for connection-state display, not for showing MOCK as a normal runtime choice.

8. **`CandidateDetailSheet.tsx`** — Pass `engineMode` through to EntryDetailCard. When `engineMode === "MOCK"`, mark execution map as dev-mode only.

9. **`EntryDetailCard.tsx`** — In `computeExecutionMap()` and the Execution Map render section: when `priceData` is null AND we are not in a live-backed mode, show "Live source required — connect to market" instead of computed values. Disable execution readiness indicator.

10. **`LiveDiagnosticsPanel.tsx`** — Remove the `mode === "MOCK"` specific box. Instead, the page header shows the current mode (LIVE/HYBRID) and an honest "adapters initializing" or "no connections" state when not yet connected.
