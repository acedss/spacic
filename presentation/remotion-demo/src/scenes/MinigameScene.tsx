import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, Caption } from "../components/Phone";

export const MinigameScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  const timer = Math.max(0, 30 - Math.floor(f / 6));

  const choices = [
    { i: 0, t: "Floating Lanterns",      a: "Aki Sora" },
    { i: 1, t: "Velvet Lights",          a: "Theo Lemoine" },
    { i: 2, t: "Tokyo Drive",            a: "Yuki Park" },
    { i: 3, t: "Indigo",                 a: "SOLA" },
  ];

  // Minh guesses correctly at frame 360
  const winner = f > 360;
  const showResult = f > 420;

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 40}px)`, opacity: slide }}>
        <BrowserChrome url="spacic.app/rooms/r1">
          <div style={{ height: "100%", padding: 40, color: "#fff", background: "#0F0F12", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{
              padding: "10px 20px", background: theme.gradWarm, borderRadius: 999,
              fontSize: 12, fontWeight: 700, letterSpacing: 4,
            }}>● MINIGAME LIVE</div>
            <h1 style={{ marginTop: 24, fontSize: 56, fontWeight: 800, letterSpacing: -1.5, textAlign: "center" }}>
              Guess the song from a 4-second clip.
            </h1>
            <div style={{ marginTop: 14, fontSize: 18, color: "#9CA3AF" }}>
              Started by Aki · room:game_trigger · 25 listeners answering
            </div>

            {/* timer ring */}
            <div style={{ marginTop: 36, position: "relative", width: 220, height: 220 }}>
              <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
                <circle cx="50" cy="50" r="44" fill="none" stroke="#252A33" strokeWidth="6" />
                <circle cx="50" cy="50" r="44" fill="none" stroke={timer < 8 ? theme.err : theme.accent1} strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${(timer / 30) * 276} 276`}
                  strokeDashoffset="0"
                  transform="rotate(-90 50 50)" />
              </svg>
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 76, fontWeight: 800,
                color: timer < 8 ? theme.err : "#fff",
              }}>{timer}</div>
            </div>

            <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: 760 }}>
              {choices.map((c) => {
                const correctIdx = 1; // Velvet Lights
                const isWinner = winner && c.i === correctIdx;
                return (
                  <div key={c.i} style={{
                    padding: "20px 22px",
                    borderRadius: 14,
                    background: isWinner ? theme.ok : "#161922",
                    border: isWinner ? "none" : `1px solid ${theme.borderDark}`,
                    display: "flex", alignItems: "center", gap: 14,
                    transform: isWinner ? "scale(1.04)" : "scale(1)",
                    transition: "all 0.3s",
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 8,
                      background: isWinner ? "#fff" : "#252A33",
                      color: isWinner ? theme.ok : "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: 800,
                    }}>{["A","B","C","D"][c.i]}</div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{c.t}</div>
                      <div style={{ fontSize: 13, color: isWinner ? "rgba(255,255,255,0.85)" : "#9CA3AF" }}>{c.a}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {showResult && (
              <div style={{
                marginTop: 36,
                padding: "18px 30px",
                background: theme.gradWarm,
                borderRadius: 14,
                fontSize: 22, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                🏆 Minh wins · earned 50 coins · room:game_result broadcast
              </div>
            )}

            <div style={{ marginTop: 24, fontSize: 12, color: "#7B8493", fontFamily: "ui-monospace,monospace", letterSpacing: 1 }}>
              {showResult
                ? "[ws] room:game_progress · room:game_result · wallet:balance_updated"
                : "[ws] room:game_start  · room:game_progress  (early-win on first correct)"}
            </div>
          </div>
        </BrowserChrome>
      </div>

      <Caption
        title="Minigame · guess the song — first correct answer wins"
        subtitle="room:game_trigger (host) · room:game_answer · early-win triggers room:game_result + coin reward"
      />
    </AbsoluteFill>
  );
};
