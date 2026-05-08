import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme, fonts } from "../theme";
import { SpacicLogo } from "../components/Phone";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeIn = spring({ frame, fps, config: { damping: 14 } });
  const sub    = interpolate(frame, [25, 60], [0, 1], { extrapolateRight: "clamp" });
  const credit = interpolate(frame, [80, 130], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: theme.gradHero, color: "#fff", justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${fadeIn})`, marginBottom: 32 }}>
        <SpacicLogo size={140} />
      </div>
      <h1 style={{
        opacity: fadeIn, margin: 0, fontSize: 96, fontWeight: 800, letterSpacing: -2,
      }}>
        Thank you.
      </h1>
      <p style={{ opacity: sub, marginTop: 18, fontSize: 28, color: "#CBD5E1" }}>
        Pham Duc Hau · BSc Business Computing · COMP1682 FYP
      </p>
      <div style={{ opacity: credit, marginTop: 60, fontSize: 18, color: "#7B8493", letterSpacing: 4 }}>
        Built with React · Express · FastAPI · Stripe · Mongo · Redis
      </div>
    </AbsoluteFill>
  );
};
