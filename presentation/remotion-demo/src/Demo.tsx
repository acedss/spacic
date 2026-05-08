import { AbsoluteFill, Sequence } from "remotion";
import { TIMELINE, FPS } from "./timeline";
import { theme, fonts } from "./theme";

import { IntroScene }     from "./scenes/IntroScene";
import { ProblemScene }   from "./scenes/ProblemScene";
import { StackScene }     from "./scenes/StackScene";
import { SignInScene }    from "./scenes/SignInScene";
import { OnboardingScene }from "./scenes/OnboardingScene";
import { HomeScene }      from "./scenes/HomeScene";
import { DiscoverScene }  from "./scenes/DiscoverScene";
import { JoinRoomScene }  from "./scenes/JoinRoomScene";
import { SyncChatScene }  from "./scenes/SyncChatScene";
import { DonateScene }    from "./scenes/DonateScene";
import { NominateScene }  from "./scenes/NominateScene";
import { MinigameScene }  from "./scenes/MinigameScene";
import { StudioScene }    from "./scenes/StudioScene";
import { WalletScene }    from "./scenes/WalletScene";
import { AdminScene }     from "./scenes/AdminScene";
import { TechScene }      from "./scenes/TechScene";
import { OutroScene }     from "./scenes/OutroScene";

const SCENE: Record<string, React.FC> = {
  intro:      IntroScene,
  problem:    ProblemScene,
  stack:      StackScene,
  signin:     SignInScene,
  onboarding: OnboardingScene,
  home:       HomeScene,
  discover:   DiscoverScene,
  joinroom:   JoinRoomScene,
  syncchat:   SyncChatScene,
  donate:     DonateScene,
  nominate:   NominateScene,
  minigame:   MinigameScene,
  studio:     StudioScene,
  wallet:     WalletScene,
  admin:      AdminScene,
  tech:       TechScene,
  outro:      OutroScene,
};

export const Demo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: fonts.sans }}>
      {TIMELINE.map((s) => {
        const Cmp = SCENE[s.id];
        if (!Cmp) return null;
        return (
          <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames} name={s.label}>
            <Cmp />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
