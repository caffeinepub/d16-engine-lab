// D16 Engine Lab v0.8.1 → v0.9 — Mobile Bottom Tab Bar
// 5-tab structure: Universe / Surveillance / Outcomes / Runtime / More
// Core, Validation, and Hybrid moved to MoreDrawer.

import { Activity, BarChart2, Eye, Globe, MoreHorizontal } from "lucide-react";

export type MobileTab =
  | "universe"
  | "surveillance"
  | "outcomes"
  | "runtime"
  | "more";

type MobileBottomTabBarProps = {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
};

const TABS: {
  id: MobileTab;
  label: string;
  icon: React.ElementType;
  accentColor?: string;
  accentBg?: string;
}[] = [
  {
    id: "universe",
    label: "Universe",
    icon: Globe,
    accentColor: "oklch(0.75 0.15 270)",
    accentBg: "oklch(0.14 0.01 270)",
  },
  {
    id: "surveillance",
    label: "Surv.",
    icon: Eye,
    accentColor: "oklch(0.78 0.14 55)",
    accentBg: "oklch(0.13 0.01 55)",
  },
  {
    id: "outcomes",
    label: "Outcomes",
    icon: BarChart2,
    accentColor: "oklch(0.72 0.14 300)",
    accentBg: "oklch(0.13 0.01 300)",
  },
  {
    id: "runtime",
    label: "Runtime",
    icon: Activity,
    accentColor: "oklch(0.70 0.15 200)",
    accentBg: "oklch(0.13 0.01 200)",
  },
  {
    id: "more",
    label: "More",
    icon: MoreHorizontal,
    accentColor: "oklch(0.60 0.008 240)",
    accentBg: "oklch(0.13 0.005 240)",
  },
];

export function MobileBottomTabBar({
  activeTab,
  onTabChange,
}: MobileBottomTabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: "oklch(0.10 0.007 240)",
        borderTop: "1px solid oklch(0.20 0.009 240)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
      data-ocid="mobile.bottom_tab.panel"
    >
      <div className="flex items-stretch">
        {TABS.map(({ id, label, icon: Icon, accentColor, accentBg }) => {
          const isActive = activeTab === id;
          const color = accentColor ?? "oklch(0.70 0.15 200)";
          const bg = accentBg ?? "oklch(0.13 0.01 200)";
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[52px] transition-colors"
              style={{
                color: isActive ? color : "oklch(0.50 0.008 240)",
                background: isActive ? bg : "transparent",
                borderTop: isActive
                  ? `2px solid ${color}`
                  : "2px solid transparent",
              }}
              data-ocid={`mobile.bottom_tab.${id}.tab`}
            >
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.5} />
              <span
                className="text-[8px] font-mono tracking-wide leading-none mt-0.5"
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
