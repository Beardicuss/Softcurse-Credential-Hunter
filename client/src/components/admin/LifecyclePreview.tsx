import { ArchiveX, CalendarClock, ShieldCheck } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type RouterOutput = inferRouterOutputs<AppRouter>;
type Lifecycle = RouterOutput["hunter"]["getHunterOperations"]["lifecycle"];

export function LifecyclePreview({ lifecycle }: { lifecycle: Lifecycle }) {
  const applyMode = lifecycle.mode === "apply";
  return (
    <section className="glass-panel p-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
        <div>
          <div className="data-text text-[var(--c-cyan)] uppercase tracking-widest flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />Candidate Lifecycle
          </div>
          <p className="text-sm text-[var(--c-cyan-dim)] mt-2">
            Revalidation and retention preview from the current persisted key pool.
          </p>
        </div>
        <span className={`data-text text-xs border px-3 py-2 ${applyMode ? "border-[var(--c-magenta)] text-[var(--c-magenta)]" : "border-yellow-500 text-yellow-400"}`}>
          {applyMode ? "APPLY ENABLED" : "DRY RUN"}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <LifecycleMetric label="Inspected" value={lifecycle.totals.inspected} />
        <LifecycleMetric label="Retained" value={lifecycle.totals.retained} />
        <LifecycleMetric label="Revalidate" value={lifecycle.totals.revalidate} tone="text-yellow-400" />
        <LifecycleMetric label="Delete candidates" value={lifecycle.totals.deleteCandidates} tone="text-[var(--c-magenta)]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PolicyCard lifecycle={lifecycle} />
        <div className="border border-[var(--c-border)] p-4">
          <div className="data-text text-xs uppercase tracking-widest text-[var(--c-magenta)] flex items-center gap-2 mb-3">
            <ArchiveX className="h-4 w-4" />Deletion Candidates
          </div>
          {lifecycle.deleteCandidates.length ? (
            <div className="space-y-2 max-h-40 overflow-auto">
              {lifecycle.deleteCandidates.slice(0, 12).map(record => (
                <div key={record.id} className="flex justify-between gap-3 text-xs border-b border-[var(--c-border)] pb-2">
                  <span>{record.provider} · {record.keyMasked}</span>
                  <span className="text-[var(--c-cyan-dim)]">{record.validity}</span>
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-[var(--c-cyan-dim)]">No records currently qualify for deletion.</div>}
        </div>
      </div>
    </section>
  );
}

function PolicyCard({ lifecycle }: { lifecycle: Lifecycle }) {
  return (
    <div className="border border-[var(--c-border)] p-4">
      <div className="data-text text-xs uppercase tracking-widest text-green-400 flex items-center gap-2 mb-3"><ShieldCheck className="h-4 w-4" />Active Policy</div>
      <div className="space-y-2 text-sm">
        <Policy label="Revalidate after" value={`${lifecycle.policy.revalidateAfterDays} days`} />
        <Policy label="Invalid retention" value={`${lifecycle.policy.invalidRetentionDays} days`} />
        <Policy label="Unknown retention" value={`${lifecycle.policy.unknownRetentionDays} days`} />
        <Policy label="Valid key deletion" value="Never automatic" />
      </div>
    </div>
  );
}

function Policy({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><span className="text-[var(--c-cyan-dim)]">{label}</span><span className="data-text text-[var(--c-cyan)]">{value}</span></div>;
}

function LifecycleMetric({ label, value, tone = "text-[var(--c-cyan)]" }: { label: string; value: number; tone?: string }) {
  return <div className="border border-[var(--c-border)] p-4"><div className="data-text text-[10px] uppercase tracking-widest text-[var(--c-cyan-dim)]">{label}</div><div className={`hero-text text-3xl mt-1 ${tone}`}>{value}</div></div>;
}
