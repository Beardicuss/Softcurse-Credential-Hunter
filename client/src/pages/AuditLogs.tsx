import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Loader2, Activity, Link as LinkIcon, ChevronDown, ChevronRight, AlertTriangle, Search, X } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────

function tryParseJson(raw: string | null | undefined): Record<string, unknown> | null {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

/** Consistent timestamp: "2026-06-17  15:42:03" — locale-independent, sortable */
function formatTs(raw: string | Date): string {
    const d = new Date(raw);
    const date = d.toISOString().slice(0, 10);
    const time = d.toISOString().slice(11, 19);
    return `${date}  ${time}`;
}

// ── sub-components ────────────────────────────────────────────────────────────

/** Provider breakdown table — total computed once, not per-row */
function ProviderTable({
    providers,
    accentColor,
}: {
    providers: Record<string, number>;
    accentColor: string;
}) {
    const entries = Object.entries(providers).sort(([, a], [, b]) => b - a);
    const total   = entries.reduce((s, [, v]) => s + v, 0);

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
                {entries.map(([name, count]) => {
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                        <tr key={name} className="border-b border-[#0d0d14] hover:bg-[#050810] transition-colors duration-150">
                            <td className="py-2" style={{ color: accentColor }}>{name}</td>
                            <td className="py-2 text-right text-[var(--c-text)]">{count}</td>
                            <td className="py-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <div className="w-20 h-1 bg-[#1a1a2e] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-300"
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

/** List of individual key IDs */
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

/** Legacy-log notice when per-validity data was never recorded */
function LegacyNotice({ accentColor }: { accentColor: string }) {
    return (
        <div className="flex items-start gap-3 py-5">
            <div className="w-0.5 h-10 rounded-full mt-0.5 shrink-0" style={{ backgroundColor: accentColor }} />
            <div>
                <p className="font-mono text-xs" style={{ color: accentColor }}>
                    Per-validity breakdown not recorded for this log entry.
                </p>
                <p className="font-mono text-[10px] text-[var(--c-cyan-dim)] mt-1">
                    This is a legacy log. Run a new refresh to generate split provider data.
                </p>
            </div>
        </div>
    );
}

/** Renders all parsed fields as a readable key/value grid for the ALL tab */
function PayloadGrid({ parsed }: { parsed: Record<string, unknown> }) {
    const skip = new Set(["providers", "validProviders", "invalidProviders", "validKeys", "invalidKeys"]);
    const scalar = Object.entries(parsed).filter(([k, v]) => !skip.has(k) && typeof v !== "object");
    const objects = Object.entries(parsed).filter(([k, v]) => !skip.has(k) && typeof v === "object" && v !== null);

    return (
        <div className="space-y-1 mt-2">
            {scalar.map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-3 font-mono text-xs py-0.5">
                    <span className="text-[var(--c-cyan-dim)] uppercase tracking-widest text-[10px] min-w-[100px]">{k}</span>
                    <span className="text-[var(--c-text)]">{String(v)}</span>
                </div>
            ))}
            {objects.map(([k, v]) => (
                <details key={k} className="mt-2 group">
                    <summary className="font-mono text-[10px] uppercase tracking-widest text-[var(--c-cyan-dim)] cursor-pointer hover:text-[var(--c-cyan)] list-none flex items-center gap-1 select-none">
                        <ChevronRight size={11} className="group-open:rotate-90 transition-transform duration-150" />
                        {k}
                    </summary>
                    <pre className="mt-1 ml-4 text-[10px] font-mono text-[var(--c-text)] bg-[#050810] border border-[#1a1a2e] rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(v, null, 2)}
                    </pre>
                </details>
            ))}
        </div>
    );
}

/** Sanity banner: warns when valid + invalid ≠ imported */
function BalanceCheck({
    imported,
    valid,
    invalid,
}: {
    imported: number | null;
    valid: number | null;
    invalid: number | null;
}) {
    if (imported === null || valid === null || invalid === null) return null;
    const sum = valid + invalid;
    const balanced = sum === imported;

    return (
        <div
            className="flex items-center gap-2 px-3 py-1.5 rounded font-mono text-[10px] mb-4 border"
            style={{
                backgroundColor: balanced ? "rgba(0,255,136,0.04)" : "rgba(255,160,0,0.07)",
                borderColor:     balanced ? "rgba(0,255,136,0.15)" : "rgba(255,160,0,0.25)",
                color:           balanced ? "#00ff88"              : "var(--c-orange)",
            }}
        >
            {!balanced && <AlertTriangle size={11} className="shrink-0" />}
            <span>
                imported&nbsp;<strong>{imported}</strong>
                &nbsp;=&nbsp;
                valid&nbsp;<strong style={{ color: "#00ff88" }}>{valid}</strong>
                &nbsp;+&nbsp;
                invalid&nbsp;<strong style={{ color: "var(--c-magenta)" }}>{invalid}</strong>
                {!balanced && (
                    <span className="ml-2 opacity-70">(Δ {Math.abs(imported - sum)} unaccounted — unknown validity or partial write)</span>
                )}
            </span>
        </div>
    );
}

// ── detail panel ─────────────────────────────────────────────────────────────

type Tab = "all" | "valid" | "invalid";

function LogDetailPanel({
    details,
    tab,
    setTab,
}: {
    details: string | null | undefined;
    tab: Tab;
    setTab: (t: Tab) => void;
}) {
    const parsed = tryParseJson(details);

    // ── non-JSON fallback ─────────────────────────────────────────────────────
    if (!parsed) {
        const isError = details && (details.toLowerCase().includes("error") || details.toLowerCase().includes("fail"));
        return (
            <div className="border-t border-[var(--c-border)] bg-[#02040a] px-6 py-5">
                <div className="flex items-start gap-3">
                    <div
                        className="w-0.5 self-stretch rounded-full shrink-0"
                        style={{ backgroundColor: isError ? "var(--c-magenta)" : "var(--c-cyan-dim)" }}
                    />
                    <div>
                        <p
                            className="font-mono text-[10px] uppercase tracking-widest mb-2"
                            style={{ color: isError ? "var(--c-magenta)" : "var(--c-cyan-dim)" }}
                        >
                            {isError ? "Error Detail" : "Raw Detail"}
                        </p>
                        <p className="font-mono text-xs text-[var(--c-text)] break-all leading-relaxed">
                            {details || "—"}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── parsed payload ────────────────────────────────────────────────────────
    const imported = typeof parsed.imported === "number" ? parsed.imported : null;
    const valid    = typeof parsed.valid    === "number" ? parsed.valid    : null;
    const invalid  = typeof parsed.invalid  === "number" ? parsed.invalid  : null;

    const providers = (
        parsed.providers && typeof parsed.providers === "object" && !Array.isArray(parsed.providers)
            ? parsed.providers as Record<string, number> : null
    );
    const validProviders = (
        parsed.validProviders && typeof parsed.validProviders === "object" && !Array.isArray(parsed.validProviders)
            ? parsed.validProviders as Record<string, number> : null
    );
    const invalidProviders = (
        parsed.invalidProviders && typeof parsed.invalidProviders === "object" && !Array.isArray(parsed.invalidProviders)
            ? parsed.invalidProviders as Record<string, number> : null
    );
    const validKeys   = Array.isArray(parsed.validKeys)   ? (parsed.validKeys   as string[]) : null;
    const invalidKeys = Array.isArray(parsed.invalidKeys) ? (parsed.invalidKeys as string[]) : null;

    const TABS: { id: Tab; label: string; count: number | null; color: string }[] = [
        { id: "all",     label: "ALL",     count: imported, color: "var(--c-orange)"  },
        { id: "valid",   label: "VALID",   count: valid,    color: "#00ff88"          },
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
                            color:        tab === t.id ? t.color : "var(--c-cyan-dim)",
                            borderBottom: tab === t.id ? `2px solid ${t.color}` : "2px solid transparent",
                            background:   tab === t.id ? "rgba(255,255,255,0.02)" : "transparent",
                        }}
                    >
                        {t.label}
                        {t.count !== null && (
                            <span
                                className="ml-2 px-1.5 py-0.5 rounded-sm text-[10px]"
                                style={{
                                    backgroundColor: tab === t.id ? t.color + "22" : "#1a1a2e",
                                    color:           tab === t.id ? t.color : "var(--c-cyan-dim)",
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
                <BalanceCheck imported={imported} valid={valid} invalid={invalid} />

                {tab === "all" && (
                    <div>
                        <p className="data-text text-[var(--c-cyan-dim)] uppercase tracking-widest text-[10px] mb-3">
                            Payload Fields
                        </p>
                        <PayloadGrid parsed={parsed} />
                        {providers && (
                            <div className="mt-5">
                                <p className="data-text text-[var(--c-cyan-dim)] uppercase tracking-widest text-[10px] mb-1">
                                    Provider Breakdown
                                </p>
                                <ProviderTable providers={providers} accentColor="var(--c-orange)" />
                            </div>
                        )}
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
                            : <LegacyNotice accentColor="#00ff88" />
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
                            : <LegacyNotice accentColor="var(--c-magenta)" />
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
    // Tab state lives here so it persists when the row is collapsed and reopened
    const [tab, setTab] = useState<Tab>("all");
    const parsed = tryParseJson(log.details);

    let preview = "—";
    if (parsed) {
        const parts: string[] = [];
        if (typeof parsed.imported === "number") parts.push(`imported: ${parsed.imported}`);
        if (typeof parsed.valid    === "number") parts.push(`valid: ${parsed.valid}`);
        if (typeof parsed.invalid  === "number") parts.push(`invalid: ${parsed.invalid}`);
        preview = parts.length ? parts.join(" · ") : "view details";
    } else if (log.details) {
        preview = log.details.length > 60 ? log.details.slice(0, 60) + "…" : log.details;
    }

    return (
        <div className="border-b border-[#111] hover:bg-[#030508] transition-colors duration-200">
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full grid grid-cols-12 gap-4 py-3 px-0 data-text text-sm text-left cursor-pointer focus:outline-none group"
                aria-expanded={open}
            >
                {/* Timestamp */}
                <div className="col-span-3 text-[var(--c-cyan-dim)] flex items-center gap-2 font-mono text-xs tabular-nums">
                    <span className="text-[var(--c-cyan-dim)] group-hover:text-[var(--c-cyan)] transition-colors shrink-0">
                        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </span>
                    {formatTs(log.createdAt)}
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

            {open && (
                <LogDetailPanel
                    details={log.details}
                    tab={tab}
                    setTab={setTab}
                />
            )}
        </div>
    );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function AuditLogs() {
    const { user, isAuthenticated } = useAuth();
    const { data: logs, isLoading } = trpc.chessAI.getAuditLogs.useQuery(undefined, {
        enabled: isAuthenticated && user?.role === "admin",
    });

    const [filterEvent, setFilterEvent] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Unique event types for filter chips
    const eventTypes = useMemo(() => {
        if (!logs) return [];
        return Array.from(new Set(logs.map((l) => l.eventType))).sort();
    }, [logs]);

    const filteredLogs = useMemo(() => {
        if (!logs) return [];
        return logs.filter((l) => {
            const matchesEvent = filterEvent === "all" || l.eventType === filterEvent;
            const q = searchQuery.trim().toLowerCase();
            const matchesSearch = !q
                || l.eventType.toLowerCase().includes(q)
                || (l.provider ?? "").toLowerCase().includes(q)
                || (l.details ?? "").toLowerCase().includes(q);
            return matchesEvent && matchesSearch;
        });
    }, [logs, filterEvent, searchQuery]);

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

                    {/* Filter bar */}
                    {!isLoading && logs && logs.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--c-cyan-dim)]" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search event, provider, details…"
                                    className="w-full bg-[#050810] border border-[#1a1a2e] rounded px-8 py-1.5 font-mono text-xs text-[var(--c-text)] placeholder-[var(--c-cyan-dim)] focus:outline-none focus:border-[var(--c-cyan)] transition-colors"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery("")}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--c-cyan-dim)] hover:text-[var(--c-text)]"
                                    >
                                        <X size={11} />
                                    </button>
                                )}
                            </div>

                            {/* Event type chips */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {["all", ...eventTypes].map((et) => (
                                    <button
                                        key={et}
                                        onClick={() => setFilterEvent(et)}
                                        className="font-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-sm border transition-colors duration-150"
                                        style={{
                                            borderColor:     filterEvent === et ? "var(--c-magenta)" : "#1a1a2e",
                                            color:           filterEvent === et ? "var(--c-magenta)" : "var(--c-cyan-dim)",
                                            backgroundColor: filterEvent === et ? "rgba(255,0,128,0.07)" : "transparent",
                                        }}
                                    >
                                        {et === "all" ? "All Events" : et.replace(/_/g, " ")}
                                    </button>
                                ))}
                            </div>

                            {/* Result count */}
                            {(filterEvent !== "all" || searchQuery) && (
                                <span className="font-mono text-[10px] text-[var(--c-cyan-dim)] ml-auto">
                                    {filteredLogs.length} / {logs.length} entries
                                </span>
                            )}
                        </div>
                    )}

                    {/* Column headers */}
                    <div className="grid grid-cols-12 gap-4 pb-2 mb-1 border-b border-[#1a1a2e] data-text text-[10px] text-[var(--c-cyan-dim)] uppercase tracking-widest">
                        <div className="col-span-3 pl-5">Timestamp (UTC)</div>
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
                            {filteredLogs.map((log) => (
                                <LogRow key={log.id} log={log} />
                            ))}
                            {filteredLogs.length === 0 && (
                                <div className="py-8 text-center data-text text-[var(--c-cyan-dim)]">
                                    {logs?.length === 0
                                        ? "NO TELEMETRY RECORDED YET."
                                        : "NO ENTRIES MATCH CURRENT FILTER."}
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
