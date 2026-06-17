import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Loader2, Activity, Link as LinkIcon, ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────

function tryParseJson(raw: string | null | undefined): Record<string, unknown> | null {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

// ── detail panel ─────────────────────────────────────────────────────────────

type Tab = "all" | "valid" | "invalid";

/**
 * Renders a provider breakdown table.
 * `providers`  – map of provider name → count
 * `keys`       – optional list of key identifiers belonging to this tab
 */
function ProviderTable({
    providers,
    keys,
    accentColor,
}: {
    providers: Record<string, number>;
    keys?: string[];
    accentColor: string;
}) {
    const entries = Object.entries(providers);
    if (entries.length === 0)
        return <p className="font-mono text-xs text-[var(--c-cyan-dim)] py-4">No entries.</p>;

    return (
        <table className="w-full text-xs font-mono mt-2">
            <thead>
                <tr className="border-b border-[#1a1a2e]">
                    <th className="text-left py-1 text-[var(--c-cyan-dim)] uppercase tracking-widest font-normal">Provider</th>
                    <th className="text-right py-1 text-[var(--c-cyan-dim)] uppercase tracking-widest font-normal">Count</th>
                    <th className="text-right py-1 text-[var(--c-cyan-dim)] uppercase tracking-widest font-normal">Share</th>
                </tr>
            </thead>
            <tbody>
                {entries
                    .sort(([, a], [, b]) => b - a)
                    .map(([name, count]) => {
                        const total = entries.reduce((s, [, v]) => s + v, 0);
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                            <tr key={name} className="border-b border-[#0d0d14] hover:bg-[#050810]">
                                <td className="py-2" style={{ color: accentColor }}>{name}</td>
                                <td className="py-2 text-right text-[var(--c-text)]">{count}</td>
                                <td className="py-2 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <div className="w-20 h-1 bg-[#1a1a2e] rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{ width: `${pct}%`, backgroundColor: accentColor }}
                                            />
                                        </div>
                                        <span className="text-[var(--c-cyan-dim)] w-8 text-right">{pct}%</span>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
            </tbody>
        </table>
    );
}

/** List of individual key IDs (validKeys / invalidKeys arrays) */
function KeyList({ keys, accentColor }: { keys: string[]; accentColor: string }) {
    if (keys.length === 0)
        return <p className="font-mono text-xs text-[var(--c-cyan-dim)] py-4">No entries.</p>;
    return (
        <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
            {keys.map((k, i) => (
                <li
                    key={i}
                    className="font-mono text-xs py-1 px-2 border-l-2 truncate"
                    style={{ borderColor: accentColor, color: "var(--c-text)" }}
                >
                    {k}
                </li>
            ))}
        </ul>
    );
}

function LogDetailPanel({ details }: { details: string | null | undefined }) {
    const [tab, setTab] = useState<Tab>("all");
    const parsed = tryParseJson(details);

    if (!parsed) {
        return (
            <div className="px-6 py-4 border-t border-[var(--c-border)] bg-[#02040a]">
                <p className="font-mono text-xs text-[var(--c-text)] break-all">{details || "—"}</p>
            </div>
        );
    }

    const imported = typeof parsed.imported === "number" ? parsed.imported : null;
    const valid    = typeof parsed.valid    === "number" ? parsed.valid    : null;
    const invalid  = typeof parsed.invalid  === "number" ? parsed.invalid  : null;

    // Provider breakdown — top-level object keyed by provider name
    const providers = (
        parsed.providers && typeof parsed.providers === "object" && !Array.isArray(parsed.providers)
            ? parsed.providers as Record<string, number>
            : null
    );

    // Optional per-validity provider maps (e.g. validProviders / invalidProviders)
    const validProviders = (
        parsed.validProviders && typeof parsed.validProviders === "object" && !Array.isArray(parsed.validProviders)
            ? parsed.validProviders as Record<string, number>
            : null
    );
    const invalidProviders = (
        parsed.invalidProviders && typeof parsed.invalidProviders === "object" && !Array.isArray(parsed.invalidProviders)
            ? parsed.invalidProviders as Record<string, number>
            : null
    );

    // Optional key ID lists
    const validKeys   = Array.isArray(parsed.validKeys)   ? (parsed.validKeys   as string[]) : null;
    const invalidKeys = Array.isArray(parsed.invalidKeys) ? (parsed.invalidKeys as string[]) : null;

    const TABS: { id: Tab; label: string; count: number | null; color: string }[] = [
        { id: "all",     label: "ALL",     count: imported, color: "var(--c-orange)" },
        { id: "valid",   label: "VALID",   count: valid,    color: "#00ff88"         },
        { id: "invalid", label: "INVALID", count: invalid,  color: "var(--c-magenta)" },
    ];

    return (
        <div className="border-t border-[var(--c-border)] bg-[#02040a]">
            {/* Tab bar */}
            <div className="flex border-b border-[#1a1a2e]">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className="px-5 py-3 text-xs font-mono uppercase tracking-widest transition-colors duration-200 focus:outline-none"
                        style={{
                            color: tab === t.id ? t.color : "var(--c-cyan-dim)",
                            borderBottom: tab === t.id ? `2px solid ${t.color}` : "2px solid transparent",
                            background: tab === t.id ? "rgba(255,255,255,0.02)" : "transparent",
                        }}
                    >
                        {t.label}
                        {t.count !== null && (
                            <span
                                className="ml-2 px-1.5 py-0.5 rounded-sm text-[10px]"
                                style={{
                                    backgroundColor: tab === t.id ? t.color + "22" : "#1a1a2e",
                                    color: tab === t.id ? t.color : "var(--c-cyan-dim)",
                                }}
                            >
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="px-6 py-5">
                {tab === "all" && (
                    <div>
                        <p className="data-text text-[var(--c-cyan-dim)] uppercase tracking-widest text-[10px] mb-1">
                            Provider Breakdown
                        </p>
                        {providers
                            ? <ProviderTable providers={providers} accentColor="var(--c-orange)" />
                            : <p className="font-mono text-xs text-[var(--c-cyan-dim)] py-4">No provider data.</p>
                        }
                    </div>
                )}

                {tab === "valid" && (
                    <div>
                        <p className="data-text text-[10px] uppercase tracking-widest mb-1" style={{ color: "#00ff88" }}>
                            Valid Keys by Provider
                        </p>
                        {validProviders
                            ? <ProviderTable providers={validProviders} accentColor="#00ff88" />
                            : validKeys
                            ? <KeyList keys={validKeys} accentColor="#00ff88" />
                            : providers
                            ? (
                                <>
                                    <p className="font-mono text-[10px] text-[var(--c-cyan-dim)] mb-3">
                                        No per-validity breakdown available — showing total provider distribution.
                                    </p>
                                    <ProviderTable providers={providers} accentColor="#00ff88" />
                                </>
                            )
                            : <p className="font-mono text-xs text-[var(--c-cyan-dim)] py-4">No valid key data.</p>
                        }
                    </div>
                )}

                {tab === "invalid" && (
                    <div>
                        <p className="data-text text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--c-magenta)" }}>
                            Invalid Keys by Provider
                        </p>
                        {invalidProviders
                            ? <ProviderTable providers={invalidProviders} accentColor="var(--c-magenta)" />
                            : invalidKeys
                            ? <KeyList keys={invalidKeys} accentColor="var(--c-magenta)" />
                            : providers
                            ? (
                                <>
                                    <p className="font-mono text-[10px] text-[var(--c-cyan-dim)] mb-3">
                                        No per-validity breakdown available — showing total provider distribution.
                                    </p>
                                    <ProviderTable providers={providers} accentColor="var(--c-magenta)" />
                                </>
                            )
                            : <p className="font-mono text-xs text-[var(--c-cyan-dim)] py-4">No invalid key data.</p>
                        }
                    </div>
                )}
            </div>
        </div>
    );
}

// ── log row ───────────────────────────────────────────────────────────────────

interface LogEntry {
    id: string | number;
    createdAt: string | Date;
    eventType: string;
    provider?: string | null;
    details?: string | null;
}

function LogRow({ log }: { log: LogEntry }) {
    const [open, setOpen] = useState(false);
    const parsed = tryParseJson(log.details);

    // Build a short preview string
    let preview = "—";
    if (parsed) {
        const parts: string[] = [];
        if (typeof parsed.imported === "number") parts.push(`imported: ${parsed.imported}`);
        if (typeof parsed.valid === "number") parts.push(`valid: ${parsed.valid}`);
        if (typeof parsed.invalid === "number") parts.push(`invalid: ${parsed.invalid}`);
        preview = parts.length ? parts.join(" · ") : "view details";
    } else if (log.details) {
        preview = log.details.length > 60 ? log.details.slice(0, 60) + "…" : log.details;
    }

    return (
        <div className="border-b border-[#111] hover:bg-[#030508] transition-colors duration-200">
            {/* Main row */}
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full grid grid-cols-12 gap-4 py-3 px-0 data-text text-sm text-left cursor-pointer focus:outline-none group"
                aria-expanded={open}
            >
                {/* Timestamp */}
                <div className="col-span-3 text-[var(--c-cyan-dim)] flex items-center gap-2">
                    <span className="text-[var(--c-cyan-dim)] group-hover:text-[var(--c-cyan)] transition-colors">
                        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </span>
                    {new Date(log.createdAt).toLocaleString()}
                </div>

                {/* Event type */}
                <div className="col-span-3 text-[var(--c-magenta)] uppercase tracking-widest font-bold text-xs flex items-center">
                    [{log.eventType}]
                </div>

                {/* Provider */}
                <div className="col-span-2 text-[var(--c-orange)] uppercase flex items-center">
                    {log.provider || "—"}
                </div>

                {/* Preview */}
                <div className="col-span-4 font-mono text-[var(--c-text)] truncate flex items-center">
                    {preview}
                </div>
            </button>

            {/* Expanded detail panel */}
            {open && <LogDetailPanel details={log.details} />}
        </div>
    );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function AuditLogs() {
    const { user, isAuthenticated } = useAuth();
    const { data: logs, isLoading } = trpc.chessAI.getAuditLogs.useQuery(undefined, {
        enabled: isAuthenticated && user?.role === "admin",
    });

    if (!isAuthenticated || user?.role !== "admin") {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 relative">
                <div className="glow-bloom" />
                <div className="glass-panel p-10 max-w-md w-full text-center relative z-10 border-[var(--c-magenta)]">
                    <h1 className="hero-text text-[var(--c-magenta)] text-shadow-glow-magenta">ACCESS DENIED</h1>
                    <div className="divider" />
                    <p className="data-text data-magenta mb-4">RESTRICTED: SYS_ADMIN_ONLY</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 relative">
            <div className="glow-bloom" />
            <div className="max-w-6xl mx-auto space-y-8 relative z-10">

                {/* Header */}
                <div className="glass-panel p-6 flex justify-between items-center">
                    <div>
                        <h1 className="hero-text text-4xl mb-2 flex items-center gap-3">
                            <span className="decorator"></span>AUDIT LOGS <Activity className="data-cyan" size={32} />
                        </h1>
                        <p className="data-text font-mono text-[var(--c-cyan-dim)] text-sm tracking-widest uppercase">
                            SYSTEM-WIDE TELEMETRY AND METRICS
                        </p>
                    </div>
                    <Link href="/admin/keys">
                        <a className="data-text text-[var(--c-cyan)] border border-[var(--c-cyan)] px-4 py-2 hover:bg-[var(--c-cyan)] hover:text-black transition-colors duration-300 uppercase tracking-widest text-xs flex items-center gap-2">
                            <LinkIcon size={14} /> SYSTEM DASHBOARD
                        </a>
                    </Link>
                </div>

                {/* Log table */}
                <div className="glass-panel p-6">
                    <h2 className="data-text data-cyan mb-4 tracking-widest uppercase border-b border-[var(--c-border)] pb-2 flex justify-between items-center">
                        <span><span className="decorator"></span>CHRONOLOGICAL ACTIVITY TRACE</span>
                        <span className="text-[var(--c-cyan-dim)] text-xs normal-case font-normal tracking-normal">
                            Click a row to expand details
                        </span>
                    </h2>

                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-4 pb-2 mb-1 border-b border-[#1a1a2e] data-text text-[10px] text-[var(--c-cyan-dim)] uppercase tracking-widest">
                        <div className="col-span-3 pl-5">Timestamp</div>
                        <div className="col-span-3">Event</div>
                        <div className="col-span-2">Provider</div>
                        <div className="col-span-4">Summary</div>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-[var(--c-cyan)] w-8 h-8" />
                        </div>
                    ) : (
                        <div>
                            {logs?.map((log) => (
                                <LogRow key={log.id} log={log} />
                            ))}
                            {logs?.length === 0 && (
                                <div className="py-8 text-center data-text text-[var(--c-cyan-dim)]">
                                    NO TELEMETRY RECORDED YET.
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
