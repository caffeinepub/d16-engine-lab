// D16 Engine Lab v0.8.1 — Mobile Bottom Tab Bar
// Fixed bottom navigation for mobile operators. Desktop: hidden.
// 7 sections: Core / Validation / Hybrid / Universe / Surveillance / Outcomes / Runtime

import {
  Activity,
  BarChart2,
  CheckSquare,
  Eye,
  GitBranch,
  Globe,
  LayoutDashboard,
} from "lucide-react";

export type MobileTab =
  | "core"
  | "validation"
  | "hybrid"
  | "universe"
  | "surveillance"
  | "outcomes"
  | "runtime";

type MobileBottomTabBarProps = {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
};

const TABS: { id: MobileTab; label: string; icon: React.ElementType }[] = [
  { id: "core", label: "Core", icon: LayoutDashboard },
  { id: "validation", label: "Valid.", icon: CheckSquare },
  { id: "hybrid", label: "Hybrid", icon: GitBranch },
  { id: "universe", label: "Univ.", icon: Globe },
  { id: "surveillance", label: "Surv.", icon: Eye },
  { id: "outcomes", label: "Outcomes", icon: BarChart2 },
  { id: "runtime", label: "Runtime", icon: Activity },
];

export function MobileBottomTabBar({
  activeTab,
  onTabChange,
}: MobileBottomTabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: "oklch(0.11 0.007 240)",
        borderTop: "1px solid oklch(0.21 0.009 240)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      data-ocid="mobile.bottom_tab.panel"
    >
      <div className="flex items-stretch">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          // Per-tab accent colors
          const activeColor =
            id === "universe"
              ? "oklch(0.75 0.15 270)"
              : id === "surveillance"
                ? "oklch(0.78 0.14 55)" // amber/gold
                : "oklch(0.7 0.15 200)";
          const activeBg =
            id === "universe"
              ? "oklch(0.15 0.01 270)"
              : id === "surveillance"
                ? "oklch(0.14 0.01 55)"
                : "oklch(0.15 0.01 200)";
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] transition-colors"
              style={{
                color: isActive ? activeColor : "oklch(0.55 0.008 240)",
                background: isActive ? activeBg : "transparent",
                borderTop: isActive
                  ? `2px solid ${activeColor}`
                  : "2px solid transparent",
              }}
              data-ocid={`mobile.bottom_tab.${id}.tab`}
            >
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              <span
                className="text-[8px] font-mono tracking-wide leading-none"
                style={{ fontWeight: isActive ? 600 : 400 }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
