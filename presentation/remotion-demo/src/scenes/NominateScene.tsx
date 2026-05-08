import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, Caption } from "../components/Phone";

const NOMS = [
  { id: "n1", title: "Velvet Lights",   artist: "Theo Lemoine", color: theme.accent5 },
  { id: "n2", title: "Soft Rain",       artist: "Lo & Slow",    color: theme.accent1 },
  { id: "n3", title: "Tokyo Drive",     artist: "Yuki Park",    color: theme.accent3 },
  { id: "n4", title: "Indigo",           artist: "SOLA",         color: theme.accent2 },
];

export const NominateScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  // votes evolve over time
  const votes: Record<string, number> = { n1: 14, n2: 9, n3: 6, n4: 3 };
  if (f > 80)  votes.n2 += 2;
  if (f > 140) votes.n2 += 2;
  if (f > 200) votes.n2 += 4;
  if (f > 260) votes.n2 += 7;  // promoted

  // promoted toast
  const promoted = f > 280;

  // pin message at start
  const pinningPhase = f < 380;

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 40}px)`, opacity: slide }}>
        <BrowserChrome url="spacic.app/rooms/r1">
          <div style={{ display: "flex", height: "100%", background: "#0F0F12", color: "#fff", padding: 22, gap: 22 }}>
            {/* nominate panel */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: "#9CA3AF", letterSpacing: 2 }}>VOTE THE NEXT SONG · {NOMS.length} NOMINATIONS</div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {NOMS.map((n, i) => {
                  const v = votes[n.id];
                  const reached = v >= 18;
                  return (
                    <div key={n.id} style={{
                      padding: 16, borderRadius: 14,
                      background: "#161922",
                      border: reached ? `2px solid ${theme.accent1}` : "1px solid #252A33",
                      display: "flex", alignItems: "center", gap: 14,
                    }}>
                      <div style={{ width: 60, height: 60, borderRadius: 10, background: n.color }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{n.title}</div>
                        <div style={{ color: "#9CA3AF", fontSize: 12 }}>{n.artist}</div>
                        <div style={{ marginTop: 8, height: 6, background: "#252A33", borderRadius: 3 }}>
                          <div style={{
                            height: 6, width: `${Math.min(100, (v / 20) * 100)}%`,
                            background: reached ? theme.accent1 : theme.accent3, borderRadius: 3,
                            transition: "width 0.5s",
                          }} />
                        </div>
                      </div>
                      <div style={{
                        width: 60, textAlign: "center", padding: "8px 0",
                        background: "#252A33", borderRadius: 8,
                        fontWeight: 700, color: reached ? theme.accent1 : "#fff",
                      }}>
                        ▲ {v}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 18, fontSize: 12, color: "#9CA3AF" }}>
                Threshold reached at 18 votes → server promotes the song to playlist · room:queue_song_added
              </div>

              {promoted && (
                <div style={{
                  marginTop: 18, padding: "14px 18px",
                  background: theme.accent1, borderRadius: 12,
                  display: "flex", alignItems: "center", gap: 10,
                  fontWeight: 700, fontSize: 14,
                }}>
                  ✓ "Soft Rain" promoted to playlist · queued at #2
                </div>
              )}
            </div>

            {/* chat / pinned */}
            <div style={{ width: 380, display: "flex", flexDirection: "column", gap: 14 }}>
              {pinningPhase && (
                <div style={{
                  padding: 16, borderRadius: 14, background: "rgba(243,111,58,0.1)",
                  border: `1px solid ${theme.accent1}`,
                  display: "flex", gap: 12,
                }}>
                  <div style={{ fontSize: 22 }}>📌</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: theme.accent1, fontWeight: 700, letterSpacing: 2 }}>PINNED BY HOST · room:pin_message</div>
                    <div style={{ marginTop: 4, fontSize: 14 }}>Album drops Friday · tip 1000 coins for a shoutout 💜 — Aki</div>
                  </div>
                </div>
              )}

              <div style={{ background: "#161922", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, color: "#9CA3AF", letterSpacing: 2, marginBottom: 10 }}>ROOM CHAT</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { who: "Minh", c: theme.accent3, m: "nominated Soft Rain — lit pls vote ▲" },
                    { who: "Linh", c: theme.accent5, m: "voted ✓" },
                    { who: "you",  c: theme.accent2, m: "Lo & Slow are insane lately" },
                    { who: "Aki",  c: theme.accent1, m: "queued 🎶" },
                  ].map((m, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 13 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 12, background: m.c, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{m.who[0].toUpperCase()}</div>
                      <span style={{ color: m.c, fontWeight: 700 }}>{m.who}</span>
                      <span style={{ color: "#D7DBE3" }}>{m.m}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "#0B0B0F", borderRadius: 14, padding: 14, border: "1px solid #1F2533", fontFamily: "ui-monospace,monospace", fontSize: 11, color: "#A8B0BD" }}>
                <div style={{ color: "#9CA3AF", letterSpacing: 2, marginBottom: 8 }}>SOCKET TRACE</div>
                <div>[ws] room:nominate_song   3 / 30s rate-limit</div>
                <div>[ws] room:vote_queue      ▲ Soft Rain</div>
                <div>[ws] room:nominations_update</div>
                {f > 280 && <div style={{ color: theme.accent1 }}>[ws] room:queue_song_added → broadcast</div>}
                {f > 280 && <div style={{ color: theme.accent1 }}>[ws] room:playlist_updated</div>}
                {f > 380 && <div style={{ color: theme.accent2 }}>[ws] room:message_pinned (host-only)</div>}
              </div>
            </div>
          </div>
        </BrowserChrome>
      </div>

      <Caption
        title="Vote the next song · pin a message — listener-driven flow"
        subtitle="room:nominate_song (3/30s) · room:vote_queue · room:pin_message (host-only) · room:queue_song_added"
      />
    </AbsoluteFill>
  );
};
