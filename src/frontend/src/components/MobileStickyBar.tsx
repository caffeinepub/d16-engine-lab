// D16 Engine Lab v0.7.1 — Mobile Sticky Context Bar
// Shown when an asset or scenario is active. Desktop: hidden.

type MobileStickyBarProps = {
  contextName: string;
  direction: string;
  maturity: string;
  trust: string;
  permission: string;
  mainBlocker: string | null;
};

function DirectionPip({ direction }: { direction: string }) {
  if (direction === "LONG")
    return (
      <span className="text-[10px] font-mono text-[#22C55E] font-bold">
        ▲ L
      </span>
    );
  if (direction === "SHORT")
    return (
      <span className="text-[10px] font-mono text-[#EF4444] font-bold">
        ▼ S
      </span>
    );
  return <span className="text-[10px] font-mono text-[#9AA3AD]">—</span>;
}

function SmallBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono border font-semibold"
      style={{
        color,
        borderColor: `${color}40`,
        background: `${color}15`,
      }}
    >
      {label}
    </span>
  );
}

const MATURITY_COLORS: Record<string, string> = {
  EARLY: "#9AA3AD",
  BREWING: "#6B8FBF",
  FORMING: "#5B9BD5",
  ACTIVE: "#4DA6FF",
  ARMED: "#86EFAC",
  READY: "#22C55E",
  LIVE: "#10b981",
  DECAY: "#FACC15",
  CANCELLED: "#EF4444",
};

const TRUST_COLORS: Record<string, string> = {
  HIGH_TRUST: "#22C55E",
  GOOD_TRUST: "#86EFAC",
  REDUCED_TRUST: "#FACC15",
  LOW_TRUST: "#F87171",
  INVALID_RUNTIME: "#EF4444",
  FULL: "#22C55E",
  REDUCED: "#FACC15",
  PARTIAL: "#F97316",
  BLOCKED: "#EF4444",
};

const PERM_COLORS: Record<string, string> = {
  EXACT: "#22C55E",
  PROVISIONAL: "#67E8F9",
  PROJECTED_ONLY: "#93C5FD",
  WATCH_ONLY: "#FACC15",
  BLOCKED: "#EF4444",
  NO_PLAN: "#9AA3AD",
  EXACT_PLAN: "#22C55E",
  PROVISIONAL_PLAN: "#67E8F9",
  PROJECTED_ENTRY_ONLY: "#93C5FD",
  WATCH_ONLY_H: "#FACC15",
  EXACT_ENTRY_ALLOWED: "#22C55E",
  PROVISIONAL_ENTRY_ALLOWED: "#67E8F9",
};

export function MobileStickyBar({
  contextName,
  direction,
  maturity,
  trust,
  permission,
  mainBlocker,
}: MobileStickyBarProps) {
  const matColor = MATURITY_COLORS[maturity] ?? "#9AA3AD";
  const trustColor = TRUST_COLORS[trust] ?? "#9AA3AD";
  const permColor = PERM_COLORS[permission] ?? "#9AA3AD";

  return (
    <div
      className="sticky top-0 z-40 md:hidden flex-shrink-0"
      style={{
        background: "oklch(0.11 0.007 240)",
        borderBottom: "1px solid oklch(0.21 0.009 240)",
      }}
      data-ocid="mobile.sticky_bar.panel"
    >
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
        {/* Context name */}
        <span className="text-[12px] font-mono font-bold text-foreground mr-1">
          {contextName}
        </span>

        {/* Direction */}
        <DirectionPip direction={direction} />

        {/* Maturity */}
        <SmallBadge label={maturity} color={matColor} />

        {/* Trust */}
        <SmallBadge label={trust.replace(/_/g, " ")} color={trustColor} />

        {/* Permission */}
        <SmallBadge label={permission.replace(/_/g, " ")} color={permColor} />

        {/* Blocker pill (truncated) */}
        {mainBlocker && (
          <span className="text-[9px] font-mono text-[#F87171] truncate max-w-[140px]">
            ■{" "}
            {mainBlocker.length > 30
              ? `${mainBlocker.slice(0, 30)}…`
              : mainBlocker}
          </span>
        )}
      </div>
    </div>
  );
}
