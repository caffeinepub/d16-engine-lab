import { useMemo } from "react";
import type {
  Direction,
  ExecutionPermission,
  Maturity,
  TrustClass,
} from "../d16Engine";

// ─── Maturity Badge ───

const MATURITY_COLORS: Record<Maturity, string> = {
  EARLY: "bg-[#1a1a2e] text-[#9AA3AD] border border-[#2A3038]",
  BREWING: "bg-[#1a1a2e] text-[#6B8FBF] border border-[#2a3a54]",
  FORMING: "bg-[#1a2530] text-[#5B9BD5] border border-[#2a4060]",
  ACTIVE: "bg-[#0d2540] text-[#4DA6FF] border border-[#1a4080]",
  ARMED: "bg-[#1a2a10] text-[#86EFAC] border border-[#2a5020]",
  READY: "bg-[#0d2010] text-[#22C55E] border border-[#1a5020]",
  LIVE: "bg-[#052010] text-[#10b981] border border-[#0f5030]",
  DECAY: "bg-[#2a1a00] text-[#FACC15] border border-[#4a3000]",
  CANCELLED: "bg-[#200a0a] text-[#EF4444] border border-[#4a1010]",
};

export function MaturityBadge({
  maturity,
  size = "sm",
}: { maturity: Maturity; size?: "sm" | "md" | "lg" }) {
  const sizeClasses =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5"
      : size === "md"
        ? "text-xs px-2 py-1"
        : "text-sm px-3 py-1.5 font-semibold";
  return (
    <span
      className={`inline-flex items-center rounded font-mono font-medium tracking-wider ${MATURITY_COLORS[maturity]} ${sizeClasses}`}
    >
      {maturity}
    </span>
  );
}

// ─── Direction Badge ───

export function DirectionBadge({ direction }: { direction: Direction }) {
  if (direction === "LONG") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#22C55E]">
        <span>▲</span> LONG
      </span>
    );
  }
  if (direction === "SHORT") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#EF4444]">
        <span>▼</span> SHORT
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#9AA3AD]">
      <span>—</span> NEUTRAL
    </span>
  );
}

// ─── TrustClass Badge ───

const TRUST_COLORS: Record<TrustClass, string> = {
  HIGH_TRUST: "text-[#22C55E]",
  GOOD_TRUST: "text-[#86EFAC]",
  REDUCED_TRUST: "text-[#FACC15]",
  LOW_TRUST: "text-[#F87171]",
  INVALID_RUNTIME: "text-[#EF4444]",
};

export function TrustBadge({ trustClass }: { trustClass: TrustClass }) {
  return (
    <span
      className={`text-[11px] font-mono font-medium ${TRUST_COLORS[trustClass]}`}
    >
      {trustClass.replace(/_/g, " ")}
    </span>
  );
}

// ─── Execution Permission Badge ───

const EXEC_COLORS: Record<ExecutionPermission, string> = {
  NO_PLAN: "bg-[#1a1010] text-[#9AA3AD] border-[#2A3038]",
  PROJECTED_ONLY: "bg-[#1a1a10] text-[#FACC15] border-[#3a3010]",
  PROVISIONAL_PLAN: "bg-[#102020] text-[#67E8F9] border-[#104040]",
  EXACT_PLAN: "bg-[#052010] text-[#22C55E] border-[#0f5030]",
  LIVE_MANAGEMENT: "bg-[#051a10] text-[#10b981] border-[#0f4030]",
};

export function ExecutionBadge({
  permission,
}: { permission: ExecutionPermission }) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${EXEC_COLORS[permission]}`}
    >
      {permission.replace(/_/g, " ")}
    </span>
  );
}

// ─── Score Bar ───

export function ScoreBar({
  score,
  height = 4,
}: { score: number; height?: number }) {
  const color = useMemo(() => {
    if (score <= 30) return "#EF4444";
    if (score <= 45) return "#F87171";
    if (score <= 60) return "#FACC15";
    if (score <= 75) return "#86EFAC";
    return "#22C55E";
  }, [score]);

  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, background: "oklch(0.21 0.009 240)" }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${score}%`, background: color }}
      />
    </div>
  );
}

// ─── Score Chip (compact score display) ───

export function ScoreChip({ score }: { score: number }) {
  const color = useMemo(() => {
    if (score <= 30) return "#EF4444";
    if (score <= 45) return "#F87171";
    if (score <= 60) return "#FACC15";
    if (score <= 75) return "#86EFAC";
    return "#22C55E";
  }, [score]);

  return (
    <span className="text-sm font-mono font-semibold" style={{ color }}>
      {score.toFixed(0)}
    </span>
  );
}

// ─── Priority Ring ───

export function PriorityBadge({ priority }: { priority: number }) {
  const color =
    priority >= 70
      ? "#22C55E"
      : priority >= 50
        ? "#FACC15"
        : priority >= 30
          ? "#F87171"
          : "#EF4444";
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-mono font-bold border"
      style={{ color, borderColor: `${color}44`, background: `${color}11` }}
    >
      {priority}
    </span>
  );
}
