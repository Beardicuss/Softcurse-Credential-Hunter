import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { LifecyclePreview } from "@/components/admin/LifecyclePreview";
import {
  AlertTriangle,
  Clock3,
  DatabaseZap,
  Loader2,
  Radar,
  RefreshCw,
  ShieldQuestion,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type QueueName = "validationQueue" | "staleKeys" | "unknownProviders";

const QUEUES: Array<{ id: QueueName; label: string; icon: typeof Radar }> = [
  { id: "validationQueue", label: "Validation Queue", icon: DatabaseZap },
  { id: "staleKeys", label: "Stale Keys", icon: Clock3 },
  { id: "unknownProviders", label: "Unknown Providers", icon: ShieldQuestion },
];

export default function HunterOperations() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [queue, setQueue] = useState<QueueName>("validationQueue");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const status = trpc.hunter.getStatus.useQuery();
  const operations = trpc.hunter.getHunterOperations.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchOnWindowFocus: false,
  });
  const [pendingLifecycleAction, setPendingLifecycleAction] = useState<
    "schedule_revalidation" | "cleanup" | null
  >(null);
  const lifecycleAction = trpc.hunter.applyLifecycleAction.useMutation({
    onSuccess: async result => {
      toast.success(
        result.action === "cleanup"
          ? `Cleanup completed: ${result.totals.deleteCandidates} candidate(s)`
          : `Revalidation scheduled: ${result.totals.revalidate} key(s)`
      );
      await operations.refetch();
    },
    onError: error => toast.error(`Lifecycle action failed: ${error.message}`),
    onSettled: () => setPendingLifecycleAction(null),
  });
  const dispatchWorkflow = trpc.hunter.dispatchWorkflow.useMutation({
    onSuccess: () => toast.success("Manual hunt accepted by GitHub Actions"),
    onError: error => toast.error("Manual hunt failed: " + error.message),
  });
  const validate = trpc.hunter.validateKey.useMutation({
    onSuccess: async () => {
      toast.success("Key validation completed");
      await operations.refetch();
    },
    onError: error => toast.error(`Validation failed: ${error.message}`),
    onSettled: () => setPendingId(null),
  });

  if (authLoading) return <Loading />;
  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="glass-panel p-10 text-center max-w-md">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-[var(--c-magenta)]" />
          <h1 className="hero-text text-3xl">OPERATIONS LOCKED</h1>
          <Link href="/admin/keys">
            <a className="inline-flex mt-6 border border-[var(--c-cyan)] px-5 py-3 text-[var(--c-cyan)] data-text">
              OPEN CONTROL PLANE
            </a>
          </Link>
        </div>
      </div>
    );
  }

  const data = operations.data;
  const records = data?.[queue] ?? [];

  return (
    <div className="min-h-screen p-5 md:p-8 relative">
      <div className="glow-bloom" />
      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        <header className="glass-panel p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="data-text text-[var(--c-cyan)] uppercase tracking-[0.35em] text-xs flex items-center gap-2">
              <Radar className="h-5 w-5" /> Live Review Surface
            </div>
            <h1 className="hero-text text-4xl md:text-5xl mt-2">
              HUNTER OPERATIONS
            </h1>
            <p className="text-[var(--c-cyan-dim)] mt-2">
              Source health, stale records, validation pressure, and
              unknown-provider triage.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              className="bg-[var(--c-cyan)] text-black hover:bg-[var(--c-cyan)]/80"
              disabled={dispatchWorkflow.isPending || status.data?.manualDispatchConfigured === false}
              onClick={() => {
                if (!window.confirm("Start the Credential Hunter workflow now?")) return;
                dispatchWorkflow.mutate();
              }}
            >
              {dispatchWorkflow.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Radar className="h-4 w-4 mr-2" />
              )}
              {status.data?.manualDispatchConfigured === false ? "CONFIGURE DISPATCH" : "RUN HUNT NOW"}
            </Button>
            <Button
              variant="outline"
              className="border-[var(--c-cyan)] text-[var(--c-cyan)]"
              onClick={() => operations.refetch()}
              disabled={operations.isFetching}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${operations.isFetching ? "animate-spin" : ""}`}
              />{" "}
              REFRESH
            </Button>
            <NavLink href="/admin/keys" label="CONTROL PLANE" />
            <NavLink href="/admin/vault" label="VALID KEY VAULT" />
            <NavLink href="/admin/audit" label="AUDIT LOGS" />
          </div>
        </header>

        {operations.isLoading ? (
          <Loading compact />
        ) : (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Metric
                label="Sources"
                value={data?.totals.sources ?? 0}
                tone="text-[var(--c-cyan)]"
              />
              <Metric
                label="Validation Queue"
                value={data?.totals.validationQueue ?? 0}
                tone="text-yellow-400"
              />
              <Metric
                label="Stale"
                value={data?.totals.stale ?? 0}
                tone="text-[var(--c-magenta)]"
              />
              <Metric
                label="Unknown Providers"
                value={data?.totals.unknownProviders ?? 0}
                tone="text-orange-400"
              />
            </section>

            {data?.lifecycle && (
              <LifecyclePreview
                lifecycle={data.lifecycle}
                pendingAction={pendingLifecycleAction}
                onScheduleRevalidation={() => {
                  const confirmation = window.prompt(
                    'Type SCHEDULE REVALIDATION to continue.'
                  );
                  if (confirmation !== 'SCHEDULE REVALIDATION') return;
                  setPendingLifecycleAction('schedule_revalidation');
                  lifecycleAction.mutate({
                    action: 'schedule_revalidation',
                    confirmation,
                  });
                }}
                onCleanup={() => {
                  const confirmation = window.prompt(
                    'Type DELETE STALE CANDIDATES to permanently remove the current deletion candidates.'
                  );
                  if (confirmation !== 'DELETE STALE CANDIDATES') return;
                  setPendingLifecycleAction('cleanup');
                  lifecycleAction.mutate({ action: 'cleanup', confirmation });
                }}
              />
            )}

            <section className="glass-panel p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="data-text text-[var(--c-cyan)] uppercase tracking-widest">
                  Source Health
                </h2>
                <span className="data-text text-xs text-[var(--c-cyan-dim)]">
                  PERSISTED DISCOVERY RECORDS
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(data?.sources ?? []).map(source => (
                  <div
                    key={source.source}
                    className="border border-[var(--c-border)] p-5 bg-[rgba(79,255,240,0.025)]"
                  >
                    <div className="flex justify-between gap-3">
                      <h3 className="hero-text text-xl">{source.source}</h3>
                      <span className="data-text text-[var(--c-cyan)]">
                        {source.total}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-4 text-center data-text text-xs">
                      <SourceMetric
                        label="Valid"
                        value={source.valid}
                        tone="text-green-400"
                      />
                      <SourceMetric
                        label="Invalid"
                        value={source.invalid}
                        tone="text-[var(--c-magenta)]"
                      />
                      <SourceMetric
                        label="Stale"
                        value={source.stale}
                        tone="text-orange-400"
                      />
                      <SourceMetric
                        label="Recheck"
                        value={source.revalidationSuggested}
                        tone="text-yellow-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-panel overflow-hidden">
              <div className="flex flex-wrap border-b border-[var(--c-border)]">
                {QUEUES.map(item => {
                  const Icon = item.icon;
                  const count =
                    data?.totals[item.id === "staleKeys" ? "stale" : item.id] ??
                    0;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setQueue(item.id)}
                      className={`px-5 py-4 data-text text-xs uppercase tracking-widest flex items-center gap-2 border-r border-[var(--c-border)] ${queue === item.id ? "bg-[var(--c-cyan)] text-black" : "text-[var(--c-cyan-dim)] hover:text-[var(--c-cyan)]"}`}
                    >
                      <Icon className="h-4 w-4" /> {item.label}{" "}
                      <span>({count})</span>
                    </button>
                  );
                })}
              </div>
              <div className="divide-y divide-[var(--c-border)]">
                {records.length ? (
                  records.map(record => (
                    <div
                      key={`${queue}-${record.id}`}
                      className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-center"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="hero-text text-lg">
                            {record.provider}
                          </span>
                          <span className="data-text text-xs text-[var(--c-cyan)]">
                            {record.keyMasked}
                          </span>
                        </div>
                        <div className="data-text text-[10px] text-[var(--c-cyan-dim)] uppercase tracking-widest mt-2">
                          {record.source} · {record.validationTier} tier ·{" "}
                          {record.freshness} · {record.validationStatus}
                        </div>
                        {record.validationReason && (
                          <p className="text-xs text-orange-300 mt-2">
                            {record.validationReason}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        className="border-[var(--c-border)] text-[var(--c-cyan)]"
                        disabled={pendingId === record.id}
                        onClick={() => {
                          setPendingId(record.id);
                          validate.mutate({
                            provider: record.provider,
                            keyId: record.id,
                          });
                        }}
                      >
                        {pendingId === record.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}{" "}
                        VALIDATE
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="p-14 text-center data-text text-[var(--c-cyan-dim)]">
                    QUEUE CLEAR
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function Loading({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`${compact ? "glass-panel p-14" : "min-h-screen"} grid place-items-center`}
    >
      <Loader2 className="h-8 w-8 animate-spin text-[var(--c-cyan)]" />
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href}>
      <a className="h-10 inline-flex items-center border border-[var(--c-border)] px-4 text-[var(--c-text)] data-text text-xs">
        {label}
      </a>
    </Link>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="glass-panel p-5">
      <div className="data-text text-[10px] uppercase tracking-[0.25em] text-[var(--c-cyan-dim)]">
        {label}
      </div>
      <div className={`hero-text text-4xl mt-2 ${tone}`}>{value}</div>
    </div>
  );
}

function SourceMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div>
      <div className="text-[var(--c-cyan-dim)]">{label}</div>
      <div className={`text-lg ${tone}`}>{value}</div>
    </div>
  );
}
