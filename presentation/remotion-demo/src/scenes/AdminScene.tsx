import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, Caption } from "../components/Phone";

const KPIS = [
  { lab: "ACTIVE USERS",        v: "1,284",  d: "+18%", color: theme.accent3 },
  { lab: "PAYING SUBS",         v: "318",    d: "+9%",  color: theme.accent1 },
  { lab: "MRR",                 v: "$2,840", d: "+12%", color: theme.ok },
  { lab: "TONIGHT'S ROOMS",     v: "47",     d: "live", color: theme.accent5 },
];

export const AdminScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  // animated bar values
  const bars = [0.32, 0.45, 0.61, 0.55, 0.78, 0.83, 0.74, 0.67, 0.81, 0.92, 0.88, 0.94, 1.00, 0.96];

  // grafana alert "fires"
  const alertFires = f > 360;

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 40}px)`, opacity: slide }}>
        <BrowserChrome url="spacic.app/admin">
          <div style={{ display: "flex", height: "100%", background: "#FAFBFC" }}>
            {/* sidebar */}
            <div style={{ width: 220, padding: 20, background: "#fff", borderRight: `1px solid ${theme.border}` }}>
              <div style={{ fontSize: 13, color: theme.muted, letterSpacing: 4, marginBottom: 12 }}>ADMIN</div>
              {[
                "Overview", "Analytics", "Songs catalogue", "Artists", "Albums",
                "Users", "Subscriptions", "Top-up packages", "RecSys", "Alerts", "Config",
              ].map((s, i) => (
                <div key={s} style={{
                  padding: "9px 12px", borderRadius: 8,
                  background: i === 0 ? "rgba(15,15,18,0.06)" : "transparent",
                  color: i === 0 ? theme.fg : theme.muted,
                  fontWeight: i === 0 ? 700 : 500,
                  fontSize: 13,
                }}>{s}</div>
              ))}
            </div>

            {/* main */}
            <div style={{ flex: 1, padding: "26px 32px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, color: theme.muted, letterSpacing: 4 }}>OPERATIONS · LAST 30 DAYS</div>
                  <h1 style={{ margin: "6px 0 0", fontSize: 36, fontWeight: 800, letterSpacing: -1.2, color: theme.fg }}>
                    Spacic admin
                  </h1>
                </div>
                <div style={{ padding: "8px 14px", background: "#fff", border: `1px solid ${theme.border}`, borderRadius: 999, color: theme.muted, fontSize: 13 }}>
                  Hourly · Daily · <b style={{ color: theme.fg }}>Weekly</b> · Monthly
                </div>
              </div>

              {/* KPIs */}
              <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                {KPIS.map((k, i) => (
                  <div key={k.lab} style={{ background: "#fff", borderRadius: 14, padding: 20, border: `1px solid ${theme.border}` }}>
                    <div style={{ fontSize: 11, color: theme.muted, letterSpacing: 2 }}>{k.lab}</div>
                    <div style={{ marginTop: 10, fontSize: 32, fontWeight: 800, color: theme.fg }}>{k.v}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: k.color, fontWeight: 700 }}>{k.d}</div>
                  </div>
                ))}
              </div>

              {/* charts row */}
              <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
                <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: `1px solid ${theme.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 12, color: theme.muted, letterSpacing: 2 }}>DAILY REVENUE</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: theme.fg, marginTop: 4 }}>$2,840 <span style={{ color: theme.ok, fontSize: 14 }}>+12%</span></div>
                    </div>
                    <div style={{ fontSize: 11, color: theme.muted }}>14d window · MongoDB rollup</div>
                  </div>
                  <div style={{ marginTop: 22, display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
                    {bars.map((h, i) => {
                      const grow = interpolate(f, [60 + i * 4, 100 + i * 4], [0, h], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
                      return (
                        <div key={i} style={{
                          flex: 1, height: `${grow * 100}%`,
                          background: i === bars.length - 2 ? theme.accent1 : theme.accent3,
                          borderRadius: 4,
                          minHeight: 6,
                        }} />
                      );
                    })}
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 14, padding: 22, border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: 12, color: theme.muted, letterSpacing: 2 }}>TIER MIX</div>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { lab: "Free",     pct: 62, color: theme.muted },
                      { lab: "Premium",  pct: 28, color: theme.accent3 },
                      { lab: "Creator",  pct: 10, color: theme.accent1 },
                    ].map((t, i) => (
                      <div key={t.lab}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: theme.fg, marginBottom: 4 }}>
                          <span>{t.lab}</span><span>{t.pct}%</span>
                        </div>
                        <div style={{ height: 8, background: "#F3F4F6", borderRadius: 4 }}>
                          <div style={{ height: "100%", width: `${t.pct}%`, background: t.color, borderRadius: 4 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 14, fontSize: 11, color: theme.muted }}>
                    GET /api/admin/analytics/growth
                  </div>
                </div>
              </div>

              {/* alerts row */}
              <div style={{ marginTop: 18, background: "#fff", borderRadius: 14, padding: 22, border: `1px solid ${theme.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: theme.muted, letterSpacing: 2 }}>GRAFANA ALERTS · INGESTED VIA WEBHOOK</div>
                  <div style={{ fontSize: 11, color: theme.muted }}>POST /api/admin/alerts/grafana-webhook · bearer token</div>
                </div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { name: "RecSys 5xx · /train",         sev: "warn",  fired: "11 min ago", st: "ack" },
                    { name: "MongoDB latency p95 > 800ms",  sev: "ok",    fired: "2h ago",      st: "resolved" },
                    { name: "Stripe webhook backlog",       sev: alertFires ? "fire" : "ok", fired: alertFires ? "just now" : "—", st: alertFires ? "firing" : "resolved" },
                  ].map((a, i) => {
                    const color = a.sev === "fire" ? theme.err : a.sev === "warn" ? theme.warn : theme.ok;
                    return (
                      <div key={i} style={{
                        padding: "12px 14px", borderRadius: 10,
                        background: a.sev === "fire" ? "rgba(239,68,68,0.08)" : a.sev === "warn" ? "rgba(245,158,11,0.08)" : "#F9FAFB",
                        border: a.sev === "fire" ? `1px solid ${theme.err}40` : `1px solid ${theme.border}`,
                        display: "flex", alignItems: "center", gap: 14,
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: theme.fg, fontSize: 14 }}>{a.name}</div>
                          <div style={{ color: theme.muted, fontSize: 12 }}>fired {a.fired} · status {a.st}</div>
                        </div>
                        <button style={{
                          padding: "6px 12px", background: "#fff", border: `1px solid ${theme.border}`,
                          borderRadius: 8, color: theme.fg, fontSize: 12, fontWeight: 600,
                        }}>{a.st === "firing" ? "Acknowledge" : "View"}</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </BrowserChrome>
      </div>

      <Caption
        title="Admin · KPIs, daily revenue, tier mix, Grafana alerts"
        subtitle="GET /api/admin/stats · /analytics · /analytics/growth · /alerts (Grafana → webhook → Mongo)"
      />
    </AbsoluteFill>
  );
};
