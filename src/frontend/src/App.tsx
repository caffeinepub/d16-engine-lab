import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster } from "@/components/ui/sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DirectionBadge,
  ExecutionBadge,
  MaturityBadge,
  PriorityBadge,
  TrustBadge,
} from "./components/D16Badges";
import {
  CanonicalDetail,
  DimensionGrid,
  GroupScoreCards,
} from "./components/D16Panels";
import { DimensionEditor } from "./components/DimensionEditor";
import { EntryBoard } from "./components/EntryBoard";
import { HybridDashboard } from "./components/HybridDashboard";
import { HybridDetailInspector } from "./components/HybridDetailInspector";
import { LiveDiagnosticsPanel } from "./components/LiveDiagnosticsPanel";
import { MobileBottomTabBar } from "./components/MobileBottomTabBar";
import type { MobileTab } from "./components/MobileBottomTabBar";
import { MobileStickyBar } from "./components/MobileStickyBar";
import { OutcomesDashboard } from "./components/OutcomesDashboard";
import { RuntimeControlBar } from "./components/RuntimeControlBar";
import { SurveillanceTab } from "./components/SurveillanceTab";
import { SymbolList } from "./components/SymbolList";
import { UniverseBoard } from "./components/UniverseBoard";
import { ValidationTab } from "./components/ValidationTab";
import {
  type D16State,
  type Dimensions,
  type RankingMode,
  dimensionsToScenarioInput,
  rankScenarios,
  resolveD16,
  scenarioToDimensions,
} from "./d16Engine";
import { useIsMobile } from "./hooks/use-mobile";
import { useActor } from "./hooks/useActor";
import { useAuditLog } from "./hooks/useAuditLog";
import type { EngineMode } from "./liveAdapterTypes";
import { DEFAULT_DIMS, PRESET_SCENARIOS } from "./mockData";
import type { PresetScenario } from "./mockData";
import { useRuntimeManager } from "./runtimeManager";
import { useUniverseScheduler } from "./universeScheduler";
import { useOutcomeEngine } from "./useOutcomeEngine";
import { useSurveillance } from "./useSurveillance";
import { STRESS_TEST_SCENARIOS, type UserScenario } from "./validationData";
import type { StressTestScenario } from "./validationData";

// ─── Helpers ───

const PRESET_STATES: D16State[] = PRESET_SCENARIOS.map((p) =>
  resolveD16(p.name, p.dims),
);

const STRESS_TEST_STATES: D16State[] = STRESS_TEST_SCENARIOS.map((sc) =>
  resolveD16(sc.name, sc.dims),
);

function getStateId(s: D16State): string {
  return s.id ? s.id.toString() : `local__${s.symbol}`;
}

// Ranking Mode tab labels
const RANKING_TABS: { mode: RankingMode; label: string }[] = [
  { mode: "structural", label: "Structural" },
  { mode: "preRelease", label: "Pre-Release" },
  { mode: "execution", label: "Execution" },
];

// Top-level navigation tabs
type MainTab =
  | "dashboard"
  | "inspector"
  | "editor"
  | "validation"
  | "hybridDashboard"
  | "hybridInspector"
  | "entryBoard"
  | "liveDiagnostics"
  | "outcomes"
  | "universeBoard"
  | "surveillanceBoard";

// Mobile section groups
type MobileSection =
  | "core"
  | "validation"
  | "hybrid"
  | "universe"
  | "surveillance"
  | "outcomes"
  | "runtime";

const CORE_TABS: { id: MainTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "inspector", label: "Detail Inspector" },
  { id: "editor", label: "Dimension Editor" },
];

const HYBRID_TABS: { id: MainTab; label: string }[] = [
  { id: "hybridDashboard", label: "Hybrid Dashboard" },
  { id: "hybridInspector", label: "Hybrid Inspector" },
  { id: "entryBoard", label: "Entry Board" },
  { id: "liveDiagnostics", label: "Runtime" },
  { id: "outcomes", label: "Outcomes" },
];

// Map mobile section to default main tab
const SECTION_DEFAULT_TAB: Record<MobileSection, MainTab> = {
  core: "dashboard",
  validation: "validation",
  hybrid: "hybridDashboard",
  outcomes: "outcomes",
  runtime: "liveDiagnostics",
  universe: "universeBoard",
  surveillance: "surveillanceBoard",
};

// Get current mobile section from main tab
function getMobileSection(tab: MainTab): MobileSection {
  if (tab === "validation") return "validation";
  if (tab === "liveDiagnostics") return "runtime";
  if (tab === "outcomes") return "outcomes";
  if (tab === "universeBoard") return "universe";
  if (tab === "surveillanceBoard") return "surveillance";
  if (
    tab === "hybridDashboard" ||
    tab === "hybridInspector" ||
    tab === "entryBoard"
  )
    return "hybrid";
  return "core";
}

// ─── App ───

