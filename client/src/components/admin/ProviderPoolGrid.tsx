import { Clock, Loader2, RefreshCw } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { Button } from "@/components/ui/button";

type RouterOutput = inferRouterOutputs<AppRouter>;
type ProviderStat = RouterOutput["hunter"]["getProviderStats"][number];

const fmtDate = (date: Date | string | null | undefined): string =>
  date ? new Date(date).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "—";

export function ProviderPoolGrid({
  stats,
  isLoading,
  selectedProvider,
  pendingDiagnostic,
  onSelect,
  onValidate,
}: {
  stats: ProviderStat[] | undefined;
  isLoading: boolean;
  selectedProvider: string | null;
  pendingDiagnostic: string | null;
  onSelect: (provider: string) => void;
  onValidate: (provider: string) => void;
}) {
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="data-text data-cyan tracking-widest uppercase">
          <span className="decorator" />Provider Pool Control
        </h2>
        <span className="text-xs uppercase tracking-[0.28em] text-[var(--c-cyan-dim)]">
          Live provider health and key diagnostics
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-12 glass-panel">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--c-cyan)]" />
          </div>
        ) : stats?.length ? (
          stats.map(stat => (
            <ProviderCard
              key={stat.provider}
              stat={stat}
              selected={selectedProvider === stat.provider}
              validating={pendingDiagnostic === stat.provider}
              onSelect={() => onSelect(stat.provider)}
              onValidate={() => onValidate(stat.provider)}
            />
          ))
        ) : (
          <div className="col-span-full glass-panel p-8 border border-dashed border-[var(--c-border)] text-center text-[var(--c-cyan-dim)]">
            No providers are registered in the key pool yet.
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderCard({
  stat,
  selected,
  validating,
  onSelect,
  onValidate,
}: {
  stat: ProviderStat;
  selected: boolean;
  validating: boolean;
  onSelect: () => void;
  onValidate: () => void;
}) {
  const healthy = stat.validKeyCount > 0;
  const healthRatio = stat.totalKeyCount > 0 ? stat.validKeyCount / stat.totalKeyCount : 0;
  const barColor = healthRatio >= 0.5 ? "bg-green-500" : healthRatio >= 0.2 ? "bg-yellow-500" : "bg-[var(--c-magenta)]";

  return (
    <div
      className={`glass-panel p-6 cursor-pointer group transition-all duration-300 ${selected ? "shadow-[0_0_15px_rgba(0,255,255,0.3)] border-[var(--c-cyan)]" : ""} ${healthy ? "border-green-500/40" : ""}`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="hero-text text-xl">{stat.provider}</h3>
        {healthy && <span className="data-text text-xs border border-green-500/60 text-green-400 px-2 py-1">VALID</span>}
      </div>
      <div className="grid grid-cols-2 gap-4 mb-2 data-text">
        <Metric label="Valid Keys" value={stat.validKeyCount} tone="data-cyan" />
        <Metric label="Total Keys" value={stat.totalKeyCount} tone="data-cyan" />
        <div className="col-span-2 mb-2">
          <div className="w-full h-1 bg-[var(--c-border)] rounded-full overflow-hidden">
            <div className={`h-1 transition-all duration-500 ${barColor}`} style={{ width: `${healthRatio * 100}%` }} />
          </div>
        </div>
        <Metric label="Requests" value={stat.totalRequests} tone="text-[var(--c-text)]" compact />
        <Metric label="Failed" value={stat.failedRequests} tone="data-magenta" compact />
      </div>
      <div className="pt-4 border-t border-[var(--c-border)] flex flex-col gap-4">
        <p className="text-[11px] text-[var(--c-cyan-dim)] flex items-center gap-2 uppercase tracking-widest data-text">
          <Clock className="h-3 w-3" />LST_SYNC: {fmtDate(stat.lastRefreshAt)}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="border-[var(--c-border)] text-[var(--c-cyan)] hover:bg-[var(--c-cyan)] hover:text-black font-mono tracking-widest text-xs h-8 cursor-pointer transition-colors duration-300"
          onClick={event => { event.stopPropagation(); onValidate(); }}
          disabled={validating}
        >
          {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          RUN DIAGNOSTIC
        </Button>
      </div>
    </div>
  );
}

function Metric({ label, value, tone, compact = false }: { label: string; value: number; tone: string; compact?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-widest">{label}</p>
      <p className={`${compact ? "text-lg font-semibold" : "text-2xl font-bold"} ${tone}`}>{value}</p>
    </div>
  );
}
