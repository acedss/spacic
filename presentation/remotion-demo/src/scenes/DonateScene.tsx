import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, Caption } from "../components/Phone";

export const DonateScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  const goal = 5000;
  const baseRaised = 3680;
  const tipAmount = 100;
  const raised = f > 230 ? baseRaised + tipAmount : baseRaised;
  const pct = Math.min(100, (raised / goal) * 100);
  const balance = f > 230 ? 1150 : 1250;

  // tip rain emojis after donation lands
  const showRain = f > 240 && f < 360;
  const showGoalToast = f > 260 && f < 360;

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 40}px)`, opacity: slide, position: "relative" }}>
        <BrowserChrome url="spacic.app/rooms/r1">
          <div style={{ display: "flex", height: "100%", background: "#0F0F12", color: "#fff", padding: 24, gap: 20 }}>
            {/* main */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: 4, color: "#F36F3A" }}>● LIVE</div>
                <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>Late-Night Lo-Fi Lounge</div>
              </div>

              {/* stream goal */}
              <div style={{ padding: 22, background: "#161922", borderRadius: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, color: "#9CA3AF", letterSpacing: 2 }}>STREAM GOAL · TONIGHT</div>
                  <div style={{ fontSize: 12, color: theme.accent1, fontWeight: 700 }}>"Album mix-down"</div>
                </div>
                <div style={{ marginTop: 14, height: 28, borderRadius: 14, background: "#252A33", overflow: "hidden", position: "relative" }}>
                  <div style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: theme.gradWarm,
                    transition: "width 0.6s",
                  }} />
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                  }}>{raised.toLocaleString()} / {goal.toLocaleString()} coins</div>
                </div>
                <div style={{ marginTop: 10, color: "#9CA3AF", fontSize: 12 }}>
                  76% to goal · room:goal_updated broadcast on every tip
                </div>
              </div>

              {/* tip box */}
              <div style={{ padding: 22, background: "#161922", borderRadius: 14 }}>
                <div style={{ fontSize: 13, color: "#9CA3AF", letterSpacing: 2 }}>TIP THE CREATOR</div>
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  {[10, 50, 100, 500].map((v) => (
                    <button key={v} style={{
                      flex: 1, padding: "16px 0",
                      borderRadius: 12,
                      background: v === 100 ? theme.accent1 : "#252A33",
                      color: "#fff",
                      border: v === 100 ? "none" : `1px solid ${theme.borderDark}`,
                      fontWeight: 700, fontSize: 16,
                    }}>{v} 💰</button>
                  ))}
                </div>

                {/* hold-to-tip animation */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 6 }}>Hold to tip 100 coins · room:tip_holding broadcasts coin rain</div>
                  <div style={{ height: 12, background: "#252A33", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${interpolate(f, [120, 230], [0, 100], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })}%`,
                      background: theme.accent1,
                    }} />
                  </div>
                </div>
              </div>

              {/* coin rain */}
              {showRain && Array.from({ length: 16 }).map((_, i) => {
                const start = 240 + i * 4;
                const yOff = interpolate(f, [start, start + 60], [0, 380], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
                const op = interpolate(f, [start, start + 20, start + 60], [0, 1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
                return (
                  <div key={i} style={{
                    position: "absolute", left: 80 + (i * 38) % 760, top: 90,
                    fontSize: 30,
                    transform: `translateY(${yOff}px)`,
                    opacity: op,
                  }}>💰</div>
                );
              })}
            </div>

            {/* sidebar — wallet + idempotency */}
            <div style={{ width: 380, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#161922", borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 12, color: "#9CA3AF", letterSpacing: 2 }}>YOUR WALLET</div>
                <div style={{ marginTop: 10, fontSize: 36, fontWeight: 800, color: theme.accent1 }}>
                  {balance.toLocaleString()} <span style={{ fontSize: 16, color: "#9CA3AF", fontWeight: 500 }}>coins</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: theme.ok }}>
                  {f > 230 ? "wallet:balance_updated · −100 coins" : "Tap an amount → ws room:donate"}
                </div>
              </div>

              {/* Idempotency trace */}
              <div style={{ background: "#0B0B0F", borderRadius: 14, padding: 18, fontFamily: "ui-monospace,monospace", border: "1px solid #1F2533" }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", letterSpacing: 2, marginBottom: 10 }}>3-LAYER IDEMPOTENCY (server)</div>
                {[
                  { t: 232, m: "Layer 1 · idempotency middleware\n   key=tip_dh_xz7…  HIT? no → wrap res.json", c: theme.accent3 },
                  { t: 244, m: "Layer 2 · once(scope='donate', 60s)\n   SET-NX-EX → first caller, continue", c: theme.accent5 },
                  { t: 256, m: "Layer 3 · withIdempotency()\n   Mongo IdempotencyKey {key, scope}\n   placeholder + withTransaction(fn)", c: theme.ok },
                  { t: 280, m: "✓ Wallet −100, Goal +100 (atomic)", c: theme.accent1 },
                ].map((line, i) => {
                  if (f < line.t) return null;
                  const a = interpolate(f, [line.t, line.t + 12], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
                  return (
                    <div key={i} style={{
                      fontSize: 11.5, color: line.c,
                      whiteSpace: "pre-wrap",
                      opacity: a, transform: `translateY(${(1 - a) * 4}px)`,
                      padding: "5px 0", borderBottom: i < 3 ? "1px solid #1F2533" : "none",
                    }}>{line.m}</div>
                  );
                })}
              </div>
            </div>

            {/* goal reached toast */}
            {showGoalToast && (
              <div style={{
                position: "absolute",
                top: 30, left: "50%", transform: "translateX(-50%)",
                padding: "12px 22px",
                background: theme.gradWarm,
                borderRadius: 999,
                fontWeight: 700,
                color: "#fff",
                boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
              }}>
                💰 You tipped 100 coins to Aki — thanks for the support!
              </div>
            )}
          </div>
        </BrowserChrome>
      </div>

      <Caption
        title="Tip the creator — coin rain, atomic ledger update"
        subtitle="ws room:donate · walletService.donateToRoom inside session.withTransaction · 3-layer idempotency"
      />
    </AbsoluteFill>
  );
};
