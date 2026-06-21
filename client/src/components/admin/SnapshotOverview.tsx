import { useMemo } from "react";
import {
  Activity,
  Clock,
  Database,
  Layers3,
  Loader2,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";
import { FailedQueryCard } from "@/components/admin/FailedQueryCard";

type RouterOutput = inferRouterOutputs<AppRouter>;
type HunterSnapshot = RouterOutput["hunter"]["getHunterSnapshot"];

const fmtDate = (date: Date | string | null | undefined): string =>
  date ? new Date(date).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "—";

const formatPct = (value: number): string => `${Math.round((value || 0) * 100)}%`;

const bucketTone = (value: number): string => {
  if (value >= 0.66) return "text-green-400";
  if (value >= 0.33) return "text-yellow-400";
  return "text-[var(--c-magenta)]";
};

export function SnapshotOverview({
  snapshot,
  isLoading,
}: {
  snapshot: HunterSnapshot | undefined;
  isLoading: boolean;
}) {
  const health = useMemo(() => {
    const totals = snapshot?.totals ?? {
      candidates: 0,
      confirmedKeys: 0,
      confirmedCommits: 0,
      providers: 0,
    };
    const validation = snapshot?.validation ?? {
      valid: 0,
      invalid: 0,
      unknown: 0,
      byTier: { high: 0, medium: 0, low: 0, unknown: 0 },
    };
    const freshness = snapshot?.freshness ?? {
      fresh: 0,
      warm: 0,
      stale: 0,
      revalidationSuggested: 0,
    };
    const validated = validation.valid + validation.invalid + validation.unknown;
    return {
      totals,
      validation,
      freshness,
      validRatio: validated > 0 ? validation.valid / validated : 0,
      staleRatio: totals.confirmedKeys > 0 ? freshness.stale / totals.confirmedKeys : 0,
    };
  }, [snapshot]);

  const failedQueries = snapshot?.failedQueries ?? [];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.95fr] gap-6">
      <div className="glass-panel p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="data-text text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-[0.35em] mb-2">Snapshot Core</p>
            <h2 className="hero-text text-5xl leading-none">Softcurse Hunter Surface</h2>
            <p className="text-[var(--c-cyan-dim)] mt-3 max-w-2xl text-sm">
              Frozen contract telemetry for source yield, freshness pressure,
              validation confidence, and provider viability.
            </p>
          </div>
          <div className="text-right min-w-[180px]">
            <div className="text-[11px] uppercase tracking-[0.35em] text-[var(--c-cyan-dim)] data-text mb-2">Contract</div>
            <div className="inline-flex px-3 py-2 border border-[var(--c-cyan)] text-[var(--c-cyan)] font-mono text-sm">
              {snapshot?.contractVersion ?? "hunter.v1"}
            </div>
            <div className="text-[11px] uppercase tracking-[0.28em] text-[var(--c-cyan-dim)] mt-3">Generated</div>
            <div className="data-text text-sm mt-1">{fmtDate(snapshot?.generatedAt)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric icon={Search} label="Candidates" value={health.totals.candidates} />
          <Metric icon={Shield} label="Confirmed Keys" value={health.totals.confirmedKeys} />
          <Metric icon={Database} label="Commits" value={health.totals.confirmedCommits} />
          <Metric icon={Layers3} label="Providers" value={health.totals.providers} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel p-5 border-[var(--c-border)]">
            <PanelTitle icon={Activity}>Validation Health</PanelTitle>
            <div className={`hero-text text-4xl ${bucketTone(health.validRatio)}`}>{formatPct(health.validRatio)}</div>
            <div className="mt-3 w-full h-1 bg-[var(--c-border)] overflow-hidden">
              <div className="h-1 bg-[var(--c-cyan)]" style={{ width: `${health.validRatio * 100}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-xs data-text">
              <Stat label="Valid" value={health.validation.valid} tone="text-green-400" />
              <Stat label="Invalid" value={health.validation.invalid} tone="text-[var(--c-magenta)]" />
              <Stat label="Unknown" value={health.validation.unknown} tone="text-yellow-400" />
            </div>
          </div>

          <div className="glass-panel p-5 border-[var(--c-border)]">
            <PanelTitle icon={Clock}>Freshness Pressure</PanelTitle>
            <div className={`hero-text text-4xl ${bucketTone(1 - health.staleRatio)}`}>{health.freshness.revalidationSuggested}</div>
            <div className="text-xs text-[var(--c-cyan-dim)] uppercase tracking-widest mt-2">Need revalidation</div>
            <div className="grid grid-cols-3 gap-2 mt-4 text-xs data-text">
              <Stat label="Fresh" value={health.freshness.fresh} tone="text-[var(--c-cyan)]" />
              <Stat label="Warm" value={health.freshness.warm} tone="text-yellow-400" />
              <Stat label="Stale" value={health.freshness.stale} tone="text-[var(--c-magenta)]" />
            </div>
          </div>

          <div className="glass-panel p-5 border-[var(--c-border)]">
            <PanelTitle icon={Sparkles}>Validation Tiers</PanelTitle>
            <div className="space-y-3 text-sm data-text">
              <Tier label="High" value={health.validation.byTier.high} tone="text-[var(--c-cyan)]" />
              <Tier label="Medium" value={health.validation.byTier.medium} tone="text-yellow-400" />
              <Tier label="Low" value={health.validation.byTier.low} tone="text-[var(--c-magenta)]" />
              <Tier label="Unknown" value={health.validation.byTier.unknown} tone="text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="data-text data-cyan tracking-widest uppercase"><span className="decorator" />Pipeline Alerts</h3>
          <span className={`text-xs uppercase tracking-[0.3em] ${failedQueries.length ? "text-[var(--c-magenta)]" : "text-[var(--c-cyan)]"}`}>
            {failedQueries.length ? `${failedQueries.length} active` : "clear"}
          </span>
        </div>
        <div className="space-y-3 max-h-[420px] overflow-auto pr-2">
          {isLoading ? (
            <div className="glass-panel p-6 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--c-cyan)]" /></div>
          ) : failedQueries.length ? (
            failedQueries.map((query, index) => (
              <FailedQueryCard key={`${query.source || "src"}-${query.query || "query"}-${index}`} query={query} />
            ))
          ) : (
            <div className="glass-panel p-6 border border-dashed border-[var(--c-border)] text-sm text-[var(--c-cyan-dim)]">
              No failed source queries in the current frozen snapshot.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Icon = typeof Activity;

function Metric({ icon: Icon, label, value }: { icon: Icon; label: string; value: number }) {
  return (
    <div className="glass-panel p-4 border-[var(--c-border)]">
      <div className="flex items-center gap-2 text-[var(--c-cyan-dim)] text-xs uppercase tracking-[0.25em] mb-2"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="hero-text text-3xl">{value}</div>
    </div>
  );
}

function PanelTitle({ icon: Icon, children }: { icon: Icon; children: string }) {
  return <div className="flex items-center gap-2 text-[var(--c-cyan-dim)] text-xs uppercase tracking-[0.25em] mb-3"><Icon className="h-3.5 w-3.5" />{children}</div>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div><div className="text-[var(--c-cyan-dim)] uppercase tracking-widest">{label}</div><div className={`${tone} text-lg`}>{value}</div></div>;
}

function Tier({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="flex items-center justify-between"><span className="uppercase tracking-widest text-[var(--c-cyan-dim)]">{label}</span><span className={tone}>{value}</span></div>;
}
