import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, Caption } from "../components/Phone";

const GENRES = ["Lo-Fi", "Ambient", "Indie", "Hip-Hop", "Jazz", "Electronic", "Pop", "Classical"];
const MOODS  = ["Late Night", "Focus", "Workout", "Chill", "Party", "Drive"];

export const OnboardingScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  // step indicator: 0=taste, 1=mood, 2=songs, 3=referral, 4=tuned
  const step =
    f < 130 ? 1 :
    f < 260 ? 2 :
    f < 380 ? 3 :
    f < 480 ? 4 :
              5;

  const totalSteps = 6;
  const progress = step / totalSteps;
  const progressBar = interpolate(f, [0, 1080], [progress, progress], { extrapolateRight: "clamp" });

  // Selections that grow over time
  const tasteSelected = new Set<string>();
  if (f > 30) tasteSelected.add("Lo-Fi");
  if (f > 60) tasteSelected.add("Ambient");
  if (f > 90) tasteSelected.add("Indie");

  const moodSelected = new Set<string>();
  if (f > 160) moodSelected.add("Late Night");
  if (f > 200) moodSelected.add("Focus");

  const likedSongs = new Set<string>();
  if (f > 290) likedSongs.add("a");
  if (f > 320) likedSongs.add("b");
  if (f > 350) likedSongs.add("c");

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 40}px)`, opacity: slide }}>
        <BrowserChrome url="spacic.app/onboarding" width={1500} height={870}>
          <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "44px 64px", background: "#FFFFFF" }}>
            {/* progress bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 14, color: theme.muted, fontWeight: 600 }}>Step {Math.min(step, 5)} of 6</div>
              <div style={{ flex: 1, height: 6, background: theme.border, borderRadius: 3 }}>
                <div style={{ height: 6, width: `${progressBar * 100}%`, background: theme.accent1, borderRadius: 3, transition: "width 0.4s" }} />
              </div>
            </div>

            {/* step content */}
            {step === 1 && (
              <div style={{ marginTop: 38 }}>
                <div style={{ fontSize: 14, color: theme.accent1, letterSpacing: 4, fontWeight: 700, textTransform: "uppercase" }}>Step 2 · Taste</div>
                <h1 style={{ margin: "10px 0 0", fontSize: 50, fontWeight: 800, letterSpacing: -1.4, color: theme.fg }}>
                  Pick the genres you love.
                </h1>
                <p style={{ marginTop: 10, color: theme.muted, fontSize: 18 }}>
                  We use these to seed your first room recommendations.
                </p>
                <div style={{ marginTop: 36, display: "flex", flexWrap: "wrap", gap: 14 }}>
                  {GENRES.map((g) => {
                    const sel = tasteSelected.has(g);
                    return (
                      <div key={g} style={{
                        padding: "16px 28px",
                        borderRadius: 999,
                        border: sel ? `2px solid ${theme.accent1}` : `1px solid ${theme.border}`,
                        background: sel ? "rgba(243,111,58,0.08)" : "#FFFFFF",
                        color: sel ? theme.accent1 : theme.fg,
                        fontSize: 22,
                        fontWeight: 600,
                      }}>
                        {sel && "✓ "}{g}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div style={{ marginTop: 38 }}>
                <div style={{ fontSize: 14, color: theme.accent2, letterSpacing: 4, fontWeight: 700, textTransform: "uppercase" }}>Step 3 · Mood</div>
                <h1 style={{ margin: "10px 0 0", fontSize: 50, fontWeight: 800, letterSpacing: -1.4, color: theme.fg }}>
                  When do you usually listen?
                </h1>
                <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
                  {MOODS.map((m, i) => {
                    const sel = moodSelected.has(m);
                    return (
                      <div key={m} style={{
                        padding: "30px 26px",
                        borderRadius: 16,
                        border: sel ? `2px solid ${theme.accent2}` : `1px solid ${theme.border}`,
                        background: sel ? "rgba(63,160,158,0.08)" : "#FFFFFF",
                        fontSize: 22, fontWeight: 700, color: theme.fg,
                      }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>{["🌙","🎯","💪","🌿","🎉","🚗"][i]}</div>
                        {sel && <span style={{ color: theme.accent2 }}>✓ </span>}{m}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 3 && (
              <div style={{ marginTop: 38 }}>
                <div style={{ fontSize: 14, color: theme.accent5, letterSpacing: 4, fontWeight: 700, textTransform: "uppercase" }}>Step 4 · Songs</div>
                <h1 style={{ margin: "10px 0 0", fontSize: 50, fontWeight: 800, letterSpacing: -1.4, color: theme.fg }}>
                  Like songs to teach the recommender.
                </h1>
                <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
                  {[["a","Floating Lanterns","Aki Sora",theme.accent1],
                    ["b","Tokyo Drive","Yuki Park",theme.accent3],
                    ["c","Soft Rain","Lo & Slow",theme.accent5],
                    ["d","Midnight Cab","Reverie",theme.accent4],
                    ["e","Indigo","SOLA",theme.accent2],
                    ["f","Velvet Lights","Theo Lemoine",theme.accent5],
                  ].map(([id, title, artist, color]) => {
                    const liked = likedSongs.has(id as string);
                    return (
                      <div key={id as string} style={{
                        padding: 18,
                        borderRadius: 14,
                        border: `1px solid ${theme.border}`,
                        display: "flex",
                        gap: 14,
                        alignItems: "center",
                      }}>
                        <div style={{
                          width: 60, height: 60, borderRadius: 10,
                          background: color as string,
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, color: theme.fg, fontSize: 16 }}>{title}</div>
                          <div style={{ color: theme.muted, fontSize: 13 }}>{artist}</div>
                        </div>
                        <div style={{
                          width: 36, height: 36, borderRadius: 18,
                          border: `1.5px solid ${liked ? theme.err : theme.border}`,
                          color: liked ? theme.err : theme.muted,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: liked ? "rgba(239,68,68,0.08)" : "#FFFFFF",
                          fontSize: 16,
                        }}>♥</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 4 && (
              <div style={{ marginTop: 38 }}>
                <div style={{ fontSize: 14, color: theme.accent4, letterSpacing: 4, fontWeight: 700, textTransform: "uppercase" }}>Step 5 · Referral</div>
                <h1 style={{ margin: "10px 0 0", fontSize: 50, fontWeight: 800, letterSpacing: -1.4, color: theme.fg }}>
                  A friend's name? They get 25 coins. So do you.
                </h1>
                <div style={{ marginTop: 36, padding: 22, border: `1px solid ${theme.border}`, borderRadius: 14, fontSize: 22, color: theme.fg }}>
                  {f > 410 ? "@minh.le" : ""}
                  {f > 380 && f < 460 && f % 30 < 15 && <span style={{ borderLeft: `2px solid ${theme.fg}`, marginLeft: 1, height: 20 }} />}
                </div>
                <div style={{ marginTop: 20, color: theme.muted, fontSize: 14 }}>POST /api/auth/onboarding/complete · grants 50 welcome coins</div>
              </div>
            )}

            {step === 5 && (
              <div style={{ marginTop: 60, textAlign: "center" }}>
                <div style={{ fontSize: 64 }}>🎉</div>
                <h1 style={{ marginTop: 14, fontSize: 56, fontWeight: 800, color: theme.fg, letterSpacing: -1.6 }}>
                  You're all tuned.
                </h1>
                <p style={{ marginTop: 14, fontSize: 22, color: theme.muted }}>
                  +50 coins on us · Discover is ready when you are
                </p>
              </div>
            )}

            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30 }}>
              <button style={{ padding: "12px 22px", borderRadius: 10, border: `1px solid ${theme.border}`, background: "#FFFFFF", color: theme.muted, fontSize: 14 }}>← Back</button>
              <button style={{
                padding: "12px 26px", borderRadius: 10, border: "none",
                background: theme.fg, color: "#fff", fontSize: 14, fontWeight: 700,
              }}>{step === 5 ? "Take me to Spacic →" : "Next →"}</button>
            </div>
          </div>
        </BrowserChrome>
      </div>

      <Caption
        title={[
          "Onboarding · taste preferences",
          "Onboarding · listening moods",
          "Onboarding · cold-start signal for the recsys",
          "Onboarding · referral bonus",
          "Onboarding · 50 welcome coins, ready to listen",
        ][Math.min(step - 1, 4)]}
        subtitle="POST /api/auth/onboarding/complete · grants welcome coins, mints referral bonus, exits to Home"
      />
    </AbsoluteFill>
  );
};
