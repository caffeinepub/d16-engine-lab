// D16 Engine Lab — More Drawer
// Bottom-anchored overlay that slides up when the "More" tab is tapped.
// Exposes Core, Validation, and Hybrid navigation items.
// v0.8.2+: Dev Tools section added at bottom — MOCK mode is only accessible here.

import {
  CheckSquare,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { EngineMode } from "../liveAdapterTypes";

// Mirror of MainTab from App.tsx — must stay in sync
export type MainTab =
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

type DrawerItem = {
  label: string;
  description: string;
  icon: React.ElementType;
  tab: MainTab;
  accentColor: string;
  accentBg: string;
};

const DRAWER_ITEMS: DrawerItem[] = [
  {
    label: "Core",
    description: "D16 engine dashboard, inspector, and editor",
    icon: LayoutDashboard,
    tab: "dashboard",
    accentColor: "oklch(0.70 0.15 260)",
    accentBg: "oklch(0.14 0.01 260)",
  },
  {
    label: "Validation",
    description: "Scenario harness and hybrid validation suite",
    icon: CheckSquare,
    tab: "validation",
    accentColor: "oklch(0.68 0.13 155)",
    accentBg: "oklch(0.13 0.01 155)",
  },
  {
    label: "Hybrid",
    description: "Hybrid dashboard, inspector, and entry board",
    icon: GitBranch,
    tab: "hybridDashboard",
    accentColor: "oklch(0.72 0.14 200)",
    accentBg: "oklch(0.13 0.01 200)",
  },
];

type MoreDrawerProps = {
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: MainTab) => void;
  onSetMode?: (mode: EngineMode) => void;
};

export function MoreDrawer({
  open,
  onClose,
  onNavigate,
  onSetMode,
}: MoreDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="more-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/70"
            onClick={onClose}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            role="button"
            tabIndex={0}
            aria-label="Close more menu"
          />

          {/* Panel */}
          <motion.div
            key="more-panel"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl"
            style={{
              background: "oklch(0.10 0.009 240)",
              borderTop: "1px solid oklch(0.22 0.010 240)",
              paddingBottom: "env(safe-area-inset-bottom, 16px)",
            }}
            data-ocid="more.drawer.panel"
          >
            {/* Handle bar + close */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-1 rounded-full"
                  style={{ background: "oklch(0.28 0.010 240)" }}
                />
                <span
                  className="text-[10px] font-mono tracking-widest"
                  style={{ color: "oklch(0.50 0.010 240)" }}
                >
                  MORE
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                style={{ color: "oklch(0.55 0.010 240)" }}
                data-ocid="more.drawer.close_button"
              >
                <X size={16} />
              </button>
            </div>

            {/* Navigation items */}
            <div className="px-4 pb-4 space-y-2">
              {DRAWER_ITEMS.map((item) => (
                <button
                  type="button"
                  key={item.tab}
                  onClick={() => {
                    onNavigate(item.tab);
                    onClose();
                  }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-all min-h-[64px] active:scale-[0.98]"
                  style={{
                    background: item.accentBg,
                    border: `1px solid ${item.accentColor}28`,
                  }}
                  data-ocid={`more.drawer.${item.tab}.link`}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${item.accentColor}18`,
                      border: `1px solid ${item.accentColor}35`,
                    }}
                  >
                    <item.icon
                      size={18}
                      style={{ color: item.accentColor }}
                      strokeWidth={1.8}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px] font-semibold font-mono leading-tight"
                      style={{ color: item.accentColor }}
                    >
                      {item.label.toUpperCase()}
                    </div>
                    <div
                      className="text-[10px] mt-0.5 leading-snug"
                      style={{ color: "oklch(0.52 0.010 240)" }}
                    >
                      {item.description}
                    </div>
                  </div>
                  <span
                    className="text-[14px] flex-shrink-0"
                    style={{ color: `${item.accentColor}70` }}
                  >
                    ›
                  </span>
                </button>
              ))}

              {/* ── Dev Tools divider ── */}
              <div className="flex items-center gap-3 pt-2 pb-1 opacity-50">
                <div
                  className="flex-1 h-px"
                  style={{ background: "oklch(0.22 0.010 240)" }}
                />
                <span
                  className="text-[8px] font-mono tracking-[0.2em] uppercase"
                  style={{ color: "oklch(0.40 0.010 240)" }}
                >
                  DEV TOOLS
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: "oklch(0.22 0.010 240)" }}
                />
              </div>

              {/* Dev Tools — MOCK / simulated testing */}
              <button
                type="button"
                onClick={() => {
                  onSetMode?.("MOCK");
                  onClose();
                }}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all min-h-[56px] active:scale-[0.98] opacity-60 hover:opacity-80"
                style={{
                  background: "oklch(0.11 0.015 50)",
                  border: "1px solid oklch(0.65 0.15 50 / 0.20)",
                }}
                data-ocid="more.drawer.devtools.mock_button"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "oklch(0.65 0.15 50 / 0.12)",
                    border: "1px solid oklch(0.65 0.15 50 / 0.28)",
                  }}
                >
                  <FlaskConical
                    size={16}
                    style={{ color: "oklch(0.65 0.15 50)" }}
                    strokeWidth={1.8}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12px] font-semibold font-mono leading-tight"
                    style={{ color: "oklch(0.65 0.15 50)" }}
                  >
                    MOCK / Dev Testing
                  </div>
                  <div
                    className="text-[9px] mt-0.5 leading-snug"
                    style={{ color: "oklch(0.45 0.010 240)" }}
                  >
                    Simulated data — not for trading decisions. Dev/testing
                    only.
                  </div>
                </div>
              </button>
            </div>

            {/* Footer hint */}
            <div
              className="px-5 pb-2 text-center"
              style={{ color: "oklch(0.38 0.008 240)" }}
            >
              <span className="text-[8px] font-mono tracking-widest">
                D16 ENGINE LAB · ENGINEERING SURFACES
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
