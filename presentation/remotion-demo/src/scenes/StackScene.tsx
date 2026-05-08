import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";

const tiers = [
  { name: "Frontend", subs: ["React 19 + TS", "Vite", "Tailwind v4 + shadcn/ui", "Zustand × 8", "Socket.IO client"], color: theme.accent3 },
  { name: "Backend",  subs: ["Node + Express 5", "Mongoose", "ioredis + adapter", "Helmet · cors · rate-limit", "Clerk JWT · svix · Stripe"], color: theme.accent1 },
  { name: "RecSys",   subs: ["FastAPI + uvicorn", "Pydantic v2 · motor", "implicit (ALS)", "scipy · numpy", "apscheduler · mlflow"], color: theme.accent5 },
  { name: "DevOps",   subs: ["Docker Compose", "Jenkins · ESLint · Vitest", "Cloudflare Tunnel", "Atlas · S3 · Loki", "Grafana alerts"], color: theme.accent4 },
];

export const StackScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const headIn = spring({ frame: f, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ background: theme.bg, color: "#fff", padding: 90 }}>
      <div style={{ opacity: headIn, transform: `translateY(${(1 - headIn) * 20}px)` }}>
        <div style={{ fontSize: 16, color: theme.accent1, letterSpacing: 6, fontWeight: 700 }}>THE FULL STACK</div>
        <h1 style={{ margin: "14px 0 0", fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>
          Four services, every library has a job.
        </h1>
      </div>

      <div style={{ marginTop: 60, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
        {tiers.map((t, i) => {
          const a = spring({ frame: f - (24 + i * 12), fps, config: { damping: 12 } });
          return (
            <div key={t.name} style={{
              background: theme.cardDark,
              borderRadius: 20,
              padding: 28,
              border: `1px solid ${theme.borderDark}`,
              opacity: a,
              transform: `translateY(${(1 - a) * 40}px)`,
            }}>
              <div style={{
                display: "inline-block",
                padding: "6px 12px",
                borderRadius: 10,
                background: t.color,
                color: "#0F0F12",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 1,
              }}>{t.name.toUpperCase()}</div>
              <ul style={{ margin: "20px 0 0", padding: 0, listStyle: "none" }}>
                {t.subs.map((s, j) => {
                  const lf = f - (40 + i * 12 + j * 4);
                  const la = interpolate(lf, [0, 12], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
                  return (
                    <li key={j} style={{
                      padding: "10px 0",
                      borderBottom: j === t.subs.length - 1 ? "none" : `1px solid ${theme.borderDark}`,
                      fontSize: 18,
                      color: "#D1D5DB",
                      opacity: la,
                      transform: `translateX(${(1 - la) * 12}px)`,
                    }}>{s}</li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 60,
        textAlign: "center",
        fontSize: 22,
        color: "#9CA3AF",
        opacity: interpolate(f, [200, 250], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        4 containers · MongoDB Atlas · Redis · S3 · Stripe · Clerk · Loki + Grafana
      </div>
    </AbsoluteFill>
  );
};
