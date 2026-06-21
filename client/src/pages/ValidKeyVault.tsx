import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const formatDate = (value: Date | string | null) =>
  value
    ? new Date(value).toISOString().replace("T", " ").slice(0, 19) + " UTC"
    : "—";

export default function ValidKeyVault() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [revealed, setRevealed] = useState<Map<number, string>>(new Map());

  const vault = trpc.hunter.getValidKeyVault.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchOnWindowFocus: false,
  });
  const revealMutation = trpc.hunter.revealKey.useMutation({
    onSuccess: ({ id, keyValue }) =>
      setRevealed(previous => new Map(previous).set(id, keyValue)),
    onError: error => toast.error(`Reveal failed: ${error.message}`),
  });
  const copyMutation = trpc.hunter.auditKeyCopy.useMutation({
    onError: error => toast.error(`Copy denied: ${error.message}`),
  });

  const providers = useMemo(() => {
    const groups = vault.data?.providers ?? [];
    if (!deferredSearch) return groups;
    return groups
      .map(group => ({
        ...group,
        keys: group.keys.filter(key =>
          `${group.provider} ${key.keyMasked}`
            .toLowerCase()
            .includes(deferredSearch)
        ),
      }))
      .filter(group => group.keys.length > 0);
  }, [deferredSearch, vault.data?.providers]);

  const toggleReveal = (provider: string, keyId: number) => {
    if (revealed.has(keyId)) {
      setRevealed(previous => {
        const next = new Map(previous);
        next.delete(keyId);
        return next;
      });
      return;
    }
    revealMutation.mutate({ provider, keyId });
  };

  const copyKey = (provider: string, keyId: number) => {
    const value = revealed.get(keyId);
    if (!value) {
      toast.error("Reveal the key before copying");
      return;
    }
    copyMutation.mutate(
      { provider, keyId },
      {
        onSuccess: async () => {
          await navigator.clipboard.writeText(value);
          toast.success("Key copied to clipboard");
        },
      }
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--c-cyan)]" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="glass-panel p-10 text-center max-w-md">
          <KeyRound className="h-12 w-12 mx-auto mb-4 text-[var(--c-cyan)]" />
          <h1 className="hero-text text-3xl">VAULT LOCKED</h1>
          <p className="data-text text-[var(--c-cyan-dim)] my-5">
            ADMIN AUTHENTICATION REQUIRED
          </p>
          <Link href="/admin/keys">
            <a className="inline-flex border border-[var(--c-cyan)] px-5 py-3 text-[var(--c-cyan)] data-text">
              OPEN CONTROL PLANE
            </a>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-5 md:p-8 relative">
      <div className="glow-bloom" />
      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        <header className="glass-panel p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-3 text-[var(--c-cyan)] mb-2">
              <ShieldCheck className="h-6 w-6" />
              <span className="data-text uppercase tracking-[0.35em] text-xs">
                Protected Admin Surface
              </span>
            </div>
            <h1 className="hero-text text-4xl md:text-5xl">VALID KEY VAULT</h1>
            <p className="text-[var(--c-cyan-dim)] mt-2">
              Provider-grouped, masked by default, and audited on every reveal
              and copy.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setRevealed(new Map());
                vault.refetch();
              }}
              disabled={vault.isFetching}
              className="border-[var(--c-cyan)] text-[var(--c-cyan)]"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${vault.isFetching ? "animate-spin" : ""}`}
              />{" "}
              REFRESH
            </Button>
            <Link href="/admin/keys">
              <a className="h-10 inline-flex items-center border border-[var(--c-border)] px-4 text-[var(--c-text)] data-text text-xs">
                CONTROL PLANE
              </a>
            </Link>
            <Link href="/admin/audit">
              <a className="h-10 inline-flex items-center border border-[var(--c-border)] px-4 text-[var(--c-text)] data-text text-xs">
                AUDIT LOGS
              </a>
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-4 items-center glass-panel p-5">
          <label className="relative block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--c-cyan-dim)]" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search provider or masked key"
              className="pl-11 glass-panel data-text"
            />
          </label>
          <div className="border border-[var(--c-border)] px-5 py-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--c-cyan-dim)]">
              Valid Keys
            </div>
            <div className="hero-text text-2xl text-green-400">
              {vault.data?.total ?? 0}
            </div>
          </div>
          <div className="border border-[var(--c-border)] px-5 py-3">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[var(--c-cyan-dim)]">
              Providers
            </div>
            <div className="hero-text text-2xl text-[var(--c-cyan)]">
              {vault.data?.providers.length ?? 0}
            </div>
          </div>
        </section>

        {vault.isLoading ? (
          <div className="glass-panel p-16 grid place-items-center">
            <Loader2 className="h-9 w-9 animate-spin text-[var(--c-cyan)]" />
          </div>
        ) : providers.length === 0 ? (
          <div className="glass-panel p-16 text-center data-text text-[var(--c-cyan-dim)]">
            NO VALID KEYS MATCH THIS VIEW
          </div>
        ) : (
          <div className="space-y-5">
            {providers.map(group => (
              <section
                key={group.provider}
                className="glass-panel overflow-hidden"
              >
                <div className="px-5 py-4 border-b border-[var(--c-border)] flex items-center justify-between bg-[rgba(79,255,240,0.035)]">
                  <h2 className="hero-text text-xl text-[var(--c-cyan)]">
                    {group.provider}
                  </h2>
                  <span className="data-text text-xs border border-green-500/50 text-green-400 px-3 py-1">
                    {group.keys.length} VALID
                  </span>
                </div>
                <div className="divide-y divide-[var(--c-border)]">
                  {group.keys.map(key => {
                    const value = revealed.get(key.id);
                    const revealing =
                      revealMutation.isPending &&
                      revealMutation.variables?.keyId === key.id;
                    return (
                      <div
                        key={key.id}
                        className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-center hover:bg-[rgba(79,255,240,0.025)]"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-sm md:text-base break-all select-all text-[var(--c-text)]">
                            {value || key.keyMasked}
                          </div>
                          <div className="data-text text-[10px] text-[var(--c-cyan-dim)] mt-2 uppercase tracking-widest">
                            Checked {formatDate(key.lastCheckedAt)} · ID{" "}
                            {key.id}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="border-[var(--c-border)] text-[var(--c-cyan)]"
                            disabled={revealing}
                            onClick={() => toggleReveal(group.provider, key.id)}
                          >
                            {revealing ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : value ? (
                              <EyeOff className="h-4 w-4 mr-2" />
                            ) : (
                              <Eye className="h-4 w-4 mr-2" />
                            )}
                            {value ? "HIDE" : "REVEAL"}
                          </Button>
                          <Button
                            variant="outline"
                            className="border-[var(--c-border)] text-[var(--c-cyan)]"
                            disabled={!value || copyMutation.isPending}
                            onClick={() => copyKey(group.provider, key.id)}
                          >
                            <Copy className="h-4 w-4 mr-2" /> COPY
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
