import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TopProviderYield } from "@/components/admin/TopProviderYield";
import { SnapshotOverview } from "@/components/admin/SnapshotOverview";
import { ProviderPoolGrid } from "@/components/admin/ProviderPoolGrid";
import { ProviderKeyDrawer } from "@/components/admin/ProviderKeyDrawer";
import { ProviderPoolStatus } from "@/components/admin/ProviderPoolStatus";
import { HunterDashboardHeader } from "@/components/admin/HunterDashboardHeader";

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [password, setPassword] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set());
  const [revealedKeyValues, setRevealedKeyValues] = useState<
    Map<number, string>
  >(new Map());
  const [pendingKeyId, setPendingKeyId] = useState<number | null>(null);
  const [pendingDiagProvider, setPendingDiagProvider] = useState<string | null>(
    null
  );

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: data => {
      document.cookie = `app_session_id=${data.token}; Path=/; max-age=31536000; SameSite=Lax; ${window.location.protocol === "https:" ? "Secure" : ""}`;
      toast.success("SYSTEM ACCESS GRANTED");
      window.location.reload();
    },
    onError: err => {
      toast.error(`ACCESS DENIED: ${err.message}`);
    },
  });

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = trpc.hunter.getProviderStats.useQuery(undefined, {
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

  const {
    data: keys,
    isLoading: keysLoading,
    refetch: refetchKeys,
  } = trpc.hunter.getProviderKeys.useQuery(
    { provider: selectedProvider || "" },
    { enabled: isAuthenticated && user?.role === "admin" && !!selectedProvider }
  );

  const revealKeyMutation = trpc.hunter.revealKey.useMutation({
    onSuccess: ({ id, keyValue }) => {
      setRevealedKeyValues(previous => new Map(previous).set(id, keyValue));
      setRevealedKeys(previous => new Set(previous).add(id));
    },
    onError: error => toast.error(`Reveal failed: ${error.message}`),
  });

  const auditKeyCopyMutation = trpc.hunter.auditKeyCopy.useMutation({
    onError: error => toast.error(`Copy denied: ${error.message}`),
  });

  const hideKey = (keyId: number) => {
    setRevealedKeys(previous => {
      const next = new Set(previous);
      next.delete(keyId);
      return next;
    });
    setRevealedKeyValues(previous => {
      const next = new Map(previous);
      next.delete(keyId);
      return next;
    });
  };

  const toggleKeyReveal = (provider: string, keyId: number) => {
    if (revealedKeys.has(keyId)) {
      hideKey(keyId);
      return;
    }
    revealKeyMutation.mutate({ provider, keyId });
  };

  const copyRevealedKey = (provider: string, keyId: number) => {
    const keyValue = revealedKeyValues.get(keyId);
    if (!keyValue) {
      toast.error("Reveal the key before copying");
      return;
    }
    auditKeyCopyMutation.mutate(
      { provider, keyId },
      {
        onSuccess: async () => {
          await navigator.clipboard.writeText(keyValue);
          toast.success("Key copied to clipboard");
        },
      }
    );
  };
  const validateKeyMutation = trpc.hunter.validateKey.useMutation({
    onSuccess: () => {
      toast.success("Key validated successfully");
      refetchStats();
      refetchKeys();
      refetchSnapshot();
    },
    onError: error => {
      toast.error(`Validation failed: ${error.message}`);
    },
  });

  const validateAllMutation =
    trpc.hunter.validateAllKeysForProvider.useMutation({
      onSuccess: result => {
        toast.success(
          `Validation complete: ${result.valid} valid, ${result.invalid} invalid, ${result.rateLimited} rate-limited`
        );
        refetchStats();
        refetchKeys();
        refetchSnapshot();
      },
      onError: error => {
        toast.error(`Batch validation failed: ${error.message}`);
      },
    });

  const addKeyMutation = trpc.hunter.addKey.useMutation({
    onSuccess: () => {
      toast.success("Key added");
      refetchStats();
      refetchKeys();
      refetchSnapshot();
    },
    onError: error => {
      toast.error(`Failed to add key: ${error.message}`);
    },
  });

  const editKeyMutation = trpc.hunter.editKey.useMutation({
    onSuccess: () => {
      toast.success("Key updated");
      refetchKeys();
      refetchStats();
      refetchSnapshot();
    },
    onError: error => {
      toast.error(`Failed to update key: ${error.message}`);
    },
  });

  const addProviderMutation = trpc.hunter.addProvider.useMutation({
    onSuccess: () => {
      toast.success("Provider initialized successfully");
      refetchStats();
      refetchSnapshot();
    },
    onError: error => {
      toast.error(`Failed to initialize provider: ${error.message}`);
    },
  });

  const snapshotProviders = snapshot?.providers ?? [];

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative">
        <div className="glow-bloom" />
        <div className="glass-panel p-10 max-w-md w-full text-center relative z-10 border-[var(--c-cyan)]">
          <Lock className="h-12 w-12 text-[var(--c-cyan)] mx-auto mb-4" />
          <h1 className="hero-text text-[var(--c-cyan)] text-shadow-glow-cyan text-3xl">
            SYSTEM LOGIN
          </h1>
          <div className="divider my-4" />
          <p className="data-text data-cyan mb-6 tracking-widest text-sm">
            AUTHENTICATION REQUIRED
          </p>
          <div className="flex flex-col gap-4">
            <Input
              type="password"
              placeholder="ENTER VAULT KEY"
              className="glass-panel text-center text-xl tracking-[0.2em] font-mono data-text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e =>
                e.key === "Enter" && loginMutation.mutate({ password })
              }
            />
            <Button
              className="w-full bg-[var(--c-cyan)] text-black hover:bg-black hover:text-[var(--c-cyan)] hover:border-[var(--c-cyan)] border border-transparent transition-all duration-300 font-mono tracking-widest text-md h-12"
              onClick={() => loginMutation.mutate({ password })}
              disabled={loginMutation.isPending || !password}
            >
              {loginMutation.isPending ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                "ACCESS VAULT"
              )}
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
        <HunterDashboardHeader
          isRefreshing={snapshotLoading || statsLoading}
          isCreatingProvider={addProviderMutation.isPending}
          onRefresh={() => {
            refetchSnapshot();
            refetchStats();
            if (selectedProvider) refetchKeys();
          }}
          onCreateProvider={async provider => {
            try {
              await addProviderMutation.mutateAsync({ provider });
              return true;
            } catch {
              return false;
            }
          }}
        />
        <SnapshotOverview snapshot={snapshot} isLoading={snapshotLoading} />

        <TopProviderYield providers={snapshotProviders} />

        {statusData && (
          <ProviderPoolStatus
            status={statusData}
            contractVersion={snapshot?.contractVersion || "hunter.v1"}
            isAdding={addKeyMutation.isPending}
            onAddKey={async request => {
              try {
                await addKeyMutation.mutateAsync(request);
                return true;
              } catch {
                return false;
              }
            }}
          />
        )}
        <ProviderPoolGrid
          stats={stats}
          isLoading={statsLoading}
          selectedProvider={selectedProvider}
          pendingDiagnostic={pendingDiagProvider}
          onSelect={provider => {
            setRevealedKeys(new Set());
            setRevealedKeyValues(new Map());
            setSelectedProvider(previous =>
              previous === provider ? null : provider
            );
          }}
          onValidate={provider => {
            setPendingDiagProvider(provider);
            validateAllMutation.mutate(
              { provider },
              { onSettled: () => setPendingDiagProvider(null) }
            );
          }}
        />
        {selectedProvider && (
          <ProviderKeyDrawer
            provider={selectedProvider}
            keys={keys}
            isLoading={keysLoading}
            revealedKeyIds={revealedKeys}
            revealedValues={revealedKeyValues}
            pendingKeyId={pendingKeyId}
            isEditing={editKeyMutation.isPending}
            onClose={() => {
              setSelectedProvider(null);
              setRevealedKeys(new Set());
              setRevealedKeyValues(new Map());
            }}
            onReveal={keyId => toggleKeyReveal(selectedProvider, keyId)}
            onCopy={keyId => copyRevealedKey(selectedProvider, keyId)}
            onEdit={request =>
              editKeyMutation.mutate({
                ...request,
                provider: selectedProvider,
              })
            }
            onValidate={keyId => {
              setPendingKeyId(keyId);
              validateKeyMutation.mutate(
                { provider: selectedProvider, keyId },
                { onSettled: () => setPendingKeyId(null) }
              );
            }}
          />
        )}
      </div>
    </div>
  );
}