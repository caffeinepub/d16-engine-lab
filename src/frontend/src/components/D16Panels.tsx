import {
  type D16State,
  getScoreColor,
  scoreInterpretation,
} from "../d16Engine";
import {
  DIMENSION_LABELS,
  DIMENSION_SHORT_LABELS,
  GROUP_DIMS,
  GROUP_LABELS,
} from "../mockData";
import {
  DirectionBadge,
  ExecutionBadge,
  MaturityBadge,
  PriorityBadge,
  ScoreBar,
  TrustBadge,
} from "./D16Badges";

type DimensionGridProps = {
  state: D16State;
};

export function DimensionGrid({ state }: DimensionGridProps) {
  const { dimensions: d } = state;
  const dimKeys = Object.keys(d) as (keyof typeof d)[];

  return (
    <div className="grid grid-cols-4 gap-3">
      {dimKeys.map((key, idx) => {
        const value = d[key];
        const color = getScoreColor(value);
        const label = DIMENSION_LABELS[key];
        const shortLabel = DIMENSION_SHORT_LABELS[key];
        const interp = scoreInterpretation(value);

        // Determine group
        let groupDot = "bg-[#4DA6FF]";
        const groupA = [
          "d1_macroAccumulation",
          "d2_recentAccumulation",
          "d3_priceHoldIntegrity",
          "d4_compressionQuality",
          "d5_volumePersistence",
          "d6_releasePotential",
        ];
        const groupB = [
          "d7_directionalClarity",
          "d8_structuralCleanliness",
          "d9_multiTimeframeAlignment",
          "d10_activationQuality",
        ];
        const groupC = [
          "d11_triggerQuality",
          "d12_entryCleanliness",
          "d13_invalidationClarity",
          "d14_rewardFeasibility",
        ];
        if (groupA.includes(key)) groupDot = "bg-[#67E8F9]";
        else if (groupB.includes(key)) groupDot = "bg-[#86EFAC]";
        else if (groupC.includes(key)) groupDot = "bg-[#FACC15]";
        else groupDot = "bg-[#F87171]";

        return (
          <div
            key={key}
            className="bg-card border border-border rounded p-3 flex flex-col gap-2"
            data-ocid={`dimension.card.${idx + 1}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${groupDot}`}
                />
                <span
                  className="text-[10px] font-mono text-muted-foreground truncate"
                  title={label}
                >
                  {shortLabel}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {label.split("\u2014")[0].trim()}
              </span>
            </div>

            <div className="flex items-end justify-between">
              <span className="text-2xl font-mono font-bold" style={{ color }}>
                {value.toFixed(0)}
              </span>
              <span className="text-[10px] text-muted-foreground pb-0.5">
                {interp}
              </span>
            </div>

            <ScoreBar score={value} height={3} />
          </div>
        );
      })}
    </div>
  );
}

// ─── Group Score Cards ───

export function GroupScoreCards({ state }: { state: D16State }) {
  const { groups, dimensions: d } = state;
  const groupKeys = Object.keys(groups) as (keyof typeof groups)[];

  const groupColors: Record<string, string> = {
    contextBase: "#67E8F9",
    structuralTruth: "#86EFAC",
    executionFeasibility: "#FACC15",
    reliability: "#F87171",
  };

  return (
    <div className="grid grid-cols-4 gap-3">
      {groupKeys.map((gk) => {
        const score = groups[gk];
        const color = getScoreColor(score);
        const groupColor = groupColors[gk];
        const dims = GROUP_DIMS[gk];
        const label = GROUP_LABELS[gk];

        return (
          <div
            key={gk}
            className="bg-card border border-border rounded p-3 flex flex-col gap-3"
            data-ocid={`group.${gk}.card`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: groupColor }}
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                {label}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-3xl font-mono font-bold" style={{ color }}>
                {score.toFixed(1)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {scoreInterpretation(score)}
              </span>
            </div>

            <ScoreBar score={score} height={4} />

            <div className="space-y-1">
              {dims.map((dk) => (
                <div key={dk} className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground font-mono truncate flex-1 mr-2">
                    {DIMENSION_SHORT_LABELS[dk]}
                  </span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: getScoreColor(d[dk]) }}
                  >
                    {d[dk].toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Canonical Resolver Detail ───

export function CanonicalDetail({ state }: { state: D16State }) {
  const { canonical } = state;

  return (
    <div className="bg-card border border-border rounded p-4 space-y-4">
      <h3 className="text-[12px] font-semibold text-foreground tracking-wider uppercase">
        Canonical Resolver Output
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {/* Direction */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Direction
          </span>
          <div>
            <DirectionBadge direction={canonical.direction} />
          </div>
        </div>

        {/* Maturity */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Maturity
          </span>
          <div>
            <MaturityBadge maturity={canonical.maturity} size="md" />
          </div>
        </div>

        {/* Trust Class */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Trust Class
          </span>
          <div>
            <TrustBadge trustClass={canonical.trustClass} />
          </div>
        </div>

        {/* Operator Priority */}
        <div className="space-y-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Operator Priority
          </span>
          <div>
            <PriorityBadge priority={canonical.operatorPriority} />
          </div>
        </div>
      </div>

      {/* Execution Permission */}
      <div className="space-y-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          Execution Permission
        </span>
        <div>
          <ExecutionBadge permission={canonical.executionPermission} />
        </div>
      </div>

      {/* Main Blocker */}
      {canonical.mainBlocker ? (
        <div className="space-y-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Main Blocker
          </span>
          <div className="bg-[#200a0a] border border-[#4a1010] rounded p-2">
            <span className="text-[11px] font-mono text-[#F87171]">
              {canonical.mainBlocker}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Main Blocker
          </span>
          <div className="bg-[#052010] border border-[#0f5030] rounded p-2">
            <span className="text-[11px] font-mono text-[#22C55E]">
              None — all gates clear
            </span>
          </div>
        </div>
      )}

      {/* Next Promotion Condition */}
      {canonical.nextPromotionCondition && (
        <div className="space-y-1.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Next Promotion
          </span>
          <div className="bg-[#0d2540] border border-[#1a4080] rounded p-2">
            <span className="text-[11px] font-mono text-[#67E8F9]">
              {canonical.nextPromotionCondition}
            </span>
          </div>
        </div>
      )}

      {/* Recent Change Meaning */}
      <div className="space-y-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          State Meaning
        </span>
        <p className="text-[12px] text-foreground leading-relaxed">
          {canonical.recentChangeMeaning}
        </p>
      </div>
    </div>
  );
}
