import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme, fonts } from "../theme";
import { SpacicLogo } from "../components/Phone";

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoIn = spring({ frame, fps, config: { damping: 14 } });
  const titleIn = spring({ frame: frame - 12, fps, config: { damping: 14 } });
  const subIn   = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: "clamp" });
  const dotsIn  = interpolate(frame, [55, 110], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: theme.gradHero, color: "#fff", justifyContent: "center", alignItems: "center" }}>
      <div style={{
        transform: `scale(${logoIn})`,
        marginBottom: 40,
        filter: "drop-shadow(0 16px 40px rgba(243,111,58,0.45))",
      }}>
        <SpacicLogo size={180} />
      </div>

      <h1 style={{
        opacity: titleIn,
        transform: `translateY(${(1 - titleIn) * 30}px)`,
        margin: 0,
        fontSize: 110,
        fontWeight: 800,
        letterSpacing: -3,
        background: theme.gradWarm,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      }}>
        Spacic
      </h1>

      <p style={{
        opacity: subIn,
        margin: "16px 0 0",
        fontSize: 32,
        color: "#D7DBE3",
        letterSpacing: -0.3,
        fontWeight: 500,
      }}>
        Listen together. In real time.
      </p>

      <div style={{
        opacity: dotsIn,
        marginTop: 38,
        fontSize: 16,
        color: "#9CA3AF",
        letterSpacing: 4,
        textTransform: "uppercase",
      }}>
        FYP demo · A 9-minute walk-through
      </div>
    </AbsoluteFill>
  );
};
