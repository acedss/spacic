import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";

export const ProblemScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cards = [
    { i: 0, title: "Spotify · Apple Music", body: "Solo listening. Headphones, no shared experience.", color: theme.accent3 },
    { i: 1, title: "Discord · Twitch",      body: "Live audio rooms — but not designed for music.",      color: theme.accent2 },
    { i: 2, title: "Stream royalties",      body: "Creators wait months to get paid.",                   color: theme.accent4 },
  ];

  const headIn = spring({ frame: f, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ background: theme.bg, color: "#fff", padding: 90, justifyContent: "center" }}>
      <div style={{ transform: `translateY(${(1 - headIn) * 30}px)`, opacity: headIn }}>
        <div style={{ fontSize: 16, color: theme.accent1, letterSpacing: 6, fontWeight: 700, textTransform: "uppercase" }}>
          Why Spacic exists
        </div>
        <h1 style={{ margin: "14px 0 0", fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>
          Music apps today miss <span style={{ color: theme.accent1 }}>three</span> things.
        </h1>
      </div>

      <div style={{ display: "flex", gap: 28, marginTop: 60 }}>
        {cards.map((c) => {
          const start = 18 + c.i * 14;
          const a = spring({ frame: f - start, fps, config: { damping: 12 } });
          return (
            <div key={c.i} style={{
              flex: 1,
              background: theme.cardDark,
              borderRadius: 22,
              border: `1px solid ${theme.borderDark}`,
              padding: 36,
              transform: `translateY(${(1 - a) * 60}px)`,
              opacity: a,
            }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: c.color, marginBottom: 24 }} />
              <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>{c.title}</div>
              <div style={{ fontSize: 22, color: "#A8B0BD", lineHeight: 1.5 }}>{c.body}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 60,
        opacity: interpolate(f, [180, 230], [0, 1], { extrapolateRight: "clamp" }),
        transform: `translateY(${interpolate(f, [180, 230], [30, 0], { extrapolateRight: "clamp" })}px)`,
        background: theme.gradWarm,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        fontSize: 56,
        fontWeight: 800,
        letterSpacing: -1.4,
      }}>
        What if a music room was as easy to host as Twitch — and as in-sync as Spotify Connect?
      </div>
    </AbsoluteFill>
  );
};
