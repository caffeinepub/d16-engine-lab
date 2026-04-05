// D16 Hybrid v0.8.1 — Surveillance Card
// Per-candidate monitoring card. Mobile-first, stacked layout.
// Shows: asset, bucket, source badge, rank delta, permission transition,
// lead market, trust, blocker, last 5 events, pin/unpin, priority override.

import { useState } from "react";
import { useIsMobile } from "../hooks/use-mobile";
import type {
  SurveillanceBucket,
  SurveillanceCandidate,
  SurveillanceEventSeverity,
  SurveillancePriorityLevel,
} from "../surveillanceTypes";
import {
  PERMISSION_ORDER,
  SURVEILLANCE_BUCKET_COLORS,
  SURVEILLANCE_BUCKET_LABELS,
  SURVEILLANCE_VISIBLE_EVENT_COUNT,
} from "../surveillanceTypes";

// ─── Source badge ─────────────────────────────────────────────────────

function SourceBadge({ source }: { source: SurveillanceCandidate["source"] }) {
  const config = {
    AUTO_RANKED: { label: "AUTO", color: "#67E8F9", bg: "#031820" },
    OPERATOR_PINNED: { label: "PINNED", color: "#FACC15", bg: "#1a1000" },
    BOTH: { label: "AUTO+PIN", color: "#a78bfa", bg: "#100a20" },
  }[source];
  return (
    <span
      className="text-[8px] font-mono px-1.5 py-0.5 rounded border"
      style={{
        color: config.color,
        background: config.bg,
        borderColor: `${config.color}40`,
      }}
    >
      {config.label}
    </span>
  );
}

// ─── Bucket badge ─────────────────────────────────────────────────────

function BucketBadge({ bucket }: { bucket: SurveillanceBucket }) {
  const color = SURVEILLANCE_BUCKET_COLORS[bucket];
  const label = SURVEILLANCE_BUCKET_LABELS[bucket];
  return (
    <span
      className="text-[8px] font-mono px-1.5 py-0.5 rounded"
      style={{
        color,
        background: `${color}18`,
        border: `1px solid ${color}40`,
      }}
    >
      {label}
    </span>
  );
}

// ─── Rank delta ───────────────────────────────────────────────────────

function RankBadge({
  current,
  delta,
}: { current: number; delta: number | null }) {
  const deltaEl =
    delta === null || delta === 0 ? null : delta < 0 ? (
      <span className="text-[#22C55E] text-[9px] font-mono">
        ▲{Math.abs(delta)}
      </span>
    ) : (
      <span className="text-[#F87171] text-[9px] font-mono">▼{delta}</span>
    );
  return (
    <div className="flex items-center gap-1">
      <span className="text-[13px] font-mono font-bold text-foreground">
        {current === 9999 ? "—" : `#${current}`}
      </span>
      {current !== 9999 && deltaEl}
    </div>
  );
}

// ─── Permission pill ─────────────────────────────────────────────────────

function permissionColor(level: string): string {
  switch (level) {
    case "EXACT":
      return "#22C55E";
    case "PROVISIONAL":
      return "#67E8F9";
    case "PROJECTED_ONLY":
      return "#93C5FD";
    case "WATCH_ONLY":
      return "#FACC15";
    case "BLOCKED":
      return "#EF4444";
    default:
      return "#9CA3AF";
  }
}

function PermissionPill({
  level,
  prev,
}: { level: string; prev?: string | null }) {
  const color = permissionColor(level);
  const prevOrd = prev ? (PERMISSION_ORDER[prev] ?? -1) : -1;
  const currOrd = PERMISSION_ORDER[level] ?? -1;
  const improved = prev && currOrd > prevOrd;
  const degraded = prev && currOrd < prevOrd;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-[9px] font-mono px-1.5 py-0.5 rounded"
        style={{
          color,
          background: `${color}18`,
          border: `1px solid ${color}40`,
        }}
      >
        {level}
      </span>
      {improved && (
        <span className="text-[8px] font-mono text-[#22C55E]">▲ {prev}</span>
      )}
      {degraded && (
        <span className="text-[8px] font-mono text-[#F87171]">▼ {prev}</span>
      )}
    </div>
  );
}

// ─── Event severity styling ────────────────────────────────────────────────

function severityColor(s: SurveillanceEventSeverity): string {
  switch (s) {
    case "URGENT":
      return "#22C55E";
    case "POSITIVE":
      return "#67E8F9";
    case "NEGATIVE":
      return "#F87171";
    default:
      return "#9CA3AF";
  }
}

function severitySymbol(s: SurveillanceEventSeverity): string {
  switch (s) {
    case "URGENT":
      return "◆";
    case "POSITIVE":
      return "▲";
    case "NEGATIVE":
      return "▼";
    default:
      return "—";
  }
}

// ─── Priority pill ───────────────────────────────────────────────────────

