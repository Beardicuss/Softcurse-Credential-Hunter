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

/** Render a single parsed-JSON detail value in a human-readable way */
function DetailValue({ value }: { value: unknown }) {
    if (Array.isArray(value)) {
        if (value.length === 0) return <span className="text-[var(--c-cyan-dim)]">—</span>;
        return (
            <ul className="mt-1 space-y-1 pl-2 border-l border-[var(--c-border)]">
                {value.map((item, i) => (
                    <li key={i} className="font-mono text-xs text-[var(--c-text)]">
                        {typeof item === "object" ? JSON.stringify(item) : String(item)}
                    </li>
                ))}
            </ul>
        );
    }
    if (typeof value === "object" && value !== null) {
        return (
            <pre className="text-xs font-mono text-[var(--c-text)] whitespace-pre-wrap break-all mt-1">
                {JSON.stringify(value, null, 2)}
            </pre>
        );
    }
    return <span className="font-mono text-[var(--c-text)]">{String(value)}</span>;
}

/** Key-value summary grid for the top stats (imported / valid / invalid / …) */
function StatsBadges({ data }: { data: Record<string, unknown> }) {
    const numericKeys = Object.entries(data).filter(([, v]) => typeof v === "number");
    if (numericKeys.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-2 mb-4">
            {numericKeys.map(([key, val]) => {
                let color = "var(--c-cyan)";
                if (key.toLowerCase().includes("invalid") || key.toLowerCase().includes("error")) color = "var(--c-magenta)";
                else if (key.toLowerCase().includes("valid") && !key.toLowerCase().includes("invalid")) color = "#00ff88";
                else if (key.toLowerCase().includes("import")) color = "var(--c-orange)";
                return (
                    <div
                        key={key}
                        className="px-3 py-1 border text-xs font-mono uppercase tracking-widest"
                        style={{ borderColor: color, color }}
                    >
                        {key}: <span className="font-bold">{String(val)}</span>
                    </div>
                );
            })}
        </div>
    );
}

// ── detail panel ─────────────────────────────────────────────────────────────

function LogDetailPanel({ details }: { details: string | null | undefined }) {
    const parsed = tryParseJson(details);

    if (!parsed) {
        return (
            <div className="px-6 py-4 border-t border-[var(--c-border)] bg-[#02040a]">
                <p className="font-mono text-xs text-[var(--c-text)] break-all">{details || "—"}</p>
            </div>
        );
    }

    // Separate numeric stats (shown as badges) from the rest
    const nonNumeric = Object.entries(parsed).filter(([, v]) => typeof v !== "number");

    return (
        <div className="px-6 py-5 border-t border-[var(--c-border)] bg-[#02040a] space-y-4">
            {/* Numeric summary badges */}
            <StatsBadges data={parsed} />

            {/* Remaining fields */}
            {nonNumeric.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    {nonNumeric.map(([key, val]) => (
                        <div key={key}>
                            <p className="data-text text-[var(--c-cyan-dim)] uppercase tracking-widest text-[10px] mb-0.5">
                                {key}
                            </p>
                            <DetailValue value={val} />
                        </div>
                    ))}
                </div>
            )}
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
