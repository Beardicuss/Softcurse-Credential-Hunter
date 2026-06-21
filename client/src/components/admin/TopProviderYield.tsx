import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type RouterOutput = inferRouterOutputs<AppRouter>;
type HunterProvider =
  RouterOutput["hunter"]["getHunterSnapshot"]["providers"][number];

export function TopProviderYield({
  providers,
}: {
  providers: HunterProvider[];
}) {
  const ranked = [...providers]
    .sort(
      (a, b) =>
        b.valid - a.valid ||
        b.total - a.total ||
        a.provider.localeCompare(b.provider)
    )
    .slice(0, 6);

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="data-text data-cyan tracking-widest uppercase">
          <span className="decorator" />
          Top Provider Yield
        </h2>
        <span className="text-xs uppercase tracking-[0.28em] text-[var(--c-cyan-dim)]">
          Valid-key ranked providers
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ranked.length ? (
          ranked.map(provider => (
            <SnapshotProviderCard key={provider.provider} provider={provider} />
          ))
        ) : (
          <div className="col-span-full glass-panel p-8 border border-dashed border-[var(--c-border)] text-center text-[var(--c-cyan-dim)]">
            Hunter snapshot has no provider records yet.
          </div>
        )}
      </div>
    </div>
  );
}

function SnapshotProviderCard({ provider }: { provider: HunterProvider }) {
  const validRatio = provider.total > 0 ? provider.valid / provider.total : 0;
  const barClass =
    validRatio >= 0.5
      ? "bg-green-500"
      : validRatio >= 0.2
        ? "bg-yellow-500"
        : "bg-[var(--c-magenta)]";

  return (
    <div className="glass-panel p-5 border-[var(--c-border)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="hero-text text-2xl">{provider.provider}</h3>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--c-cyan-dim)] mt-1">
            Persisted provider family
          </p>
        </div>
        <div
          className={`text-xs uppercase tracking-[0.28em] ${provider.valid > 0 ? "text-[var(--c-cyan)]" : "text-[var(--c-cyan-dim)]"}`}
        >
          {provider.valid > 0 ? "viable" : "cold"}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 data-text mb-4">
        <Stat label="Valid" value={provider.valid} tone="text-green-400" />
        <Stat
          label="Total"
          value={provider.total}
          tone="text-[var(--c-cyan)]"
        />
      </div>
      <div className="w-full h-1 bg-[var(--c-border)] overflow-hidden mb-4">
        <div
          className={`${barClass} h-1`}
          style={{ width: `${validRatio * 100}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs data-text">
        <Stat
          label="Fresh"
          value={provider.freshness.fresh}
          tone="text-[var(--c-cyan)]"
        />
        <Stat
          label="Stale"
          value={provider.freshness.stale}
          tone="text-[var(--c-magenta)]"
        />
        <Stat
          label="Avg confidence"
          value={provider.avgConfidence.toFixed(2)}
          tone="text-[var(--c-cyan)]"
        />
        <Stat
          label="Recheck"
          value={provider.revalidationSuggested}
          tone="text-yellow-400"
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-[var(--c-cyan-dim)]">
        {label}
      </div>
      <div className={`text-lg ${tone}`}>{value}</div>
    </div>
  );
}
