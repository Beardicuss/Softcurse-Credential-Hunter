
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
  Edit2,
  Lock,
  Copy,
  Eye,
  EyeOff,
  X,
  Activity,
  Database,
  Shield,
  Layers3,
  Search,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type RouterOutput = inferRouterOutputs<AppRouter>;
type HunterSnapshot = RouterOutput["hunter"]["getHunterSnapshot"];
type HunterProvider = HunterSnapshot["providers"][number];
type HunterFailedQuery = HunterSnapshot["failedQueries"][number];

type KeyValidity = "valid" | "invalid" | "rate_limited" | "unknown";

interface EditKeyObj {
  id: number;
  provider: string;
  keyValue: string;
  validity: KeyValidity;
}

const fmtDate = (d: Date | string | null | undefined): string =>
  d ? new Date(d).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "—";

const formatPct = (value: number): string => `${Math.round((value || 0) * 100)}%`;

const bucketTone = (value: number): string => {
  if (value >= 0.66) return "text-green-400";
  if (value >= 0.33) return "text-yellow-400";
  return "text-[var(--c-magenta)]";
};

const statusTone = (count: number): string => (count > 0 ? "text-[var(--c-cyan)]" : "text-[var(--c-cyan-dim)]");

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [password, setPassword] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());
  const [newProviderName, setNewProviderName] = useState("");
  const [addKeyProvider, setAddKeyProvider] = useState("");
  const [addKeyValue, setAddKeyValue] = useState("");
  const [addKeyValidity, setAddKeyValidity] = useState<KeyValidity>("unknown");
  const [editKeyObj, setEditKeyObj] = useState<EditKeyObj | null>(null);
  const [pendingKeyId, setPendingKeyId] = useState<number | null>(null);
  const [pendingDiagProvider, setPendingDiagProvider] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      document.cookie = `app_session_id=${data.token}; Path=/; max-age=31536000; SameSite=Lax; ${window.location.protocol === "https:" ? "Secure" : ""}`;
      toast.success("SYSTEM ACCESS GRANTED");
      window.location.reload();
    },
    onError: (err) => {
      toast.error(`ACCESS DENIED: ${err.message}`);
    },
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.hunter.getProviderStats.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const { data: statusData } = trpc.hunter.getStatus.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const {
    data: snapshot,
    isLoading: snapshotLoading,
    refetch: refetchSnapshot,
  } = trpc.hunter.getHunterSnapshot.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
    refetchOnWindowFocus: false,
  });

  const { data: keys, isLoading: keysLoading, refetch: refetchKeys } = trpc.hunter.getProviderKeys.useQuery(
    { provider: selectedProvider || "" },
    { enabled: isAuthenticated && user?.role === "admin" && !!selectedProvider }
  );

  const validateKeyMutation = trpc.hunter.validateKey.useMutation({
    onSuccess: () => {
      toast.success("Key validated successfully");
      refetchStats();
      refetchKeys();
      refetchSnapshot();
    },
    onError: (error) => {
      toast.error(`Validation failed: ${error.message}`);
    },
  });

  const validateAllMutation = trpc.hunter.validateAllKeysForProvider.useMutation({
    onSuccess: (result) => {
      toast.success(`Validation complete: ${result.valid} valid, ${result.invalid} invalid, ${result.rateLimited} rate-limited`);
      refetchStats();
      refetchKeys();
      refetchSnapshot();
    },
    onError: (error) => {
      toast.error(`Batch validation failed: ${error.message}`);
    },
  });

  const addKeyMutation = trpc.hunter.addKey.useMutation({
    onSuccess: () => {
      toast.success("Key added");
      refetchStats();
      refetchKeys();
      refetchSnapshot();
      setAddKeyProvider("");
      setAddKeyValue("");
      setAddKeyValidity("unknown");
    },
    onError: (error) => {
      toast.error(`Failed to add key: ${error.message}`);
    },
  });

  const editKeyMutation = trpc.hunter.editKey.useMutation({
    onSuccess: () => {
      toast.success("Key updated");
      refetchKeys();
      refetchStats();
      refetchSnapshot();
      setEditKeyObj(null);
    },
    onError: (error) => {
      toast.error(`Failed to update key: ${error.message}`);
    },
  });

  const addProviderMutation = trpc.hunter.addProvider.useMutation({
    onSuccess: () => {
      toast.success("Provider initialized successfully");
      refetchStats();
      refetchSnapshot();
      setNewProviderName("");
    },
    onError: (error) => {
      toast.error(`Failed to initialize provider: ${error.message}`);
    },
  });

  const snapshotProviders = snapshot?.providers ?? [];
  const failedQueries = snapshot?.failedQueries ?? [];

  const healthSummary = useMemo(() => {
    const totals = snapshot?.totals ?? { candidates: 0, confirmedKeys: 0, confirmedCommits: 0, providers: 0 };
    const validation = snapshot?.validation ?? { valid: 0, invalid: 0, unknown: 0, byTier: { high: 0, medium: 0, low: 0, unknown: 0 } };
    const freshness = snapshot?.freshness ?? { fresh: 0, warm: 0, stale: 0, revalidationSuggested: 0 };
    const totalValidated = validation.valid + validation.invalid + validation.unknown;
    const validRatio = totalValidated > 0 ? validation.valid / totalValidated : 0;
    const staleRatio = totals.confirmedKeys > 0 ? freshness.stale / totals.confirmedKeys : 0;
    return { totals, validation, freshness, validRatio, staleRatio };
  }, [snapshot]);

  const topProviders = useMemo(() => {
    return [...snapshotProviders]
      .sort((a, b) => {
        const validDelta = (b.valid || 0) - (a.valid || 0);
        if (validDelta !== 0) return validDelta;
        return (b.total || 0) - (a.total || 0);
      })
      .slice(0, 6);
  }, [snapshotProviders]);

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        <div className="glow-bloom" />
        <div className="glass-panel p-10 max-w-md w-full text-center relative z-10 border-[var(--c-cyan)]">
          <Lock className="h-12 w-12 text-[var(--c-cyan)] mx-auto mb-4" />
          <h1 className="hero-text text-[var(--c-cyan)] text-shadow-glow-cyan text-3xl">SYSTEM LOGIN</h1>
          <div className="divider my-4" />
          <p className="data-text data-cyan mb-6 tracking-widest text-sm">AUTHENTICATION REQUIRED</p>
          <div className="flex flex-col gap-4">
            <Input
              type="password"
              placeholder="ENTER VAULT KEY"
              className="glass-panel text-center text-xl tracking-[0.2em] font-mono data-text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loginMutation.mutate({ password })}
            />
            <Button
              className="w-full bg-[var(--c-cyan)] text-black hover:bg-black hover:text-[var(--c-cyan)] hover:border-[var(--c-cyan)] border border-transparent transition-all duration-300 font-mono tracking-widest text-md h-12"
              onClick={() => loginMutation.mutate({ password })}
              disabled={loginMutation.isPending || !password}
            >
              {loginMutation.isPending ? <Loader2 className="animate-spin h-5 w-5" /> : "ACCESS VAULT"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 relative">
      <div className="glow-bloom" />
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <div className="glass-panel p-6 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
          <div>
            <h1 className="hero-text text-4xl mb-2">
              <span className="decorator"></span>HUNTER CONTROL PLANE
            </h1>
            <p className="data-text font-mono text-[var(--c-cyan-dim)] text-sm tracking-widest uppercase">
              FROZEN HUNTER.V1 SNAPSHOT + LIVE KEY POOL COMMAND SURFACE
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              className="h-10 border-[var(--c-cyan)] text-[var(--c-cyan)] hover:bg-[var(--c-cyan)] hover:text-black"
              onClick={() => {
                refetchSnapshot();
                refetchStats();
                if (selectedProvider) refetchKeys();
              }}
              disabled={snapshotLoading || statsLoading}
            >
              {snapshotLoading || statsLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              REFRESH GRID
            </Button>
            <Dialog onOpenChange={(open) => { if (!open) setNewProviderName(""); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-10 border-green-500/60 text-green-400 hover:bg-[var(--c-orange)] hover:text-black">
                  <Plus className="h-4 w-4 mr-2" /> NEW PROVIDER
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-[var(--c-orange)] bg-[var(--c-bg)]">
                <DialogHeader>
                  <DialogTitle className="data-text text-[var(--c-orange)] tracking-widest uppercase">INITIALIZE NEW PROVIDER</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4 mt-2">
                  <Input placeholder="Provider ID (e.g. Anthropic)" className="glass-panel text-[var(--c-text)] data-text" value={newProviderName} onChange={(e) => setNewProviderName(e.target.value)} />
                  <Button
                    className="w-full bg-[var(--c-orange)] text-black hover:bg-[#ff8f59] hover:shadow-[0_0_15px_rgba(255,107,53,0.4)] mt-2 cursor-pointer font-mono tracking-widest duration-300 transition-all border border-transparent"
                    onClick={() => addProviderMutation.mutate({ provider: newProviderName })}
                    disabled={addProviderMutation.isPending || !newProviderName}
                  >
                    {addProviderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "[ ESTABLISH LINK ]"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Link href="/admin/audit">
              <a className="data-text text-[var(--c-cyan)] border border-[var(--c-cyan)] px-4 py-2 hover:bg-[var(--c-cyan)] hover:text-black transition-colors duration-300 uppercase tracking-widest text-xs flex items-center h-10">
                AUDIT LOGS
              </a>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_0.95fr] gap-6">
          <div className="glass-panel p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="data-text text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-[0.35em] mb-2">Snapshot Core</p>
                <h2 className="hero-text text-5xl leading-none">Softcurse Hunter Surface</h2>
                <p className="text-[var(--c-cyan-dim)] mt-3 max-w-2xl text-sm">
                  This panel now reads the frozen contract snapshot instead of scraping UI-local assumptions. It shows source yield,
                  freshness pressure, validation confidence, and which provider families are actually worth attention.
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
              <div className="glass-panel p-4 border-[var(--c-border)]">
                <div className="flex items-center gap-2 text-[var(--c-cyan-dim)] text-xs uppercase tracking-[0.25em] mb-2"><Search className="h-3.5 w-3.5" /> Candidates</div>
                <div className="hero-text text-3xl">{healthSummary.totals.candidates}</div>
              </div>
              <div className="glass-panel p-4 border-[var(--c-border)]">
                <div className="flex items-center gap-2 text-[var(--c-cyan-dim)] text-xs uppercase tracking-[0.25em] mb-2"><Shield className="h-3.5 w-3.5" /> Confirmed Keys</div>
                <div className="hero-text text-3xl">{healthSummary.totals.confirmedKeys}</div>
              </div>
              <div className="glass-panel p-4 border-[var(--c-border)]">
                <div className="flex items-center gap-2 text-[var(--c-cyan-dim)] text-xs uppercase tracking-[0.25em] mb-2"><Database className="h-3.5 w-3.5" /> Commits</div>
                <div className="hero-text text-3xl">{healthSummary.totals.confirmedCommits}</div>
              </div>
              <div className="glass-panel p-4 border-[var(--c-border)]">
                <div className="flex items-center gap-2 text-[var(--c-cyan-dim)] text-xs uppercase tracking-[0.25em] mb-2"><Layers3 className="h-3.5 w-3.5" /> Providers</div>
                <div className="hero-text text-3xl">{healthSummary.totals.providers}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-panel p-5 border-[var(--c-border)]">
                <div className="flex items-center gap-2 text-[var(--c-cyan-dim)] text-xs uppercase tracking-[0.25em] mb-3"><Activity className="h-3.5 w-3.5" /> Validation Health</div>
                <div className={`hero-text text-4xl ${bucketTone(healthSummary.validRatio)}`}>{formatPct(healthSummary.validRatio)}</div>
                <div className="mt-3 w-full h-1 bg-[var(--c-border)] overflow-hidden">
                  <div className="h-1 bg-[var(--c-cyan)]" style={{ width: `${healthSummary.validRatio * 100}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs data-text">
                  <div><div className="text-[var(--c-cyan-dim)] uppercase tracking-widest">Valid</div><div className="text-green-400 text-lg">{healthSummary.validation.valid}</div></div>
                  <div><div className="text-[var(--c-cyan-dim)] uppercase tracking-widest">Invalid</div><div className="text-[var(--c-magenta)] text-lg">{healthSummary.validation.invalid}</div></div>
                  <div><div className="text-[var(--c-cyan-dim)] uppercase tracking-widest">Unknown</div><div className="text-yellow-400 text-lg">{healthSummary.validation.unknown}</div></div>
                </div>
              </div>

              <div className="glass-panel p-5 border-[var(--c-border)]">
                <div className="flex items-center gap-2 text-[var(--c-cyan-dim)] text-xs uppercase tracking-[0.25em] mb-3"><Clock className="h-3.5 w-3.5" /> Freshness Pressure</div>
                <div className={`hero-text text-4xl ${bucketTone(1 - healthSummary.staleRatio)}`}>{healthSummary.freshness.revalidationSuggested}</div>
                <div className="text-xs text-[var(--c-cyan-dim)] uppercase tracking-widest mt-2">Need revalidation</div>
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs data-text">
                  <div><div className="text-[var(--c-cyan-dim)] uppercase tracking-widest">Fresh</div><div className="text-[var(--c-cyan)] text-lg">{healthSummary.freshness.fresh}</div></div>
                  <div><div className="text-[var(--c-cyan-dim)] uppercase tracking-widest">Warm</div><div className="text-yellow-400 text-lg">{healthSummary.freshness.warm}</div></div>
                  <div><div className="text-[var(--c-cyan-dim)] uppercase tracking-widest">Stale</div><div className="text-[var(--c-magenta)] text-lg">{healthSummary.freshness.stale}</div></div>
                </div>
              </div>

              <div className="glass-panel p-5 border-[var(--c-border)]">
                <div className="flex items-center gap-2 text-[var(--c-cyan-dim)] text-xs uppercase tracking-[0.25em] mb-3"><Sparkles className="h-3.5 w-3.5" /> Validation Tiers</div>
                <div className="space-y-3 text-sm data-text">
                  <div className="flex items-center justify-between"><span className="uppercase tracking-widest text-[var(--c-cyan-dim)]">High</span><span className="text-[var(--c-cyan)]">{healthSummary.validation.byTier.high}</span></div>
                  <div className="flex items-center justify-between"><span className="uppercase tracking-widest text-[var(--c-cyan-dim)]">Medium</span><span className="text-yellow-400">{healthSummary.validation.byTier.medium}</span></div>
                  <div className="flex items-center justify-between"><span className="uppercase tracking-widest text-[var(--c-cyan-dim)]">Low</span><span className="text-[var(--c-magenta)]">{healthSummary.validation.byTier.low}</span></div>
                  <div className="flex items-center justify-between"><span className="uppercase tracking-widest text-[var(--c-cyan-dim)]">Unknown</span><span className="text-gray-400">{healthSummary.validation.byTier.unknown}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="data-text data-cyan tracking-widest uppercase"><span className="decorator"></span>Pipeline Alerts</h3>
              <span className={`text-xs uppercase tracking-[0.3em] ${failedQueries.length ? "text-[var(--c-magenta)]" : "text-[var(--c-cyan)]"}`}>
                {failedQueries.length ? `${failedQueries.length} active` : "clear"}
              </span>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-auto pr-2">
              {snapshotLoading ? (
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

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="data-text data-cyan tracking-widest uppercase"><span className="decorator"></span>Top Provider Yield</h2>
            <span className="text-xs uppercase tracking-[0.28em] text-[var(--c-cyan-dim)]">Snapshot-ranked providers</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {topProviders.length ? (
              topProviders.map((provider) => <SnapshotProviderCard key={provider.provider} provider={provider} />)
            ) : (
              <div className="col-span-full glass-panel p-8 border border-dashed border-[var(--c-border)] text-center text-[var(--c-cyan-dim)]">
                Hunter snapshot has no provider records yet.
              </div>
            )}
          </div>
        </div>

        {statusData && (
          <div className="glass-panel p-6">
            <h2 className="data-text data-cyan mb-4 tracking-widest uppercase border-b border-[var(--c-border)] pb-2 flex justify-between items-center">
              <span><span className="decorator"></span>PROVIDER FALLBACK CHAIN</span>
              <Dialog onOpenChange={(open) => {
                if (!open) {
                  setAddKeyProvider("");
                  setAddKeyValue("");
                  setAddKeyValidity("unknown");
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-8 border-[var(--c-cyan)] text-[var(--c-cyan)] hover:bg-[var(--c-cyan)] hover:text-black">
                    <Plus className="h-4 w-4 mr-2" /> ADD KEY
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-panel border-[var(--c-cyan)] bg-[var(--c-bg)]">
                  <DialogHeader>
                    <DialogTitle className="data-text data-cyan">ADD NEW KEY</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4 mt-2">
                    <Input placeholder="Provider (e.g. OpenAI)" className="glass-panel text-[var(--c-text)] data-text" value={addKeyProvider} onChange={(e) => setAddKeyProvider(e.target.value)} />
                    <Input placeholder="API Key Value" type="password" className="glass-panel text-[var(--c-text)] data-text" value={addKeyValue} onChange={(e) => setAddKeyValue(e.target.value)} />
                    <Select onValueChange={(val) => setAddKeyValidity(val as KeyValidity)} value={addKeyValidity}>
                      <SelectTrigger className="glass-panel !mb-2 data-text">
                        <SelectValue placeholder="Validity Status" />
                      </SelectTrigger>
                      <SelectContent className="glass-panel bg-[var(--c-bg)] border-[var(--c-cyan)]">
                        <SelectItem value="valid" className="data-text text-green-500 hover:text-green-500 hover:bg-black focus:bg-[var(--c-cyan)] focus:text-black">valid</SelectItem>
                        <SelectItem value="unknown" className="data-text text-yellow-500 hover:text-yellow-500 hover:bg-black focus:bg-[var(--c-cyan)] focus:text-black">unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      className="w-full bg-[var(--c-cyan)] text-black hover:bg-[var(--c-cyan-soft)] hover:shadow-[0_0_15px_rgba(0,255,255,0.3)] mt-4 cursor-pointer font-mono tracking-widest duration-300 transition-all border border-transparent"
                      onClick={() => addKeyMutation.mutate({ provider: addKeyProvider, keyValue: addKeyValue, validity: addKeyValidity })}
                      disabled={addKeyMutation.isPending || !addKeyProvider || !addKeyValue}
                    >
                      {addKeyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "[ INJECT KEY ]"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-sm data-text">
              <div className="border border-[var(--c-border)] px-4 py-3">
                <div className="text-[var(--c-cyan-dim)] text-xs uppercase">Service</div>
                <div className="text-green-400 mt-1">{statusData.status.toUpperCase()}</div>
              </div>
              <div className="border border-[var(--c-border)] px-4 py-3">
                <div className="text-[var(--c-cyan-dim)] text-xs uppercase">Providers</div>
                <div className="text-[var(--c-cyan)] mt-1">{statusData.providers}</div>
              </div>
              <div className="border border-[var(--c-border)] px-4 py-3">
                <div className="text-[var(--c-cyan-dim)] text-xs uppercase">Valid keys</div>
                <div className="text-green-400 mt-1">{statusData.validKeys}</div>
              </div>
              <div className="border border-[var(--c-border)] px-4 py-3">
                <div className="text-[var(--c-cyan-dim)] text-xs uppercase">Contract</div>
                <div className="text-[var(--c-orange)] mt-1">{snapshot?.contractVersion || "hunter.v1"}</div>
              </div>
            </div>
          </div>
        )}

        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="data-text data-cyan tracking-widest uppercase"><span className="decorator"></span>Manual Key Pool Control</h2>
            <span className="text-xs uppercase tracking-[0.28em] text-[var(--c-cyan-dim)]">Legacy controls kept online during UI rebuild</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statsLoading ? (
              <div className="col-span-full flex justify-center py-12 glass-panel">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--c-cyan)]" />
              </div>
            ) : (
              stats?.map((stat) => {
                const isHealthy = stat.validKeyCount > 0;
                const healthRatio = stat.totalKeyCount > 0 ? stat.validKeyCount / stat.totalKeyCount : 0;
                const barColor = healthRatio >= 0.5 ? "bg-green-500" : healthRatio >= 0.2 ? "bg-yellow-500" : "bg-[var(--c-magenta)]";
                return (
                  <div
                    key={stat.provider}
                    className={`glass-panel p-6 cursor-pointer group transition-all duration-300 ${selectedProvider === stat.provider ? "shadow-[0_0_15px_rgba(0,255,255,0.3)] border-[var(--c-cyan)]" : ""
                      } ${isHealthy ? "border-green-500/40" : ""}`}
                    onClick={() => {
                      setRevealedKeys(new Set());
                      setSelectedProvider((prev) => (prev === stat.provider ? null : stat.provider));
                    }}
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="hero-text text-xl flex items-center gap-2">{stat.provider}</h3>
                      {isHealthy && (
                        <span className="data-text text-xs border border-green-500/60 text-green-400 px-2 py-1" style={{ animation: "pulse 3s infinite" }}>
                          VALID
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-2 data-text">
                      <div>
                        <p className="text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-widest">Valid Keys</p>
                        <p className="text-2xl font-bold data-cyan">{stat.validKeyCount}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-widest">Total Keys</p>
                        <p className="text-2xl font-bold data-cyan">{stat.totalKeyCount}</p>
                      </div>
                      <div className="col-span-2 mb-2">
                        <div className="w-full h-1 bg-[var(--c-border)] rounded-full overflow-hidden">
                          <div className={`h-1 transition-all duration-500 ${barColor}`} style={{ width: `${healthRatio * 100}%` }} />
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-widest">Requests</p>
                        <p className="text-lg font-semibold text-[var(--c-text)]">{stat.totalRequests}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-widest">Failed</p>
                        <p className="text-lg font-semibold data-magenta">{stat.failedRequests}</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-[var(--c-border)] flex flex-col gap-4">
                      <p className="text-[11px] text-[var(--c-cyan-dim)] flex items-center gap-2 uppercase tracking-widest data-text">
                        <Clock className="h-3 w-3" />
                        LST_SYNC: {fmtDate(stat.lastRefreshAt)}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[var(--c-border)] text-[var(--c-cyan)] hover:bg-[var(--c-cyan)] hover:text-black font-mono tracking-widest text-xs h-8 cursor-pointer transition-colors duration-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDiagProvider(stat.provider);
                          validateAllMutation.mutate({ provider: stat.provider }, { onSettled: () => setPendingDiagProvider(null) });
                        }}
                        disabled={pendingDiagProvider === stat.provider}
                      >
                        {pendingDiagProvider === stat.provider ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        RUN DIAGNOSTIC
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {selectedProvider && (
          <div className="glass-panel p-6">
            <h2 className="data-text data-cyan mb-4 tracking-widest uppercase border-b border-[var(--c-border)] pb-2 flex items-center justify-between">
              <span><span className="decorator"></span>{selectedProvider} :: SYSTEM_KEYS</span>
              <div className="flex items-center gap-3">
                {keysLoading && <Loader2 className="h-4 w-4 animate-spin data-cyan" />}
                <button className="text-[var(--c-cyan-dim)] hover:text-[var(--c-cyan)] transition-colors" title="Close panel" onClick={() => { setSelectedProvider(null); setRevealedKeys(new Set()); }}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </h2>
            <div className="mt-4">
              {keysLoading ? (
                <div className="flex justify-center py-12">
                  <span className="data-text data-cyan tracking-widest uppercase animate-pulse">FETCHING NODES...</span>
                </div>
              ) : keys && keys.length > 0 ? (
                <div className="space-y-4">
                  {keys.map((key) => (
                    <div key={key.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-[var(--c-border)] bg-[#050810] glass-panel group transition-all duration-300 hover:border-[var(--c-cyan-dim)]">
                      <div className="flex-1 mb-4 md:mb-0">
                        <div className="flex items-center gap-3 data-text">
                          <p
                            className="text-lg text-[var(--c-text)] cursor-pointer hover:text-[var(--c-cyan)] transition-colors select-all"
                            style={{ wordBreak: "break-all" }}
                            title="Click to reveal/hide full key"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRevealedKeys((prev) => {
                                const next = new Set(prev);
                                if (next.has(key.id)) next.delete(key.id);
                                else next.add(key.id);
                                return next;
                              });
                            }}
                          >
                            {revealedKeys.has(key.id) ? key.keyValue : key.keyMasked}
                          </p>
                          <button
                            className="text-[var(--c-cyan)] hover:text-[var(--c-cyan-dim)] transition-colors flex items-center gap-1 text-xs font-mono border border-[var(--c-border)] px-2 py-1"
                            title={revealedKeys.has(key.id) ? "Hide full key" : "Reveal full key"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRevealedKeys((prev) => {
                                const next = new Set(prev);
                                if (next.has(key.id)) next.delete(key.id);
                                else next.add(key.id);
                                return next;
                              });
                            }}
                          >
                            {revealedKeys.has(key.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            {revealedKeys.has(key.id) ? "HIDE" : "REVEAL"}
                          </button>
                          {revealedKeys.has(key.id) && (
                            <button
                              className="text-[var(--c-cyan)] hover:text-[var(--c-cyan-dim)] transition-colors flex items-center gap-1 text-xs font-mono border border-[var(--c-border)] px-2 py-1"
                              title="Copy to clipboard"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(key.keyValue);
                                toast.success("Key copied to clipboard");
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" /> COPY
                            </button>
                          )}
                          {key.validity === "valid" && <span className="text-xs border border-green-500 text-green-500 px-2 py-0.5 flex items-center gap-1 shadow-[0_0_8px_rgba(34,197,94,0.3)]"><CheckCircle className="h-3 w-3" /> VALID</span>}
                          {key.validity === "invalid" && <span className="text-xs border border-[var(--c-magenta)] text-[var(--c-magenta)] px-2 py-0.5 flex items-center gap-1 shadow-[0_0_8px_rgba(255,0,255,0.3)]"><AlertCircle className="h-3 w-3" /> INVALID</span>}
                          {key.validity === "rate_limited" && <span className="text-xs border border-yellow-500 text-yellow-500 px-2 py-0.5 flex items-center gap-1 shadow-[0_0_8px_rgba(234,179,8,0.3)]"><AlertCircle className="h-3 w-3" /> RATE_LMT</span>}
                          {key.validity === "unknown" && <span className="text-xs border border-gray-500 text-gray-500 px-2 py-0.5 flex items-center gap-1">UNKNOWN</span>}
                        </div>
                        <div className="flex gap-4 mt-2 data-text text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-widest">
                          <p>PRB_COUNT: {key.usageCount}</p>
                          <p>CHK_TIME: {fmtDate(key.lastCheckedAt)}</p>
                        </div>
                      </div>
                      <div className="flex flex-row gap-2 w-full md:w-auto">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="outline" className="h-9 w-9 border-[var(--c-border)] text-[var(--c-text)] hover:text-[var(--c-cyan)] hover:border-[var(--c-cyan)] cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); setEditKeyObj({ id: key.id, provider: selectedProvider, validity: key.validity as KeyValidity, keyValue: "" }); }}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          {editKeyObj && editKeyObj.id === key.id && (
                            <DialogContent className="glass-panel border-[var(--c-cyan)] bg-[var(--c-bg)]">
                              <DialogHeader>
                                <DialogTitle className="data-text data-cyan flex items-center"><span className="decorator"></span>EDIT KEY: {key.keyMasked}</DialogTitle>
                              </DialogHeader>
                              <div className="grid gap-4 py-4 mt-2">
                                <Input placeholder="New Value (leave blank to keep current)" type="password" className="glass-panel text-[var(--c-text)] data-text" value={editKeyObj.keyValue} onChange={(e) => setEditKeyObj({ ...editKeyObj, keyValue: e.target.value })} />
                                <Select onValueChange={(val) => setEditKeyObj({ ...editKeyObj, validity: val as KeyValidity })} value={editKeyObj.validity}>
                                  <SelectTrigger className="glass-panel !mb-2 data-text">
                                    <SelectValue placeholder="Validity Status" />
                                  </SelectTrigger>
                                  <SelectContent className="glass-panel bg-[var(--c-bg)] border-[var(--c-cyan)]">
                                    <SelectItem value="valid" className="data-text text-green-500 focus:bg-green-500 focus:text-black hover:bg-green-500 hover:text-black">valid</SelectItem>
                                    <SelectItem value="invalid" className="data-text text-[var(--c-magenta)] focus:bg-[var(--c-magenta)] focus:text-white hover:bg-[var(--c-magenta)] hover:text-white">invalid</SelectItem>
                                    <SelectItem value="rate_limited" className="data-text text-yellow-500 focus:bg-yellow-500 focus:text-black hover:bg-yellow-500 hover:text-black">rate_limited</SelectItem>
                                    <SelectItem value="unknown" className="data-text text-gray-500 focus:bg-gray-500 focus:text-white hover:bg-gray-500 hover:text-white">unknown</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  className="w-full bg-[var(--c-cyan)] text-black hover:bg-[var(--c-cyan-soft)] hover:shadow-[0_0_15px_rgba(0,255,255,0.3)] mt-4 cursor-pointer font-mono tracking-widest duration-300 transition-all border border-transparent"
                                  onClick={() => editKeyMutation.mutate({ id: editKeyObj.id, provider: selectedProvider, keyValue: editKeyObj.keyValue || undefined, validity: editKeyObj.validity })}
                                  disabled={editKeyMutation.isPending}
                                >
                                  {editKeyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "[ OVERWRITE KEY ]"}
                                </Button>
                              </div>
                            </DialogContent>
                          )}
                        </Dialog>

                        <Button
                          size="icon"
                          variant="outline"
                          className="h-9 w-9 border-[var(--c-border)] text-[var(--c-text)] hover:text-[var(--c-cyan)] hover:border-[var(--c-cyan)] cursor-pointer transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingKeyId(key.id);
                            validateKeyMutation.mutate({ provider: selectedProvider, keyId: key.id }, { onSettled: () => setPendingKeyId(null) });
                          }}
                          disabled={pendingKeyId === key.id}
                        >
                          {pendingKeyId === key.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 flex items-center justify-center border border-dashed border-[var(--c-border)] glass-panel">
                  <p className="data-text uppercase tracking-widest text-[var(--c-cyan-dim)] text-xs flex items-center gap-2"><AlertCircle className="h-4 w-4" /> NO KEYS DETECTED ON EXPANSE</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SnapshotProviderCard({ provider }: { provider: HunterProvider }) {
  const validRatio = provider.total > 0 ? provider.valid / provider.total : 0;
  const barClass = validRatio >= 0.5 ? "bg-green-500" : validRatio >= 0.2 ? "bg-yellow-500" : "bg-[var(--c-magenta)]";

  return (
    <div className="glass-panel p-5 border-[var(--c-border)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="hero-text text-2xl">{provider.provider}</h3>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--c-cyan-dim)] mt-1">Source-ranked provider family</p>
        </div>
        <div className={`text-xs uppercase tracking-[0.28em] ${statusTone(provider.valid)}`}>
          {provider.valid > 0 ? "viable" : "cold"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 data-text mb-4">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--c-cyan-dim)]">Valid</div>
          <div className="text-2xl text-green-400">{provider.valid}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-[var(--c-cyan-dim)]">Total</div>
          <div className="text-2xl text-[var(--c-cyan)]">{provider.total}</div>
        </div>
      </div>

      <div className="w-full h-1 bg-[var(--c-border)] overflow-hidden mb-4">
        <div className={`${barClass} h-1`} style={{ width: `${validRatio * 100}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs data-text">
        <div>
          <div className="text-[var(--c-cyan-dim)] uppercase tracking-widest">Fresh</div>
          <div className="text-[var(--c-cyan)] text-lg">{provider.freshness.fresh}</div>
        </div>
        <div>
          <div className="text-[var(--c-cyan-dim)] uppercase tracking-widest">Stale</div>
          <div className="text-[var(--c-magenta)] text-lg">{provider.freshness.stale}</div>
        </div>
        <div>
          <div className="text-[var(--c-cyan-dim)] uppercase tracking-widest">Avg confidence</div>
          <div className="text-[var(--c-cyan)] text-lg">{provider.avgConfidence.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[var(--c-cyan-dim)] uppercase tracking-widest">Recheck</div>
          <div className="text-yellow-400 text-lg">{provider.revalidationSuggested}</div>
        </div>
      </div>
    </div>
  );
}

function FailedQueryCard({ query }: { query: HunterFailedQuery }) {
  return (
    <div className="glass-panel p-4 border-[var(--c-border)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm uppercase tracking-[0.28em] text-[var(--c-cyan)] data-text">{query.source || "unknown-source"}</div>
          <div className="text-xs text-[var(--c-cyan-dim)] mt-1">{query.query || "No query recorded"}</div>
        </div>
        <AlertCircle className="h-4 w-4 text-[var(--c-magenta)] flex-shrink-0 mt-1" />
      </div>
      <div className="text-xs leading-6 text-[var(--c-text)] break-words">{query.error || "Unknown source failure"}</div>
    </div>
  );
}
