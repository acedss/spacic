import { Composition } from "remotion";
import { Demo } from "./Demo";
import { TIMELINE, TOTAL_FRAMES, FPS, WIDTH, HEIGHT } from "./timeline";

export const Root: React.FC = () => {
  return (
    <Composition
      id="SpacicDemo"
      component={Demo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ timeline: TIMELINE }}
    />
  );
};
