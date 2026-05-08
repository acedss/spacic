import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, Caption } from "../components/Phone";

const CHATS = [
  { t: 30,  who: "Minh",  c: theme.accent3, m: "this slaps 🔥",            sys: false },
  { t: 70,  who: "Linh",  c: theme.accent5, m: "third night in a row 😴", sys: false },
  { t: 130, who: "Sora",  c: theme.accent4, m: "what's the next song",   sys: false },
  { t: 200, who: "Aki",   c: theme.accent1, m: "playing one for the night people",  sys: false },
  { t: 270, who: "system",c: theme.muted,    m: "Sora reacted ♥ to Floating Lanterns", sys: true  },
  { t: 340, who: "you",   c: theme.accent2, m: "love this 🌙",             sys: false },
  { t: 420, who: "Niko",  c: theme.accent3, m: "drove past Tokyo to this song fr", sys: false },
  { t: 510, who: "system",c: theme.muted,    m: "🎉 38 listeners reacted",  sys: true  },
];

export const SyncChatScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  // Emoji burst at frame 380
  const burstActive = f > 380 && f < 480;
  const emojis = ["🌙","🔥","✨","♥","💜","🎵"];

  // sync drift indicator pulses
  const driftMs = Math.floor(60 + 80 * Math.sin(f / 12));
  const corrected = f % 150 < 5;

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 40}px)`, opacity: slide, position: "relative" }}>
        <BrowserChrome url="spacic.app/rooms/r1">
          <div style={{ display: "flex", height: "100%", background: "#0F0F12", color: "#fff" }}>
            {/* main / video panel */}
            <div style={{ flex: 1, padding: 22, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, letterSpacing: 4, color: "#F36F3A" }}>● LIVE · 142 LISTENING</div>
                  <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>Late-Night Lo-Fi Lounge</div>
                </div>
                <div style={{
                  padding: "6px 12px", background: corrected ? "rgba(22,163,74,0.18)" : "rgba(243,111,58,0.18)",
                  border: `1px solid ${corrected ? theme.ok : theme.accent1}`, borderRadius: 999,
                  fontSize: 12, color: corrected ? theme.ok : theme.accent1, fontWeight: 700,
                }}>
                  {corrected ? "drift 0ms · in sync" : `drift ${driftMs}ms · within tolerance`}
                </div>
              </div>

              {/* now playing card */}
              <div style={{ marginTop: 22, padding: 22, borderRadius: 14, background: "#161922", display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{ width: 90, height: 90, borderRadius: 8, background: "linear-gradient(135deg,#F36F3A,#D04CD0)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#9CA3AF", letterSpacing: 2 }}>NOW PLAYING · ALL LISTENERS HEAR THIS</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>Floating Lanterns</div>
                  <div style={{ marginTop: 4, color: "#9CA3AF", fontSize: 13 }}>Aki Sora · Drift</div>
                  <div style={{ marginTop: 12, height: 6, background: "#252A33", borderRadius: 3 }}>
                    <div style={{ height: 6, width: `${interpolate(f, [0, 900], [22, 86], { extrapolateRight: "clamp" })}%`, background: theme.accent1, borderRadius: 3 }} />
                  </div>
                </div>
              </div>

              {/* visualiser bars */}
              <div style={{ marginTop: 22, height: 90, display: "flex", alignItems: "flex-end", gap: 6, justifyContent: "center" }}>
                {Array.from({ length: 36 }).map((_, i) => {
                  const h = 20 + Math.abs(Math.sin(f / 6 + i * 0.5)) * 70;
                  return (
                    <div key={i} style={{
                      width: 6, height: h,
                      background: `linear-gradient(180deg,${theme.accent1} 0%,${theme.accent5} 100%)`,
                      borderRadius: 3,
                    }} />
                  );
                })}
              </div>

              {/* reactions row */}
              <div style={{ marginTop: 18, display: "flex", gap: 10, fontSize: 14 }}>
                <span style={{ padding: "8px 14px", background: "#252A33", borderRadius: 999 }}>♥ 38 <span style={{ color: theme.ok, marginLeft: 4 }}>+5</span></span>
                <span style={{ padding: "8px 14px", background: "#252A33", borderRadius: 999 }}>👎 2</span>
                <span style={{ padding: "8px 14px", background: "#252A33", borderRadius: 999 }}>⏭ Vote skip 4 / 24</span>
              </div>

              {/* emoji burst overlay */}
              {burstActive && emojis.map((e, i) => {
                const tStart = 380 + i * 8;
                const yOff = interpolate(f, [tStart, tStart + 60], [0, -300], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
                const op = interpolate(f, [tStart, tStart + 30, tStart + 60], [0, 1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
                return (
                  <div key={i} style={{
                    position: "absolute",
                    left: 200 + i * 95,
                    bottom: 90,
                    fontSize: 56,
                    transform: `translateY(${yOff}px)`,
                    opacity: op,
                  }}>{e}</div>
                );
              })}
            </div>

            {/* chat panel */}
            <div style={{ width: 380, borderLeft: "1px solid #252A33", padding: 18, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 12, color: "#9CA3AF", letterSpacing: 2, marginBottom: 12 }}>ROOM CHAT · 142 ONLINE</div>
              <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 10 }}>
                {CHATS.map((ch, i) => {
                  if (f < ch.t) return null;
                  const a = interpolate(f, [ch.t, ch.t + 12], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
                  if (ch.sys) {
                    return (
                      <div key={i} style={{
                        opacity: a,
                        transform: `translateY(${(1 - a) * 6}px)`,
                        textAlign: "center",
                        padding: "6px 12px",
                        background: "rgba(63,160,158,0.1)",
                        borderRadius: 999,
                        color: theme.accent2,
                        fontSize: 12,
                        margin: "4px auto",
                      }}>{ch.m}</div>
                    );
                  }
                  return (
                    <div key={i} style={{
                      opacity: a,
                      transform: `translateY(${(1 - a) * 8}px)`,
                      display: "flex", gap: 10, alignItems: "flex-start",
                    }}>
                      <div style={{ width: 28, height: 28, borderRadius: 14, background: ch.c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{ch.who[0]?.toUpperCase()}</div>
                      <div style={{ flex: 1, fontSize: 13 }}>
                        <span style={{ color: ch.c, fontWeight: 700, marginRight: 6 }}>{ch.who}</span>
                        <span style={{ color: "#D7DBE3" }}>{ch.m}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{
                marginTop: 12, padding: "10px 14px",
                background: "#161922", borderRadius: 999,
                fontSize: 13, color: "#9CA3AF", border: "1px solid #252A33",
              }}>Say something… <span style={{ float: "right", color: theme.accent2, fontSize: 11 }}>10/10s rate-limited</span></div>
            </div>
          </div>
        </BrowserChrome>
      </div>

      <Caption
        title={burstActive ? "room:emoji burst — ephemeral over the room" : "Real-time chat + reactions + sync_checkpoint"}
        subtitle="room:chat (10/10s) · room:song_reaction · room:emoji_burst · drift > 500ms triggers hard correct"
      />
    </AbsoluteFill>
  );
};