export default function App() {
  const { actor, isFetching: actorFetching } = useActor();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // ── Core State ──
  const [activeTab, setActiveTab] = useState<MainTab>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(
    getStateId(PRESET_STATES[0]),
  );
  const [editorDims, setEditorDims] = useState<Dimensions>(
    PRESET_STATES[0].dimensions,
  );
  const [editorSymbolName, setEditorSymbolName] = useState<string>(
    PRESET_STATES[0].symbol,
  );
  const [rankingMode, setRankingMode] = useState<RankingMode>("structural");
  const [isNewScenario, setIsNewScenario] = useState(false);
  const [consoleLog, setConsoleLog] = useState<string[]>([]);
  const [userScenarios, setUserScenarios] = useState<UserScenario[]>([]);

  // Mobile-specific UI state
  const [mobileScenarioPanelOpen, setMobileScenarioPanelOpen] = useState(false);
  const [mobileDimEditorOpen, setMobileDimEditorOpen] = useState(false);

  const { auditEntries, addAuditEntry, clearAuditLog } = useAuditLog();

  // ── Hybrid / Live Runtime ──
  const {
    runtimeState,
    activeBundles,
    setMode: setEngineMode,
    isLiveMode,
    dataSource,
    getNormalizedState,
  } = useRuntimeManager();

  // ── Outcome Engine (v0.7) ──
  const outcomeEngine = useOutcomeEngine(
    activeBundles,
    runtimeState,
    runtimeState.mode,
  );

  // ── Universe Scheduler (v0.8) ──
  const universeScheduler = useUniverseScheduler(
    runtimeState.mode,
    getNormalizedState,
  );

  const [selectedUniverseAsset, setSelectedUniverseAsset] = useState<
    string | null
  >(null);

  // ── Surveillance Layer (v0.8.1) ──
  const surveillance = useSurveillance(universeScheduler.rankedRecords);

  // Quick-pin from Universe tab and navigate to Surveillance
  const handleWatchAsset = useCallback(
    (asset: string) => {
      surveillance.pinAsset(asset);
      setActiveTab("surveillanceBoard");
    },
    [surveillance],
  );

  const [selectedHybridAsset, setSelectedHybridAsset] = useState<string | null>(
    "BTC",
  );

  const isHybridTab =
    activeTab === "hybridDashboard" ||
    activeTab === "hybridInspector" ||
    activeTab === "entryBoard" ||
    activeTab === "liveDiagnostics" ||
    activeTab === "outcomes";

  const isUniverseTab = activeTab === "universeBoard";
  const isSurveillanceTab = activeTab === "surveillanceBoard";

  // Track previous committed state for audit diffs
  const prevCommittedStateRef = useRef<D16State | null>(null);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setConsoleLog((prev) => [...prev.slice(-20), `[${ts}] ${msg}`]);
  }, []);

  // ── Backend query ──
  const { data: backendScenarios, isLoading: scenariosLoading } = useQuery({
    queryKey: ["scenarios"],
    queryFn: async () => {
      if (!actor) return [];
      const raw = await actor.listAllScenarios();
      return raw.map((s) => {
        const dims = scenarioToDimensions(s);
        const id = (s as unknown as { id: bigint }).id ?? BigInt(0);
        return resolveD16(s.symbol, dims, id);
      });
    },
    enabled: !!actor && !actorFetching,
    staleTime: 30_000,
  });

  // Merge backend + presets
  const allStates = useMemo<D16State[]>(() => {
    const base =
      backendScenarios && backendScenarios.length > 0
        ? backendScenarios
        : PRESET_STATES;
    return rankScenarios(base, rankingMode);
  }, [backendScenarios, rankingMode]);

  const _selectedState = useMemo<D16State>(() => {
    if (selectedId) {
      const found = allStates.find((s) => getStateId(s) === selectedId);
      if (found) return found;
    }
    return allStates[0] ?? PRESET_STATES[0];
  }, [allStates, selectedId]);

  const editorResolvedState = useMemo<D16State>(() => {
    return resolveD16(editorSymbolName || "PREVIEW", editorDims);
  }, [editorSymbolName, editorDims]);

  const prevEditorMaturityRef = useRef<string | null>(null);
  useEffect(() => {
    const m = editorResolvedState.canonical.maturity;
    const d = editorResolvedState.canonical.direction;
    const ep = editorResolvedState.canonical.executionPermission;
    if (
      prevEditorMaturityRef.current !== null &&
      prevEditorMaturityRef.current !== m
    ) {
      addLog(`Maturity changed: ${prevEditorMaturityRef.current} \u2192 ${m}`);
    }
    prevEditorMaturityRef.current = m;
    addLog(
      `[${editorSymbolName || "PREVIEW"}] ${m} | ${d} | ${ep} | P=${editorResolvedState.canonical.operatorPriority}`,
    );
  }, [editorResolvedState, addLog, editorSymbolName]);

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async ({
      symbol,
      dims,
    }: { symbol: string; dims: Dimensions }) => {
      if (!actor) throw new Error("Actor not ready");
      const input = dimensionsToScenarioInput(symbol, dims);
      return actor.createScenario(input);
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      setSelectedId(newId.toString());
      setIsNewScenario(false);
      addLog(`Saved new scenario: ${editorSymbolName}`);
      toast.success("Scenario saved");
    },
    onError: () => toast.error("Failed to save scenario"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      symbol,
      dims,
    }: { id: bigint; symbol: string; dims: Dimensions }) => {
      if (!actor) throw new Error("Actor not ready");
      const input = dimensionsToScenarioInput(symbol, dims);
      return actor.updateScenario(id, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      addLog(`Updated scenario: ${editorSymbolName}`);
      toast.success("Scenario updated");
    },
    onError: () => toast.error("Failed to update scenario"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteScenario(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      setSelectedId(allStates[0] ? getStateId(allStates[0]) : null);
      addLog(`Deleted scenario: ${editorSymbolName}`);
      toast.success("Scenario deleted");
    },
    onError: () => toast.error("Failed to delete scenario"),
  });

  // ── Handlers ──
  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      setIsNewScenario(false);
      const found = allStates.find((s) => getStateId(s) === id);
      if (found) {
        setEditorDims(found.dimensions);
        setEditorSymbolName(found.symbol);
      }
    },
    [allStates],
  );

  const handleNewScenario = useCallback(() => {
    setIsNewScenario(true);
    setEditorDims(DEFAULT_DIMS);
    setEditorSymbolName("");
    setSelectedId(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!editorSymbolName.trim()) return;
    const existingBackend = backendScenarios?.find(
      (s) => getStateId(s) === selectedId && s.id !== undefined,
    );
    if (existingBackend?.id && !isNewScenario) {
      updateMutation.mutate({
        id: existingBackend.id,
        symbol: editorSymbolName,
        dims: editorDims,
      });
    } else {
      createMutation.mutate({ symbol: editorSymbolName, dims: editorDims });
    }
  }, [
    editorSymbolName,
    editorDims,
    selectedId,
    isNewScenario,
    backendScenarios,
    createMutation,
    updateMutation,
  ]);

  const handleDelete = useCallback(() => {
    const existingBackend = backendScenarios?.find(
      (s) => getStateId(s) === selectedId && s.id !== undefined,
    );
    if (existingBackend?.id) {
      deleteMutation.mutate(existingBackend.id);
    }
  }, [selectedId, backendScenarios, deleteMutation]);

  const canDelete = useMemo(() => {
    return !!backendScenarios?.find(
      (s) => getStateId(s) === selectedId && s.id !== undefined,
    );
  }, [backendScenarios, selectedId]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isEditing =
    !isNewScenario &&
    !!selectedId &&
    !!backendScenarios?.find((s) => getStateId(s) === selectedId);

  const displayState = useMemo(() => {
    if (isNewScenario || selectedId === null) return editorResolvedState;
    const selFound = allStates.find((s) => getStateId(s) === selectedId);
    if (selFound) return selFound;
    return editorResolvedState;
  }, [isNewScenario, selectedId, allStates, editorResolvedState]);

  const mainViewState = useMemo(() => displayState, [displayState]);

  const handleDimsCommit = useCallback(
    (committedDims: Dimensions) => {
      const newState = resolveD16(editorSymbolName || "PREVIEW", committedDims);
      const prevState = prevCommittedStateRef.current ?? newState;
      addAuditEntry(
        prevState,
        newState,
        "editor",
        editorSymbolName || "PREVIEW",
      );
      prevCommittedStateRef.current = newState;
    },
    [editorSymbolName, addAuditEntry],
  );

  const handleCloneScenario = useCallback(
    (source: StressTestScenario | PresetScenario) => {
      const id = `user_${Date.now()}`;
      const sourceName = "id" in source ? source.id : source.name;
      const newScenario: UserScenario = {
        id,
        name: `${source.name} (copy)`,
        sourceId: sourceName,
        dims: { ...source.dims },
        createdAt: new Date().toISOString(),
      };
      setUserScenarios((prev) => [...prev, newScenario]);
      toast.success(`Cloned: ${source.name}`);
    },
    [],
  );

  const handleLoadIntoEditor = useCallback(
    (dims: Dimensions, name: string) => {
      setEditorDims(dims);
      setEditorSymbolName(name);
      setActiveTab("editor");
      if (isMobile) setMobileDimEditorOpen(true);
      toast.success(`Loaded: ${name}`);
    },
    [isMobile],
  );

  const handleSetEngineMode = useCallback(
    (mode: EngineMode) => {
      setEngineMode(mode);
      if (mode !== "MOCK") {
        toast.success(`Switching to ${mode} mode — bootstrapping adapters...`);
      } else {
        toast.success("Returned to MOCK mode");
      }
    },
    [setEngineMode],
  );

  const handleManualCapture = useCallback(
    (asset: string) => {
      outcomeEngine.captureManual(asset);
      toast.success(`Snapshot captured: ${asset}`);
    },
    [outcomeEngine],
  );

  // Mobile tab switching
  const handleMobileTabChange = useCallback((section: MobileTab) => {
    const tab = SECTION_DEFAULT_TAB[section];
    setActiveTab(tab);
  }, []);

  // Current mobile section
  const currentMobileSection = getMobileSection(activeTab);

  // Determine sticky bar context
  const showStickyBar = useMemo(() => {
    if (!isMobile) return false;
    const section = getMobileSection(activeTab);
    if (section === "core") {
      // Only show when a scenario is selected
      return selectedId !== null;
    }
    if (
      section === "hybrid" ||
      section === "outcomes" ||
      section === "universe" ||
      section === "surveillance"
    )
      return true;
    return false;
  }, [isMobile, activeTab, selectedId]);

  const stickyBarContext = useMemo(() => {
    const section = getMobileSection(activeTab);
    if (section === "hybrid" && selectedHybridAsset) {
      const bundle = activeBundles.find(
        (b) => b.assetState.asset === selectedHybridAsset,
      );
      if (bundle) {
        return {
          contextName: bundle.assetState.asset,
          direction:
            bundle.correlation.leadMarket !== "NONE" ? "LONG" : "NEUTRAL",
          maturity: bundle.assetState.binanceSpot?.maturity ?? "EARLY",
          trust: bundle.assetState.binanceSpot?.trustClass ?? "REDUCED_TRUST",
          permission: bundle.entry.permissionLevel,
          mainBlocker: bundle.entry.mainBlocker,
        };
      }
    }
    // Core section
    return {
      contextName: mainViewState.symbol || "PREVIEW",
      direction: mainViewState.canonical.direction,
      maturity: mainViewState.canonical.maturity,
      trust: mainViewState.canonical.trustClass,
      permission: mainViewState.canonical.executionPermission,
      mainBlocker: mainViewState.canonical.mainBlocker ?? null,
    };
  }, [activeTab, selectedHybridAsset, activeBundles, mainViewState]);

  // Bottom padding for mobile bottom tab bar
  const mainBottomPad = isMobile ? "pb-16" : "";

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Toaster />

      {/* ─── LEFT SIDEBAR ─── (hidden on hybrid tabs; hidden on all mobile) */}
      {!isHybridTab && !isUniverseTab && !isSurveillanceTab && !isMobile && (
        <aside
          className="w-[220px] flex-shrink-0 flex flex-col border-r border-border bg-sidebar"
          data-ocid="sidebar.panel"
        >
          <SymbolList
            states={allStates}
            selectedId={selectedId}
            onSelect={handleSelect}
            onNewScenario={handleNewScenario}
            rankingMode={rankingMode}
          />
        </aside>
      )}

      {/* ─── MAIN CANVAS ─── */}
      <main
        className={`flex-1 flex flex-col min-w-0 overflow-hidden ${mainBottomPad}`}
      >
        {/* Top Header Row */}
        <header className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-sm">
          {/* Row 1: App name + status */}
          <div className="flex items-center justify-between px-3 md:px-5 h-10 border-b border-border/50">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="text-[13px] font-semibold text-foreground">
                D16 Engine Lab
              </span>
              <span className="text-border hidden sm:inline">|</span>
              <span className="text-[11px] text-muted-foreground font-mono hidden sm:inline">
                {mainViewState.symbol || "New Scenario"}
              </span>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {/* Mobile: Scenarios + Edit Dims buttons for Core section */}
              {isMobile && currentMobileSection === "core" && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMobileScenarioPanelOpen(true)}
                    className="px-2.5 py-1 text-[10px] font-mono rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                    data-ocid="mobile.scenarios.open_modal_button"
                  >
                    SCENARIOS
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDimEditorOpen(true)}
                    className="px-2.5 py-1 text-[10px] font-mono rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                    data-ocid="mobile.dim_editor.open_modal_button"
                  >
                    EDIT DIMS
                  </button>
                </div>
              )}

              {/* Desktop: Ranking mode tabs */}
              {!isMobile && activeTab === "dashboard" && (
                <div
                  className="flex items-center gap-1"
                  data-ocid="main.ranking_tab"
                >
                  {RANKING_TABS.map(({ mode, label }) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => setRankingMode(mode)}
                      className={`px-3 py-1 text-[10px] rounded font-medium transition-colors ${
                        rankingMode === mode
                          ? "bg-primary/20 text-primary border border-primary/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                      }`}
                      data-ocid={`main.${mode}.tab`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                {(actorFetching || scenariosLoading) && (
                  <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                    syncing...
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] d16-pulse" />
                  <span className="text-[10px] text-muted-foreground hidden sm:inline">
                    Engine
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Main navigation tabs (desktop only) */}
          {!isMobile && (
            <div className="flex items-center gap-0.5 px-5 h-9 overflow-x-auto">
              {/* CORE group */}
              <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest mr-1 flex-shrink-0">
                CORE
              </span>
              {CORE_TABS.map(({ id, label }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-2.5 py-1 text-[10px] font-mono font-medium rounded transition-colors flex-shrink-0 ${
                    activeTab === id
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  }`}
                  data-ocid={`main.${id}.tab`}
                >
                  {label.toUpperCase()}
                </button>
              ))}

              <span className="w-px h-4 bg-border/60 mx-2 flex-shrink-0" />

              {/* HYBRID group */}
              <span className="text-[9px] font-mono text-[#67E8F9]/50 uppercase tracking-widest mr-1 flex-shrink-0">
                HYBRID
              </span>
              {HYBRID_TABS.map(({ id, label }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-2.5 py-1 text-[10px] font-mono font-medium rounded transition-colors flex-shrink-0 ${
                    activeTab === id
                      ? id === "liveDiagnostics"
                        ? runtimeState.mode !== "MOCK"
                          ? "bg-[#052010] text-[#22C55E] border border-[#0f5030]"
                          : "bg-[#1a1a2a] text-[#a78bfa] border border-[#3d2f6b]"
                        : id === "outcomes"
                          ? "bg-[#1a0d2a] text-[#c084fc] border border-[#4a2080]"
                          : "bg-[#0d2540] text-[#67E8F9] border border-[#1a4080]"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  }`}
                  data-ocid={`main.${id}.tab`}
                >
                  {id === "liveDiagnostics" ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          runtimeState.mode !== "MOCK" &&
                          runtimeState.connectedMarketCount > 0
                            ? "bg-[#22C55E]"
                            : "bg-muted-foreground/40"
                        }`}
                      />
                      RUNTIME
                    </span>
                  ) : id === "outcomes" ? (
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${outcomeEngine.engineState.snapshots.length > 0 ? "bg-[#c084fc]" : "bg-muted-foreground/30"}`}
                      />
                      OUTCOMES
                    </span>
                  ) : (
                    label.toUpperCase()
                  )}
                </button>
              ))}

              <span className="w-px h-4 bg-border/60 mx-2 flex-shrink-0" />

              {/* UNIVERSE */}
              <button
                type="button"
                onClick={() => setActiveTab("universeBoard")}
                className={`px-2.5 py-1 text-[10px] font-mono font-medium rounded transition-colors flex-shrink-0 ${
                  activeTab === "universeBoard"
                    ? "bg-[#16082a] text-[#a78bfa] border border-[#3d1a60]"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                }`}
                data-ocid="main.universeBoard.tab"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${universeScheduler.rankedRecords.length > 0 ? "bg-[#a78bfa]" : "bg-muted-foreground/30"}`}
                  />
                  UNIVERSE
                </span>
              </button>

              {/* SURVEILLANCE */}
              <button
                type="button"
                onClick={() => setActiveTab("surveillanceBoard")}
                className={`px-2.5 py-1 text-[10px] font-mono font-medium rounded transition-colors flex-shrink-0 ${
                  activeTab === "surveillanceBoard"
                    ? "bg-[#1a1200] text-[#FACC15] border border-[#3a2800]"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                }`}
                data-ocid="main.surveillanceBoard.tab"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${surveillance.totalMonitored > 0 ? "bg-[#FACC15]" : "bg-muted-foreground/30"}`}
                  />
                  SURVEILLANCE
                </span>
              </button>

              <span className="w-px h-4 bg-border/60 mx-2 flex-shrink-0" />

              {/* VALIDATION */}
              <button
                type="button"
                onClick={() => setActiveTab("validation")}
                className={`px-2.5 py-1 text-[10px] font-mono font-medium rounded transition-colors flex-shrink-0 ${
                  activeTab === "validation"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                }`}
                data-ocid="main.validation.tab"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background:
                        auditEntries.length > 0 ? "#FACC15" : "#9AA3AD",
                    }}
                  />
                  VALIDATION
                </span>
              </button>
            </div>
          )}

          {/* Mobile sub-navigation for Core section */}
          {isMobile && currentMobileSection === "core" && (
            <div className="flex items-center gap-0.5 px-3 h-9 overflow-x-auto">
              {CORE_TABS.map(({ id, label }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-2.5 py-1 text-[10px] font-mono font-medium rounded transition-colors flex-shrink-0 ${
                    activeTab === id
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  }`}
                  data-ocid={`mobile.core.${id}.tab`}
                >
                  {label.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Mobile sub-navigation for Hybrid section */}
          {isMobile && currentMobileSection === "hybrid" && (
            <div className="flex items-center gap-0.5 px-3 h-9 overflow-x-auto">
              {HYBRID_TABS.filter(
                (t) => t.id !== "liveDiagnostics" && t.id !== "outcomes",
              ).map(({ id, label }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`px-2.5 py-1 text-[10px] font-mono font-medium rounded transition-colors flex-shrink-0 ${
                    activeTab === id
                      ? "bg-[#0d2540] text-[#67E8F9] border border-[#1a4080]"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                  }`}
                  data-ocid={`mobile.hybrid.${id}.tab`}
                >
                  {label.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          {/* Mobile indicator for Universe section */}
          {isMobile && currentMobileSection === "universe" && (
            <div className="flex items-center gap-2 px-3 h-9 border-t border-border/30">
              <span className="text-[9px] font-mono text-[#a78bfa]/70 uppercase tracking-widest">
                UNIVERSE
              </span>
              <span className="text-[8px] font-mono text-muted-foreground/40">
                {universeScheduler.isMockMode
                  ? "MOCK — 8 canonical assets"
                  : universeScheduler.runtimeStatus.discoveryPhase ===
                      "COMPLETE"
                    ? `${universeScheduler.runtimeStatus.discoveredAssets} discovered / ${universeScheduler.rankedRecords.length} ranked`
                    : universeScheduler.runtimeStatus.discoveryPhase === "ERROR"
                      ? `${universeScheduler.rankedRecords.length} ranked (discovery error)`
                      : universeScheduler.rankedRecords.length > 0
                        ? `${universeScheduler.rankedRecords.length} ranked (discovering...)`
                        : "LIVE — discovering universe..."}
              </span>
            </div>
          )}
          {/* Mobile indicator for Surveillance section */}
          {isMobile && currentMobileSection === "surveillance" && (
            <div className="flex items-center gap-2 px-3 h-9 border-t border-border/30">
              <span className="text-[9px] font-mono text-[#FACC15]/70 uppercase tracking-widest">
                SURVEILLANCE
              </span>
              <span className="text-[8px] font-mono text-muted-foreground/40">
                {surveillance.totalMonitored > 0
                  ? `${surveillance.totalMonitored} monitored · ${surveillance.autoSelectedCount} auto · ${surveillance.pinnedCount} pinned`
                  : "No candidates yet — open UNIVERSE to auto-select"}
              </span>
            </div>
          )}
        </header>

        {/* Mobile sticky context bar */}
        {showStickyBar && (
          <MobileStickyBar
            contextName={stickyBarContext.contextName}
            direction={stickyBarContext.direction}
            maturity={stickyBarContext.maturity}
            trust={stickyBarContext.trust}
            permission={stickyBarContext.permission}
            mainBlocker={stickyBarContext.mainBlocker}
          />
        )}

        {/* Runtime Control Bar — shown on HYBRID, UNIVERSE, and SURVEILLANCE tabs */}
        {(isHybridTab || isUniverseTab || isSurveillanceTab) && (
          <RuntimeControlBar
            runtimeState={runtimeState}
            dataSource={dataSource}
            onSetMode={handleSetEngineMode}
          />
        )}

        {/* Main Content Area */}
        {activeTab === "hybridDashboard" ? (
          <div className="flex-1 overflow-hidden">
            <HybridDashboard
              bundles={activeBundles}
              onSelectAsset={(a) => {
                setSelectedHybridAsset(a);
                setActiveTab("hybridInspector");
              }}
              selectedAsset={selectedHybridAsset}
              _dataSource={dataSource}
            />
          </div>
        ) : activeTab === "hybridInspector" ? (
          <div className="flex-1 overflow-hidden">
            <HybridDetailInspector
              bundle={
                activeBundles.find(
                  (b) => b.assetState.asset === selectedHybridAsset,
                ) ?? activeBundles[0]
              }
              allBundles={activeBundles}
              onSelectAsset={setSelectedHybridAsset}
            />
          </div>
        ) : activeTab === "entryBoard" ? (
          <div className="flex-1 overflow-hidden">
            <EntryBoard
              bundles={activeBundles}
              onSelectAsset={(a) => {
                setSelectedHybridAsset(a);
                setActiveTab("hybridInspector");
              }}
              _dataSource={dataSource}
            />
          </div>
        ) : activeTab === "liveDiagnostics" ? (
          <div className="flex-1 overflow-hidden">
            <LiveDiagnosticsPanel
              runtimeState={runtimeState}
              dataSource={dataSource}
              onSetMode={handleSetEngineMode}
            />
          </div>
        ) : activeTab === "outcomes" ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            <OutcomesDashboard
              engineResult={outcomeEngine}
              activeBundles={activeBundles}
              onManualCapture={handleManualCapture}
            />
          </div>
        ) : activeTab === "surveillanceBoard" ? (
          <div className="flex-1 overflow-hidden">
            <SurveillanceTab
              surveillance={surveillance}
              engineMode={runtimeState.mode}
            />
          </div>
        ) : activeTab === "universeBoard" ? (
          <div className="flex-1 overflow-hidden">
            <UniverseBoard
              rankedRecords={universeScheduler.rankedRecords}
              runtimeStatus={universeScheduler.runtimeStatus}
              assets={universeScheduler.assets}
              eligibility={universeScheduler.eligibility}
              tiers={universeScheduler.tiers}
              isMockMode={universeScheduler.isMockMode}
              mockModeNotice={universeScheduler.mockModeNotice}
              engineMode={runtimeState.mode}
              selectedAsset={selectedUniverseAsset}
              onSelectAsset={setSelectedUniverseAsset}
              onWatchAsset={handleWatchAsset}
            />
          </div>
        ) : activeTab === "validation" ? (
          <div className="flex-1 overflow-hidden">
            <ValidationTab
              editorState={editorResolvedState}
              presetStates={PRESET_STATES}
              stressTestStates={STRESS_TEST_STATES}
              userScenarios={userScenarios}
              auditEntries={auditEntries}
              onLoadIntoEditor={handleLoadIntoEditor}
              onCloneScenario={handleCloneScenario}
              onClearAuditLog={clearAuditLog}
            />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="px-3 md:px-5 py-4 space-y-5">
              {/* Summary Card */}
              <section
                className="bg-card border border-border rounded p-3 md:p-4"
                data-ocid="main.summary.card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-mono font-bold text-foreground">
                        {mainViewState.symbol || "PREVIEW"}
                      </span>
                      <MaturityBadge
                        maturity={mainViewState.canonical.maturity}
                        size="lg"
                      />
                    </div>
                    <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                      <DirectionBadge
                        direction={mainViewState.canonical.direction}
                      />
                      <TrustBadge
                        trustClass={mainViewState.canonical.trustClass}
                      />
                      <ExecutionBadge
                        permission={mainViewState.canonical.executionPermission}
                      />
                    </div>
                    {mainViewState.canonical.mainBlocker && (
                      <p className="text-[11px] text-[#F87171] font-mono">
                        &#9632; {mainViewState.canonical.mainBlocker}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                        Priority
                      </div>
                      <PriorityBadge
                        priority={mainViewState.canonical.operatorPriority}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {(
                        Object.entries(mainViewState.groups) as [
                          string,
                          number,
                        ][]
                      ).map(([k, v]) => (
                        <div key={k} className="text-right">
                          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
                            {k === "contextBase"
                              ? "CTX"
                              : k === "structuralTruth"
                                ? "STR"
                                : k === "executionFeasibility"
                                  ? "EXEC"
                                  : "REL"}
                          </div>
                          <div
                            className="text-[14px] font-mono font-bold"
                            style={{
                              color:
                                v >= 60
                                  ? "#22C55E"
                                  : v >= 40
                                    ? "#FACC15"
                                    : "#EF4444",
                            }}
                          >
                            {v.toFixed(0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground mt-3 italic">
                  {mainViewState.canonical.recentChangeMeaning}
                </p>
              </section>

              {(activeTab === "dashboard" || activeTab === "inspector") && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                      D16 Dimension Analysis
                    </h2>
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      16 dimensions — 0–100 normalized
                    </span>
                  </div>
                  <DimensionGrid state={mainViewState} />
                </section>
              )}

              {(activeTab === "dashboard" || activeTab === "inspector") && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Group Scores
                    </h2>
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      4 resolver groups
                    </span>
                  </div>
                  <GroupScoreCards state={mainViewState} />
                </section>
              )}

              <section>
                <div className="mb-3">
                  <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Canonical Resolver
                  </h2>
                </div>
                <CanonicalDetail state={mainViewState} />
              </section>

              {activeTab === "editor" && (
                <section>
                  <div className="mb-3">
                    <h2 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Live Editor Dimensions
                    </h2>
                  </div>
                  <DimensionGrid state={editorResolvedState} />
                </section>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Status Bar (hidden on mobile to save space) */}
        <footer className="flex-shrink-0 h-8 hidden md:flex items-center justify-between px-5 border-t border-border bg-background/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              <span className="text-[10px] text-muted-foreground">
                Operational
              </span>
            </div>
            <span className="text-border">|</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {allStates.length} scenarios
            </span>
            <span className="text-border">|</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {auditEntries.length} audit entries
            </span>
            <span className="text-border">|</span>
            {isLiveMode && (
              <>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                  <span className="text-[10px] font-mono text-[#22C55E]">
                    {runtimeState.mode}
                  </span>
                </span>
                <span className="text-border">|</span>
              </>
            )}
            <span className="text-[10px] text-muted-foreground font-mono">
              {new Date().toLocaleTimeString()}
            </span>
          </div>
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            &copy; {new Date().getFullYear()} Built with ❤ using caffeine.ai
          </a>
        </footer>
      </main>

      {/* ─── RIGHT PANEL ─── (hidden on hybrid tabs and all mobile) */}
      {!isHybridTab && !isUniverseTab && !isSurveillanceTab && !isMobile && (
        <aside
          className="w-[300px] flex-shrink-0 flex flex-col border-l border-border bg-sidebar"
          data-ocid="editor.panel"
        >
          <DimensionEditor
            dims={editorDims}
            symbolName={editorSymbolName}
            onDimsChange={setEditorDims}
            onSymbolNameChange={setEditorSymbolName}
            onSave={handleSave}
            onDelete={canDelete ? handleDelete : undefined}
            isSaving={isSaving}
            isEditing={isEditing}
            resolvedState={editorResolvedState}
            consoleLog={consoleLog}
            onDimsCommit={handleDimsCommit}
          />
        </aside>
      )}

      {/* ─── MOBILE BOTTOM TAB BAR ─── */}
      {isMobile && (
        <MobileBottomTabBar
          activeTab={currentMobileSection}
          onTabChange={handleMobileTabChange}
        />
      )}

      {/* ─── MOBILE SCENARIO PANEL OVERLAY ─── */}
      {isMobile && mobileScenarioPanelOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "oklch(0.09 0.005 240)" }}
          data-ocid="mobile.scenarios.modal"
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-[13px] font-semibold text-foreground">
              Scenarios
            </span>
            <button
              type="button"
              onClick={() => setMobileScenarioPanelOpen(false)}
              className="text-[11px] font-mono text-muted-foreground hover:text-foreground px-3 py-1.5 rounded border border-border"
              data-ocid="mobile.scenarios.close_button"
            >
              CLOSE
            </button>
          </div>

          {/* Mode selector */}
          <div className="flex-shrink-0 px-4 py-2 border-b border-border/50 flex items-center gap-2">
            <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
              Rank:
            </span>
            {RANKING_TABS.map(({ mode, label }) => (
              <button
                type="button"
                key={mode}
                onClick={() => setRankingMode(mode)}
                className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                  rankingMode === mode
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Scenario list */}
          <ScrollArea className="flex-1">
            <div className="py-2">
              {allStates.map((s, idx) => {
                const isActive = s.id
                  ? s.id.toString() === selectedId
                  : s.symbol === selectedId;
                return (
                  <button
                    type="button"
                    key={s.id?.toString() ?? s.symbol}
                    onClick={() => {
                      handleSelect(s.id ? s.id.toString() : s.symbol);
                      setMobileScenarioPanelOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-accent/30 border-b border-border/40 min-h-[56px] ${
                      isActive ? "bg-accent/50 border-l-2 border-l-primary" : ""
                    }`}
                    data-ocid={`mobile.scenarios.item.${idx + 1}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              s.canonical.maturity === "LIVE"
                                ? "bg-[#22C55E]"
                                : "bg-[#4DA6FF]"
                            }`}
                          />
                          <span className="text-[13px] font-semibold truncate text-foreground">
                            {s.symbol}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
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
              })}
            </div>
          </ScrollArea>

          {/* New scenario button */}
          <div className="flex-shrink-0 p-4 border-t border-border">
            <button
              type="button"
              onClick={() => {
                handleNewScenario();
                setMobileScenarioPanelOpen(false);
                setMobileDimEditorOpen(true);
              }}
              className="w-full h-11 text-[12px] font-mono bg-secondary hover:bg-accent border border-border text-foreground rounded transition-colors"
              data-ocid="mobile.scenarios.new_scenario_button"
            >
              + New Scenario
            </button>
          </div>
        </div>
      )}

      {/* ─── MOBILE DIMENSION EDITOR OVERLAY ─── */}
      {isMobile && mobileDimEditorOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "oklch(0.09 0.005 240)" }}
          data-ocid="mobile.dim_editor.panel"
        >
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-[13px] font-semibold text-foreground">
              Dimension Editor
            </span>
            <button
              type="button"
              onClick={() => setMobileDimEditorOpen(false)}
              className="px-4 py-1.5 text-[11px] font-mono bg-primary/20 text-primary border border-primary/30 rounded hover:bg-primary/30 transition-colors"
              data-ocid="mobile.dim_editor.close_button"
            >
              DONE
            </button>
          </div>

          {/* Editor fills remaining space */}
          <div className="flex-1 overflow-hidden">
            <DimensionEditor
              dims={editorDims}
              symbolName={editorSymbolName}
              onDimsChange={setEditorDims}
              onSymbolNameChange={setEditorSymbolName}
              onSave={() => {
                handleSave();
                setMobileDimEditorOpen(false);
              }}
              onDelete={canDelete ? handleDelete : undefined}
              isSaving={isSaving}
              isEditing={isEditing}
              resolvedState={editorResolvedState}
              consoleLog={consoleLog}
              onDimsCommit={handleDimsCommit}
              isMobileOverlay
            />
          </div>
        </div>
      )}
    </div>
  );
}
