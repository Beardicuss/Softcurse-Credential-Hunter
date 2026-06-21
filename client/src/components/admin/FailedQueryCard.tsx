import { AlertCircle } from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

type RouterOutput = inferRouterOutputs<AppRouter>;
type HunterFailedQuery =
  RouterOutput["hunter"]["getHunterSnapshot"]["failedQueries"][number];

export function FailedQueryCard({ query }: { query: HunterFailedQuery }) {
  return (
    <div className="glass-panel p-4 border-[var(--c-border)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm uppercase tracking-[0.28em] text-[var(--c-cyan)] data-text">
            {query.source || "unknown-source"}
          </div>
          <div className="text-xs text-[var(--c-cyan-dim)] mt-1">
            {query.query || "No query recorded"}
          </div>
        </div>
        <AlertCircle className="h-4 w-4 text-[var(--c-magenta)] flex-shrink-0 mt-1" />
      </div>
      <div className="text-xs leading-6 text-[var(--c-text)] break-words">
        {query.error || "Unknown source failure"}
      </div>
    </div>
  );
}
