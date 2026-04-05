// D16 Hybrid v0.6 — Market Adapter Diagnostics
// Per-market runtime health panel: connected, heartbeat, last update, stale, bootstrap, reconnects.

import type {
  LiveMarketId,
  MarketAdapterState,
  RuntimeState,
} from "../liveAdapterTypes";

type Props = {
  runtimeState: RuntimeState;
};

const MARKET_LABELS: Record<LiveMarketId, string> = {
  BINANCE_SPOT: "Binance Spot",
  BINANCE_FUTURES: "Binance Futures",
  COINBASE_SPOT: "Coinbase Spot",
};

const STATUS_COLOR: Record<string, string> = {
  INITIALIZING: "text-[#9AA3AD]",
  BOOTSTRAPPING: "text-[#67E8F9]",
  CONNECTED: "text-[#22C55E]",
  STALE: "text-[#F97316]",
  DISCONNECTED: "text-[#EF4444]",
  RECONNECTING: "text-[#FACC15]",
  ERROR: "text-[#EF4444]",
};

const STATUS_DOT: Record<string, string> = {
  INITIALIZING: "bg-[#9AA3AD]",
  BOOTSTRAPPING: "bg-[#67E8F9]",
  CONNECTED: "bg-[#22C55E]",
  STALE: "bg-[#F97316]",
  DISCONNECTED: "bg-[#EF4444]",
  RECONNECTING: "bg-[#FACC15]",
  ERROR: "bg-[#EF4444]",
};

function timeSince(ts: number | null): string {
  if (!ts) return "never";
  const diff = Date.now() - ts;
  if (diff < 1000) return "<1s";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  return `${Math.floor(diff / 60_000)}m ago`;
}

function ProgressBar({ value }: { value: number }) {
  const color = value >= 100 ? "#22C55E" : value >= 50 ? "#67E8F9" : "#FACC15";
  return (
    <div className="h-1 w-full bg-muted/30 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value}%`, backgroundColor: color }}
      />
    </div>
  );
}

function AdapterCard({ adapter }: { adapter: MarketAdapterState }) {
  const statusClass = STATUS_COLOR[adapter.status] ?? "text-muted-foreground";
  const dotClass = STATUS_DOT[adapter.status] ?? "bg-muted";

  return (
    <div className="bg-card border border-border rounded p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-mono font-semibold text-foreground">
          {MARKET_LABELS[adapter.marketId]}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          <span
            className={`text-[10px] font-mono font-semibold ${statusClass}`}
          >
            {adapter.status}
          </span>
        </div>
      </div>

      {/* Bootstrap progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
            Bootstrap
          </span>
          <span
            className={`text-[10px] font-mono ${
              adapter.bootstrapComplete ? "text-[#22C55E]" : "text-[#FACC15]"
            }`}
          >
            {adapter.bootstrapComplete
              ? "COMPLETE"
              : `${adapter.bootstrapProgress}%`}
          </span>
        </div>
        <ProgressBar value={adapter.bootstrapProgress} />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="Heartbeat"
          value={adapter.isHeartbeatHealthy ? "OK" : "NONE"}
          valueClass={
            adapter.isHeartbeatHealthy ? "text-[#22C55E]" : "text-[#EF4444]"
          }
          sub={timeSince(adapter.lastHeartbeatAt)}
        />
        <Metric
          label="Last Update"
          value={timeSince(adapter.lastUpdateAt)}
          valueClass={
            adapter.isStale ? "text-[#F97316]" : "text-muted-foreground"
          }
          sub={adapter.isStale ? "STALE" : "fresh"}
        />
        <Metric
          label="Stale"
          value={adapter.isStale ? "YES" : "NO"}
          valueClass={adapter.isStale ? "text-[#F97316]" : "text-[#22C55E]"}
          sub={`>${Math.round(adapter.stalenessThresholdMs / 1000)}s threshold`}
        />
        <Metric
          label="Reconnects"
          value={String(adapter.reconnectCount)}
          valueClass={
            adapter.reconnectCount > 0
              ? "text-[#FACC15]"
              : "text-muted-foreground"
          }
          sub={
            adapter.totalTicksReceived > 0
              ? `${adapter.totalTicksReceived} ticks`
              : "no ticks"
          }
        />
      </div>

      {/* Runtime trust */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
            Runtime Trust Contribution
          </span>
          <span
            className="text-[11px] font-mono font-bold"
            style={{
              color:
                adapter.runtimeTrustContribution >= 80
                  ? "#22C55E"
                  : adapter.runtimeTrustContribution >= 50
                    ? "#FACC15"
                    : "#EF4444",
            }}
          >
            {adapter.runtimeTrustContribution}
          </span>
        </div>
        <ProgressBar value={adapter.runtimeTrustContribution} />
      </div>

      {/* Last error */}
      {adapter.lastError && (
        <div className="px-2 py-1 rounded bg-[#1a0505] border border-[#401010]">
          <span className="text-[10px] font-mono text-[#EF4444]">
            {adapter.lastError}
          </span>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  valueClass,
  sub,
}: {
  label: string;
  value: string;
  valueClass: string;
  sub: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-[11px] font-mono font-semibold ${valueClass}`}>
        {value}
      </div>
      <div className="text-[9px] font-mono text-muted-foreground/40">{sub}</div>
    </div>
  );
}

export function MarketAdapterDiagnostics({ runtimeState }: Props) {
  const markets: LiveMarketId[] = [
    "BINANCE_SPOT",
    "BINANCE_FUTURES",
    "COINBASE_SPOT",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-mono font-semibold text-muted-foreground uppercase tracking-wider">
          Market Adapter Diagnostics
        </h3>
        <span className="text-[9px] font-mono text-muted-foreground/40">
          {runtimeState.connectedMarketCount}/3 connected
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {markets.map((id) => (
          <AdapterCard key={id} adapter={runtimeState.adapters[id]} />
        ))}
      </div>
    </div>
  );
}
