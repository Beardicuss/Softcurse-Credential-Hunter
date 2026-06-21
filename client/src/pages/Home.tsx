import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import logo from "@/assets/home_logo.webp";

export default function Home() {
  const { data: statusData, isLoading, isError } = trpc.hunter.getStatus.useQuery();

  return (
    <div className="min-h-screen flex flex-col relative items-center justify-center p-6">
      <div className="glow-orb-cyan" />
      <div className="glow-orb-red" />
      <div className="noise-grid" />

      <main className="glass-panel p-10 max-w-2xl w-full text-center relative z-10">
        {/* Brand mark */}
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 grid place-items-center"
            style={{
              border: "1px solid rgba(79, 255, 240, 0.3)",
              borderRadius: "14px",
              boxShadow: "var(--shadow-cyan)",
            }}
          >
            <img
              src={logo}
              alt="Softcurse Systems"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        <h1
          className="hero-text mb-2"
          style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", lineHeight: 1.02 }}
        >
          SOFTCURSE SYSTEMS
        </h1>

        <div className="kicker mb-2">CREDENTIAL HUNTER VAULT</div>
        <div className="divider" />

        <div className="flex flex-col gap-5 text-left mb-10 px-2 relative z-10">
          <div
            className="flex justify-between items-center pb-3"
            style={{ borderBottom: "1px solid var(--c-border)" }}
          >
            <span className="data-text text-sm tracking-widest uppercase" style={{ color: "var(--c-text-muted)" }}>
              Network Status
            </span>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--c-cyan)" }} />
            ) : (
              <span className="data-text font-bold" style={{ color: "var(--c-cyan)" }}>
                {isError ? "OFFLINE" : "OPERATIONAL"}
              </span>
            )}
          </div>

          <div
            className="flex justify-between items-center pb-3"
            style={{ borderBottom: "1px solid var(--c-border)" }}
          >
            <span className="data-text text-sm tracking-widest uppercase" style={{ color: "var(--c-text-muted)" }}>
              Valid Key Pool
            </span>
            <span
              className="data-text font-bold"
              style={{ color: "var(--c-red)", animation: "pulse-red 3s infinite" }}
            >
              {statusData ? `${statusData.validKeys} KEYS` : "OFFLINE"}
            </span>
          </div>
        </div>

        <Link href="/admin/keys">
          <button
            className="w-full font-mono tracking-widest uppercase transition-all duration-300 cursor-pointer relative z-10"
            style={{
              padding: "14px 24px",
              background: "linear-gradient(135deg, rgba(79,255,240,0.15), rgba(255,95,95,0.08))",
              border: "1px solid rgba(79, 255, 240, 0.34)",
              borderRadius: "12px",
              color: "var(--c-text)",
              fontSize: "0.9rem",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--shadow-cyan)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
              (e.currentTarget as HTMLButtonElement).style.transform = "none";
            }}
          >
            ACCESS ADMIN CORE
          </button>
        </Link>
      </main>
    </div>
  );
}
