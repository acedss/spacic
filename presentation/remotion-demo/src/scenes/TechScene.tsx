import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";

const PROBLEMS = [
  { i: 0, n: "01", title: "Real-time consistency",        body: "Server-authoritative state · sync_checkpoint every 5s · hard-correct drift > 500ms · 8s ENDING_COUNTDOWN_S grace.", color: theme.accent3 },
  { i: 1, n: "02", title: "Three-layer idempotency",      body: "HTTP middleware (Redis 24h) · once() (SET-NX-EX 60s) · withIdempotency() (Mongo, full-payload, 24h, E11000-safe).", color: theme.accent1 },
  { i: 2, n: "03", title: "RecSys cold-start waterfall",  body: "Tier 1 ALS cache → Tier 2 content tags → Tier 3 live popularity → Tier 4 all-time popularity. Discover never empty.", color: theme.accent5 },
];

export const TechScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headIn = spring({ frame: f, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ background: theme.bg, color: "#fff", padding: 90 }}>
      <div style={{ opacity: headIn, transform: `translateY(${(1 - headIn) * 20}px)` }}>
        <div style={{ fontSize: 16, color: theme.accent1, letterSpacing: 6, fontWeight: 700 }}>HARD PROBLEMS WE SOLVED</div>
        <h1 style={{ margin: "14px 0 0", fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>
          Three engineering chapters.
        </h1>
      </div>

      <div style={{ marginTop: 60, display: "flex", gap: 24 }}>
        {PROBLEMS.map((p) => {
          const a = spring({ frame: f - (24 + p.i * 14), fps, config: { damping: 12 } });
          return (
            <div key={p.n} style={{
              flex: 1,
              background: theme.cardDark, borderRadius: 22, padding: 36,
              border: `1px solid ${theme.borderDark}`,
              opacity: a,
              transform: `translateY(${(1 - a) * 50}px)`,
              position: "relative",
            }}>
              <div style={{
                position: "absolute", top: -16, left: 28,
                padding: "6px 12px", background: p.color, color: "#0F0F12",
                fontWeight: 800, fontSize: 12, letterSpacing: 2, borderRadius: 6,
              }}>HARD PROBLEM #{p.n}</div>
              <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, letterSpacing: -0.6 }}>{p.title}</div>
              <div style={{ marginTop: 14, fontSize: 18, lineHeight: 1.55, color: "#A8B0BD" }}>{p.body}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 60, fontSize: 22, color: "#9CA3AF", textAlign: "center", maxWidth: 1100, marginLeft: "auto", marginRight: "auto" }}>
        17 weeks · 4 services · 26 schemas · 134 Vitest assertions · MongoDB Atlas + Redis + S3 · Cloudflare Tunnel · Loki + Grafana
      </div>
    </AbsoluteFill>
  );
};
