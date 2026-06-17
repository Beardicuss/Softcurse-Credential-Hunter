import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, RefreshCw, AlertCircle, CheckCircle, Clock, Plus, Edit2, Lock, Copy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [password, setPassword] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      document.cookie = `app_session_id=${data.token}; Path=/; max-age=31536000; SameSite=Lax; ${window.location.protocol === 'https:' ? 'Secure' : ''}`;
      toast.success("SYSTEM ACCESS GRANTED");
      window.location.reload();
    },
    onError: (err) => {
      toast.error(`ACCESS DENIED: ${err.message}`);
    }
  });

  const [addKeyProvider, setAddKeyProvider] = useState("");
  const [addKeyValue, setAddKeyValue] = useState("");
  const [addKeyValidity, setAddKeyValidity] = useState<any>("unknown");

  const [editKeyObj, setEditKeyObj] = useState<any>(null);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.chessAI.getProviderStats.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: statusData } = trpc.chessAI.getStatus.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: keys, isLoading: keysLoading, refetch: refetchKeys } = trpc.chessAI.getProviderKeys.useQuery(
    { provider: selectedProvider || "" },
    { enabled: isAuthenticated && user?.role === "admin" && !!selectedProvider }
  );

  const validateKeyMutation = trpc.chessAI.validateKey.useMutation({
    onSuccess: () => { toast.success("Key validated successfully"); refetchStats(); refetchKeys(); },
    onError: (error) => { toast.error(`Validation failed: ${error.message}`); },
  });

  const validateAllMutation = trpc.chessAI.validateAllKeysForProvider.useMutation({
    onSuccess: (result) => {
      toast.success(`Validation complete: ${result.valid} valid, ${result.invalid} invalid, ${result.rateLimited} rate-limited`);
      refetchStats();
    },
    onError: (error) => { toast.error(`Batch validation failed: ${error.message}`); },
  });

  const addKeyMutation = trpc.chessAI.addKey.useMutation({
    onSuccess: () => {
      toast.success("Key added");
      refetchStats();
      setAddKeyProvider("");
      setAddKeyValue("");
    },
    onError: (error) => { toast.error(`Failed to add key: ${error.message}`); },
  });

  const editKeyMutation = trpc.chessAI.editKey.useMutation({
    onSuccess: () => {
      toast.success("Key updated");
      refetchKeys();
      setEditKeyObj(null);
    },
    onError: (error) => { toast.error(`Failed to update key: ${error.message}`); },
  });

  const addProviderMutation = trpc.chessAI.addProvider.useMutation({
    onSuccess: () => {
      toast.success("Provider initialized successfully");
      refetchStats();
      setAddKeyProvider("");
    },
    onError: (error) => { toast.error(`Failed to initialize provider: ${error.message}`); },
  });

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
              onKeyDown={(e) => e.key === 'Enter' && loginMutation.mutate({ password })}
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
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        <div className="glass-panel p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="hero-text text-4xl mb-2">
              <span className="decorator"></span>AI KEY POOL MANAGER
            </h1>
            <p className="data-text font-mono text-[var(--c-cyan-dim)] text-sm tracking-widest uppercase">
              MONITOR AND MANAGE API KEYS ACROSS ALL NODES
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-10 border-[var(--c-orange)] text-[var(--c-orange)] hover:bg-[var(--c-orange)] hover:text-black">
                  <Plus className="h-4 w-4 mr-2" /> NEW PROVIDER
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-[var(--c-orange)] bg-[var(--c-bg)]">
                <DialogHeader>
                  <DialogTitle className="data-text text-[var(--c-orange)] tracking-widest uppercase">INITIALIZE NEW PROVIDER</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4 mt-2">
                  <Input placeholder="Provider ID (e.g. Anthropic)" className="glass-panel text-[var(--c-text)] data-text" value={addKeyProvider} onChange={e => setAddKeyProvider(e.target.value)} />
                  <Button
                    className="w-full bg-[var(--c-orange)] text-black hover:bg-[#ff8f59] hover:shadow-[0_0_15px_rgba(255,107,53,0.4)] mt-2 cursor-pointer font-mono tracking-widest duration-300 transition-all border border-transparent"
                    onClick={() => addProviderMutation.mutate({ provider: addKeyProvider })}
                    disabled={addProviderMutation.isPending || !addKeyProvider}
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

        {/* Fallback Chain Display */}
        {statusData && (
          <div className="glass-panel p-6">
            <h2 className="data-text data-cyan mb-4 tracking-widest uppercase border-b border-[var(--c-border)] pb-2 flex justify-between items-center">
              <span><span className="decorator"></span>PROVIDER FALLBACK CHAIN</span>
              <Dialog>
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
                    <Input placeholder="Provider (e.g. OpenAI)" className="glass-panel text-[var(--c-text)] data-text" value={addKeyProvider} onChange={e => setAddKeyProvider(e.target.value)} />
                    <Input placeholder="API Key Value" type="password" className="glass-panel text-[var(--c-text)] data-text" value={addKeyValue} onChange={e => setAddKeyValue(e.target.value)} />
                    <Select onValueChange={setAddKeyValidity} value={addKeyValidity}>
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

            <div className="flex items-center gap-2 flex-wrap">
              {statusData.providerChain.map((provider: string, index: number) => (
                <div key={provider} className="flex items-center gap-2 font-mono text-sm data-text">
                  <div
                    className={`px-3 py-1 border transition-all ${provider === statusData.currentProvider
                      ? "border-[var(--c-orange)] text-[var(--c-orange)] shadow-[0_0_8px_rgba(255,107,53,0.4)]"
                      : "border-[var(--c-border)] text-[var(--c-cyan-dim)]"
                      }`}
                  >
                    {provider}
                  </div>
                  {index < statusData.providerChain.length - 1 && (
                    <span className="text-[var(--c-border)]">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Provider Overview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statsLoading ? (
            <div className="col-span-full flex justify-center py-12 glass-panel">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--c-cyan)]" />
            </div>
          ) : (
            stats?.map((stat) => {
              const isActive = stat.provider === statusData?.currentProvider;
              return (
                <div
                  key={stat.provider}
                  className={`glass-panel p-6 cursor-pointer group transition-all duration-300 ${selectedProvider === stat.provider ? "shadow-[0_0_15px_rgba(0,255,255,0.3)] border-[var(--c-cyan)]" : ""
                    } ${isActive ? "border-[var(--c-orange)] shadow-[0_0_15px_rgba(255,107,53,0.2)]" : ""}`}
                  onClick={() => setSelectedProvider(stat.provider)}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="hero-text text-xl flex items-center gap-2">
                      {stat.provider}
                    </h3>
                    {isActive && (
                      <span className="data-text text-xs border border-[var(--c-orange)] text-[var(--c-orange)] px-2 py-1" style={{ animation: "pulse-orange 3s infinite" }}>LIVE</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6 data-text">
                    <div>
                      <p className="text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-widest">Valid Keys</p>
                      <p className="text-2xl font-bold data-cyan">{stat.validKeyCount}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-widest">Total Keys</p>
                      <p className="text-2xl font-bold data-cyan">{stat.totalKeyCount}</p>
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
                      LST_SYNC: {stat.lastRefreshAt ? new Date(stat.lastRefreshAt).toLocaleTimeString() : "N/A"}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[var(--c-border)] text-[var(--c-cyan)] hover:bg-[var(--c-cyan)] hover:text-black font-mono tracking-widest text-xs h-8 cursor-pointer transition-colors duration-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        validateAllMutation.mutate({ provider: stat.provider });
                      }}
                      disabled={validateAllMutation.isPending}
                    >
                      {validateAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      RUN DIAGNOSTIC
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Provider Details */}
        {selectedProvider && (
          <div className="glass-panel p-6">
            <h2 className="data-text data-cyan mb-4 tracking-widest uppercase border-b border-[var(--c-border)] pb-2 flex items-center justify-between">
              <span><span className="decorator"></span>{selectedProvider} :: SYSTEM_KEYS</span>
              {keysLoading && <Loader2 className="h-4 w-4 animate-spin data-cyan" />}
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
                              setRevealedKeys(prev => {
                                const next = new Set(prev);
                                if (next.has(key.id)) next.delete(key.id);
                                else next.add(key.id);
                                return next;
                              });
                            }}
                          >
                            {revealedKeys.has(key.id) ? key.keyValue : key.keyMasked}
                          </p>
                          {revealedKeys.has(key.id) && (
                            <button
                              className="text-[var(--c-cyan)] hover:text-[var(--c-cyan-dim)] transition-colors flex-shrink-0"
                              title="Copy to clipboard"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(key.keyValue);
                                toast.success("Key copied to clipboard");
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          )}
                          {key.validity === "valid" && <span className="text-xs border border-green-500 text-green-500 px-2 py-0.5 flex items-center gap-1 shadow-[0_0_8px_rgba(34,197,94,0.3)]"><CheckCircle className="h-3 w-3" /> VALID</span>}
                          {key.validity === "invalid" && <span className="text-xs border border-[var(--c-magenta)] text-[var(--c-magenta)] px-2 py-0.5 flex items-center gap-1 shadow-[0_0_8px_rgba(255,0,255,0.3)]"><AlertCircle className="h-3 w-3" /> INVALID</span>}
                          {key.validity === "rate_limited" && <span className="text-xs border border-yellow-500 text-yellow-500 px-2 py-0.5 flex items-center gap-1 shadow-[0_0_8px_rgba(234,179,8,0.3)]"><AlertCircle className="h-3 w-3" /> RATE_LMT</span>}
                          {key.validity === "unknown" && <span className="text-xs border border-gray-500 text-gray-500 px-2 py-0.5 flex items-center gap-1">UNKNOWN</span>}
                        </div>
                        <div className="flex gap-4 mt-2 data-text text-[11px] text-[var(--c-cyan-dim)] uppercase tracking-widest">
                          <p>PRB_COUNT: {key.usageCount}</p>
                          <p>CHK_TIME: {new Date(key.lastCheckedAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex flex-row gap-2 w-full md:w-auto">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="outline" className="h-9 w-9 border-[var(--c-border)] text-[var(--c-text)] hover:text-[var(--c-cyan)] hover:border-[var(--c-cyan)] cursor-pointer transition-colors" onClick={() => setEditKeyObj({ id: key.id, provider: selectedProvider, validity: key.validity, keyValue: "" })}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          {editKeyObj && editKeyObj.id === key.id && (
                            <DialogContent className="glass-panel border-[var(--c-cyan)] bg-[var(--c-bg)]">
                              <DialogHeader>
                                <DialogTitle className="data-text data-cyan flex items-center"><span className="decorator"></span>EDIT KEY: {key.keyMasked}</DialogTitle>
                              </DialogHeader>
                              <div className="grid gap-4 py-4 mt-2">
                                <Input placeholder="New Value (leave blank to keep current)" type="password" className="glass-panel text-[var(--c-text)] data-text" value={editKeyObj.keyValue} onChange={e => setEditKeyObj({ ...editKeyObj, keyValue: e.target.value })} />
                                <Select onValueChange={(val) => setEditKeyObj({ ...editKeyObj, validity: val })} value={editKeyObj.validity}>
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

                        <Button size="icon" variant="outline" className="h-9 w-9 border-[var(--c-border)] text-[var(--c-text)] hover:text-[var(--c-cyan)] hover:border-[var(--c-cyan)] cursor-pointer transition-colors" onClick={() => validateKeyMutation.mutate({ provider: selectedProvider, keyId: key.id })} disabled={validateKeyMutation.isPending}>
                          {validateKeyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
