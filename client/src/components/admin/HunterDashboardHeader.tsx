import { useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HunterDashboardHeader({
  isRefreshing,
  isCreatingProvider,
  onRefresh,
  onCreateProvider,
}: {
  isRefreshing: boolean;
  isCreatingProvider: boolean;
  onRefresh: () => void;
  onCreateProvider: (provider: string) => Promise<boolean>;
}) {
  const [providerPanelOpen, setProviderPanelOpen] = useState(false);
  const [providerName, setProviderName] = useState("");

  const createProvider = async () => {
    const created = await onCreateProvider(providerName.trim());
    if (!created) return;
    setProviderName("");
    setProviderPanelOpen(false);
  };

  return (
    <div className="glass-panel p-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
      <div>
        <h1 className="hero-text text-4xl mb-2"><span className="decorator" />HUNTER CONTROL PLANE</h1>
        <p className="data-text font-mono text-[var(--c-cyan-dim)] text-sm tracking-widest uppercase">
          FROZEN HUNTER.V1 SNAPSHOT + LIVE KEY POOL COMMAND SURFACE
        </p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" className="h-10 border-[var(--c-cyan)] text-[var(--c-cyan)] hover:bg-[var(--c-cyan)] hover:text-black" onClick={onRefresh} disabled={isRefreshing}>
          {isRefreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}REFRESH GRID
        </Button>
        <div className="relative">
          <Button
            variant="outline"
            className="h-10 border-green-500/60 text-green-400 hover:bg-[var(--c-orange)] hover:text-black"
            onClick={() => setProviderPanelOpen(open => !open)}
          >
            <Plus className="h-4 w-4 mr-2" />NEW PROVIDER
          </Button>
          {providerPanelOpen && (
            <div className="absolute right-0 top-12 z-50 w-80 glass-panel border border-[var(--c-orange)] bg-[var(--c-bg)] p-4 shadow-2xl">
              <div className="data-text text-[var(--c-orange)] tracking-widest uppercase mb-3">INITIALIZE NEW PROVIDER</div>
              <div className="grid gap-3">
                <Input placeholder="Provider ID (e.g. Anthropic)" className="glass-panel text-[var(--c-text)] data-text" value={providerName} onChange={event => setProviderName(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && providerName.trim()) void createProvider(); }} />
                <Button className="w-full bg-[var(--c-orange)] text-black hover:bg-[#ff8f59] font-mono tracking-widest" onClick={createProvider} disabled={isCreatingProvider || !providerName.trim()}>
                  {isCreatingProvider ? <Loader2 className="h-4 w-4 animate-spin" /> : "[ ESTABLISH LINK ]"}
                </Button>
                <Button variant="outline" className="h-8 border-[var(--c-border)] text-[var(--c-cyan-dim)]" onClick={() => { setProviderName(""); setProviderPanelOpen(false); }}>CANCEL</Button>
              </div>
            </div>
          )}
        </div>
        <NavLink href="/admin/operations" tone="text-orange-400 border-orange-500/60 hover:bg-orange-500">OPERATIONS</NavLink>
        <NavLink href="/admin/vault" tone="text-green-400 border-green-500/60 hover:bg-green-500">VALID KEY VAULT</NavLink>
        <NavLink href="/admin/audit" tone="text-[var(--c-cyan)] border-[var(--c-cyan)] hover:bg-[var(--c-cyan)]">AUDIT LOGS</NavLink>
      </div>
    </div>
  );
}

function NavLink({ href, tone, children }: { href: string; tone: string; children: string }) {
  return (
    <Link href={href}>
      <a className={`data-text border px-4 py-2 hover:text-black transition-colors duration-300 uppercase tracking-widest text-xs flex items-center h-10 ${tone}`}>{children}</a>
    </Link>
  );
}
