import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, SpacicLogo, Cursor, Caption } from "../components/Phone";

export const SignInScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  // Cursor moves to "Sign in" then to the sign-in button
  const cx = interpolate(f, [50, 130, 220, 380], [1500, 980, 980, 980], { extrapolateRight: "clamp" });
  const cy = interpolate(f, [50, 130, 220, 380], [820, 580, 760, 760], { extrapolateRight: "clamp" });

  // Email field gets a "typed" effect
  const emailLen = Math.max(0, Math.min(20, Math.floor((f - 200) / 3)));
  const email = "duchau@spacic.app".slice(0, emailLen);

  const dialogOut = interpolate(f, [560, 600], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 60}px)`, opacity: slide }}>
        <BrowserChrome url="spacic.app">
          <div style={{ display: "flex", height: "100%", background: "#FFFFFF" }}>
            {/* left hero */}
            <div style={{
              width: "55%",
              background: theme.gradHero,
              padding: 60,
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <SpacicLogo size={48} />
                <div style={{ fontSize: 28, fontWeight: 800 }}>Spacic</div>
              </div>
              <div>
                <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05 }}>
                  Listen<br/>together.<br/>In real time.
                </div>
                <div style={{ marginTop: 24, fontSize: 20, color: "#CBD5E1", maxWidth: 480, lineHeight: 1.5 }}>
                  Drop into a live room, tip the creator, vote the next song. All synchronised to within half a second.
                </div>
              </div>
              <div style={{ fontSize: 14, color: "#7B8493", letterSpacing: 4 }}>FYP DEMO · LISTENER & CREATOR</div>
            </div>

            {/* right form */}
            <div style={{ flex: 1, padding: "80px 70px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: theme.fg, letterSpacing: -1 }}>Sign in to Spacic</div>
              <div style={{ marginTop: 12, color: theme.muted, fontSize: 16 }}>
                Identity managed by Clerk · OAuth + magic link
              </div>

              <button style={{
                marginTop: 36,
                padding: "14px 18px",
                borderRadius: 12,
                border: `1px solid ${theme.border}`,
                background: "#FFFFFF",
                color: theme.fg,
                fontSize: 16,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}>
                <span style={{ width: 22, height: 22, background: "#FFFFFF", borderRadius: 4, border: "1px solid #E5E7EB", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>G</span>
                Continue with Google
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "28px 0", color: theme.muted, fontSize: 12 }}>
                <div style={{ flex: 1, height: 1, background: theme.border }} /> OR <div style={{ flex: 1, height: 1, background: theme.border }} />
              </div>

              <label style={{ fontSize: 13, fontWeight: 600, color: theme.fg }}>Email address</label>
              <div style={{
                marginTop: 8,
                padding: "12px 14px",
                border: `1px solid ${theme.border}`,
                borderRadius: 10,
                background: "#FFFFFF",
                fontSize: 16,
                color: theme.fg,
                minHeight: 24,
              }}>
                {email}
                {f > 200 && f < 280 && f % 30 < 15 && <span style={{ borderLeft: `2px solid ${theme.fg}`, marginLeft: 1, height: 18 }} />}
              </div>

              <button style={{
                marginTop: 18,
                padding: "14px 18px",
                borderRadius: 12,
                border: "none",
                background: f > 360 ? theme.fg : "#1F2937",
                color: "#fff",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
                transform: f > 360 && f < 380 ? `scale(0.98)` : "scale(1)",
              }}>
                Continue with email →
              </button>

              <div style={{ marginTop: 20, color: theme.muted, fontSize: 13 }}>
                By continuing, you agree to our Terms · A magic link will be emailed to you.
              </div>
            </div>
          </div>
          {/* Auth-callback flash */}
          {f > 540 && (
            <div style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255," + dialogOut + ")",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 18,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 28,
                border: `4px solid ${theme.accent1}`,
                borderTopColor: "transparent",
                animation: "spin 1s linear infinite",
              }} />
              <div style={{ color: theme.fg, fontSize: 22, fontWeight: 600 }}>Signing you in…</div>
              <div style={{ color: theme.muted, fontSize: 16 }}>POST /api/auth/callback · mirroring Clerk → MongoDB</div>
            </div>
          )}
        </BrowserChrome>
      </div>

      <Cursor x={cx} y={cy} tone="light" />

      <Caption
        title="Sign in with Clerk"
        subtitle="Email magic link or Google · /api/auth/callback then mirrors the user into MongoDB"
      />
    </AbsoluteFill>
  );
};