function priorityLabel(priority: SurveillanceCandidate["priority"]): string {
  const level =
    priority.mode === "OVERRIDE" ? priority.level : priority.derivedLevel;
  const suffix = priority.mode === "OVERRIDE" ? " • OP" : "";
  return `${level}${suffix}`;
}

function priorityColor(level: SurveillancePriorityLevel): string {
  switch (level) {
    case "HIGH":
      return "#F97316";
    case "MEDIUM":
      return "#FACC15";
    case "LOW":
      return "#9CA3AF";
  }
}

// ─── Main Card ─────────────────────────────────────────────────────────

type SurveillanceCardProps = {
  candidate: SurveillanceCandidate;
  onPin: (asset: string) => void;
  onUnpin: (asset: string) => void;
  onSetPriority: (asset: string, level: SurveillancePriorityLevel) => void;
  onClearPriority: (asset: string) => void;
  onDismiss: (asset: string) => void;
  isPinned: boolean;
};

export function SurveillanceCard({
  candidate,
  onPin,
  onUnpin,
  onSetPriority,
  onClearPriority,
  onDismiss,
  isPinned,
}: SurveillanceCardProps) {
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const _isMobile = useIsMobile();

  const { currentRecord, previousRecord } = candidate;
  const prevPermission = previousRecord?.permissionLevel ?? null;
  const priorityLevel =
    candidate.priority.mode === "OVERRIDE"
      ? candidate.priority.level
      : candidate.priority.derivedLevel;

  const visibleEvents = showAllEvents
    ? candidate.events.slice().reverse()
    : candidate.events.slice(-SURVEILLANCE_VISIBLE_EVENT_COUNT).reverse();

  const bucketColor = SURVEILLANCE_BUCKET_COLORS[candidate.bucket];
  const cardBorderColor =
    candidate.bucket === "EXACT_NOW"
      ? "#22C55E40"
      : candidate.bucket === "NEAR_EXACT"
        ? "#67E8F940"
        : candidate.bucket === "ESCALATING"
          ? "#FACC1540"
          : candidate.bucket === "THESIS_BROKEN"
            ? "#EF444440"
            : "rgba(255,255,255,0.06)";

  return (
    <div
      className="rounded border bg-[#0a0e14] p-3 space-y-2.5"
      style={{ borderColor: cardBorderColor }}
      data-ocid={`surveillance.card.${candidate.asset}`}
    >
      {/* ── Row 1: Asset + Rank + Badges ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14px] font-mono font-bold text-foreground">
            {candidate.asset}
          </span>
          <RankBadge
            current={candidate.currentRank}
            delta={candidate.rankDelta}
          />
          <BucketBadge bucket={candidate.bucket} />
          <SourceBadge source={candidate.source} />
          {candidate.isStale && (
            <span className="text-[8px] font-mono text-[#F97316]/70 border border-[#F97316]/30 px-1 py-0.5 rounded">
              STALE
            </span>
          )}
        </div>

        {/* Priority + actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Priority */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPriorityMenu((v) => !v)}
              className="text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors"
              style={{
                color: priorityColor(priorityLevel),
                borderColor: `${priorityColor(priorityLevel)}40`,
                background: `${priorityColor(priorityLevel)}10`,
              }}
              title="Change priority"
            >
              {priorityLabel(candidate.priority)}
            </button>
            {showPriorityMenu && (
              <div
                className="absolute right-0 top-6 z-20 bg-[#0d1218] border border-border/60 rounded shadow-lg py-1 min-w-[100px]"
                onMouseLeave={() => setShowPriorityMenu(false)}
              >
                {(["HIGH", "MEDIUM", "LOW"] as SurveillancePriorityLevel[]).map(
                  (lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => {
                        onSetPriority(candidate.asset, lvl);
                        setShowPriorityMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[9px] font-mono hover:bg-accent/30 transition-colors"
                      style={{ color: priorityColor(lvl) }}
                    >
                      {lvl}
                    </button>
                  ),
                )}
                {candidate.priority.mode === "OVERRIDE" && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearPriority(candidate.asset);
                      setShowPriorityMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[9px] font-mono text-muted-foreground hover:bg-accent/30 transition-colors border-t border-border/40 mt-0.5"
                  >
                    Reset to AUTO
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pin/Unpin */}
          <button
            type="button"
            onClick={() =>
              isPinned ? onUnpin(candidate.asset) : onPin(candidate.asset)
            }
            className={`text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
              isPinned
                ? "text-[#FACC15] border-[#FACC15]/40 bg-[#1a1000]"
                : "text-muted-foreground border-border/40 hover:text-[#FACC15] hover:border-[#FACC15]/40"
            }`}
            title={isPinned ? "Unpin" : "Pin to surveillance"}
          >
            {isPinned ? "★" : "☆"}
          </button>

          {/* Dismiss (only for non-pinned auto candidates) */}
          {!isPinned && candidate.source === "AUTO_RANKED" && (
            <button
              type="button"
              onClick={() => onDismiss(candidate.asset)}
              className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-border/40 text-muted-foreground/50 hover:text-[#F87171] hover:border-[#F87171]/40 transition-colors"
              title="Dismiss from surveillance"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Row 2: Permission + Entry class + Side ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <PermissionPill
          level={currentRecord.permissionLevel}
          prev={prevPermission}
        />
        {currentRecord.entryClass !== "NONE" && (
          <span className="text-[9px] font-mono text-muted-foreground/70 border border-border/30 px-1.5 py-0.5 rounded">
            {currentRecord.entryClass}
          </span>
        )}
        <span
          className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
            currentRecord.side === "LONG"
              ? "text-[#22C55E] bg-[#052010] border border-[#22C55E]/30"
              : currentRecord.side === "SHORT"
                ? "text-[#F87171] bg-[#200508] border border-[#F87171]/30"
                : "text-muted-foreground/50"
          }`}
        >
          {currentRecord.side}
        </span>
        <span className="text-[8px] font-mono text-muted-foreground/40">
          T{currentRecord.tier.replace("TIER_", "")}
        </span>
      </div>

      {/* ── Row 3: Lead market + Divergence + Trust ── */}
      <div className="flex items-center gap-3 flex-wrap text-[9px] font-mono">
        <div>
          <span className="text-muted-foreground/40">Lead </span>
          <span className="text-muted-foreground/80">
            {currentRecord.leadMarket.replace(/_/g, " ")}
          </span>
        </div>
        {currentRecord.divergenceType !== "NONE" && (
          <div>
            <span className="text-muted-foreground/40">Div </span>
            <span className="text-muted-foreground/70">
              {currentRecord.divergenceType.replace(/_/g, " ")}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground/40">Trust </span>
          <span
            style={{
              color:
                currentRecord.runtimeTrust >= 70
                  ? "#22C55E"
                  : currentRecord.runtimeTrust >= 40
                    ? "#FACC15"
                    : "#EF4444",
            }}
          >
            {currentRecord.runtimeTrust}%
          </span>
        </div>
      </div>

      {/* ── Row 4: Blocker or unlock reason ── */}
      {currentRecord.mainBlocker && (
        <div
          className={`text-[9px] font-mono leading-snug ${
            currentRecord.mainBlocker === "Awaiting first hydration"
              ? "text-[#F97316]/60"
              : "text-[#F87171]/80"
          }`}
        >
          {currentRecord.mainBlocker === "Awaiting first hydration" ? "⟳" : "■"}{" "}
          {currentRecord.mainBlocker}
        </div>
      )}
      {!currentRecord.mainBlocker && currentRecord.nextUnlockCondition && (
        <div className="text-[9px] font-mono text-[#67E8F9]/70 leading-snug">
          ○ {currentRecord.nextUnlockCondition}
        </div>
      )}

      {/* ── Row 5: Last important change ── */}
      {candidate.lastImportantChange && (
        <div
          className="text-[8px] font-mono px-2 py-1 rounded"
          style={{
            background: "rgba(255,255,255,0.03)",
            color: bucketColor,
            borderLeft: `2px solid ${bucketColor}60`,
          }}
        >
          {candidate.lastImportantChange}
          {candidate.lastEventAt && (
            <span className="text-muted-foreground/30 ml-2">
              {new Date(candidate.lastEventAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })}
            </span>
          )}
        </div>
      )}

      {/* ── Row 6: Event log ── */}
      {visibleEvents.length > 0 && (
        <div className="space-y-0.5">
          <div className="text-[8px] font-mono text-muted-foreground/30 uppercase tracking-widest mb-1">
            Events
          </div>
          {visibleEvents.map((ev) => (
            <div
              key={ev.eventId}
              className="flex items-start gap-2 text-[8px] font-mono py-0.5"
            >
              <span style={{ color: severityColor(ev.severity) }}>
                {severitySymbol(ev.severity)}
              </span>
              <span
                className="flex-1 leading-snug"
                style={{ color: `${severityColor(ev.severity)}cc` }}
              >
                {ev.description}
              </span>
              <span className="text-muted-foreground/25 flex-shrink-0">
                {new Date(ev.timestamp).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
            </div>
          ))}
          {candidate.events.length > SURVEILLANCE_VISIBLE_EVENT_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllEvents((v) => !v)}
              className="text-[8px] font-mono text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors mt-0.5"
            >
              {showAllEvents
                ? "Show fewer"
                : `+ ${candidate.events.length - SURVEILLANCE_VISIBLE_EVENT_COUNT} more events`}
            </button>
          )}
        </div>
      )}

      {/* ── Row 7: Why ranked chips ── */}
      {currentRecord.whyRanked.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {currentRecord.whyRanked.map((chip) => (
            <span
              key={chip}
              className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-[#0d1218] border border-border/30 text-muted-foreground/60"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
