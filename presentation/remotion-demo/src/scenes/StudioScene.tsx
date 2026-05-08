import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, Caption } from "../components/Phone";

export const StudioScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  // phases: setup → go live → mic on → drop asset
  const live = f > 110;
  const mic  = f > 280;
  const drop = f > 480;

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 40}px)`, opacity: slide }}>
        <BrowserChrome url="spacic.app/studio">
          <div style={{ display: "flex", height: "100%", background: "#0F0F12", color: "#fff" }}>
            {/* sidebar */}
            <div style={{ width: 220, padding: 20, background: "#161922", borderRight: "1px solid #252A33" }}>
              <div style={{ fontSize: 13, color: "#9CA3AF", letterSpacing: 4, marginBottom: 12 }}>STUDIO</div>
              {[
                { lab: "Channel", on: true },
                { lab: "Queue", on: false },
                { lab: "Broadcast assets", on: false },
                { lab: "Minigames", on: false },
                { lab: "Analytics", on: false },
                { lab: "Payouts", on: false },
              ].map((it) => (
                <div key={it.lab} style={{
                  padding: "10px 12px", borderRadius: 10,
                  background: it.on ? "rgba(243,111,58,0.15)" : "transparent",
                  color: it.on ? theme.accent1 : "#D7DBE3",
                  fontSize: 13, fontWeight: it.on ? 700 : 500,
                  marginBottom: 4,
                }}>{it.lab}</div>
              ))}
            </div>

            {/* main */}
            <div style={{ flex: 1, padding: 28 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", letterSpacing: 4 }}>LATE-NIGHT LO-FI LOUNGE · CREATOR VIEW</div>
                  <div style={{ fontSize: 32, fontWeight: 800, marginTop: 6 }}>Welcome back, Aki</div>
                </div>
                <div style={{
                  padding: "10px 22px", borderRadius: 999,
                  background: live ? theme.err : theme.ok,
                  fontWeight: 700, fontSize: 14,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ width: 10, height: 10, borderRadius: 5, background: "#fff", animation: live ? "blink 1s infinite" : "" }} />
                  {live ? "● LIVE · 142 listeners" : "○ OFFLINE — Go live"}
                </div>
              </div>

              <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
                {/* queue panel */}
                <div style={{ background: "#161922", borderRadius: 14, padding: 22 }}>
                  <div style={{ fontSize: 13, color: "#9CA3AF", letterSpacing: 2, marginBottom: 12 }}>PLAYBACK QUEUE</div>
                  {[
                    { t: "Floating Lanterns",  a: "Aki Sora",       d: "3:42", now: true },
                    { t: "Soft Rain",          a: "Lo & Slow",      d: "4:01", queued: true },
                    { t: "Indigo",             a: "SOLA",           d: "3:55" },
                    { t: "Velvet Lights",      a: "Theo Lemoine",   d: "3:18" },
                    { t: "Tokyo Drive",        a: "Yuki Park",      d: "4:25" },
                  ].map((s, i) => (
                    <div key={i} style={{
                      padding: "12px 12px", borderRadius: 10,
                      background: s.now ? "rgba(243,111,58,0.08)" : "transparent",
                      border: s.now ? `1px solid ${theme.accent1}40` : "1px solid transparent",
                      display: "flex", alignItems: "center", gap: 12,
                      marginBottom: 4,
                    }}>
                      <div style={{ width: 24, height: 24, borderRadius: 4, background: ["#F36F3A","#F36F3A","#3FA09E","#D04CD0","#1D9BF0"][i] }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{s.t}</div>
                        <div style={{ color: "#9CA3AF", fontSize: 12 }}>{s.a}</div>
                      </div>
                      <div style={{ color: "#9CA3AF", fontSize: 12 }}>{s.d}</div>
                      {s.now && <div style={{ padding: "3px 10px", background: theme.accent1, borderRadius: 4, fontSize: 11, fontWeight: 700 }}>NOW</div>}
                      {s.queued && <div style={{ padding: "3px 10px", background: theme.accent2, borderRadius: 4, fontSize: 11, fontWeight: 700 }}>VOTED ↑</div>}
                    </div>
                  ))}
                </div>

                {/* live mic */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{
                    background: mic ? "rgba(239,68,68,0.1)" : "#161922",
                    border: mic ? `1px solid ${theme.err}` : "1px solid #252A33",
                    borderRadius: 14, padding: 20,
                  }}>
                    <div style={{ fontSize: 13, color: "#9CA3AF", letterSpacing: 2 }}>LIVE MIC · 10s HARD CAP</div>
                    <div style={{ marginTop: 14, fontSize: 18, fontWeight: 700, color: mic ? theme.err : "#fff" }}>
                      {mic ? "🎙 Speaking… 4 / 10s" : "🎙 Press to talk"}
                    </div>
                    {mic && (
                      <div style={{ marginTop: 10, height: 6, background: "#252A33", borderRadius: 3 }}>
                        <div style={{
                          height: 6,
                          width: `${interpolate(f, [280, 340], [0, 60], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })}%`,
                          background: theme.err, borderRadius: 3,
                        }} />
                      </div>
                    )}
                    <div style={{ marginTop: 10, fontSize: 11, color: "#9CA3AF" }}>
                      room:creator_speaking → room:audio_chunk × N → room:creator_done
                    </div>
                  </div>

                  {/* broadcast assets */}
                  <div style={{ background: drop ? "rgba(208,76,208,0.1)" : "#161922", borderRadius: 14, padding: 20, border: drop ? `1px solid ${theme.accent5}` : "1px solid #252A33" }}>
                    <div style={{ fontSize: 13, color: "#9CA3AF", letterSpacing: 2 }}>BROADCAST ASSETS</div>
                    {[
                      { name: "Album-launch tease", playing: drop },
                      { name: "Air horn",           playing: false },
                      { name: "Sponsor jingle",     playing: false },
                    ].map((a, i) => (
                      <div key={i} style={{
                        marginTop: 10, padding: 10, borderRadius: 8,
                        background: a.playing ? theme.accent5 : "#252A33",
                        display: "flex", alignItems: "center", gap: 10,
                        fontSize: 13,
                      }}>
                        <span>{a.playing ? "▶" : "⏵"}</span>
                        <span style={{ flex: 1 }}>{a.name}</span>
                        {a.playing && <span style={{ fontSize: 11, fontWeight: 700 }}>BROADCASTING</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#0B0B0F", border: "1px solid #1F2533", fontFamily: "ui-monospace,monospace", fontSize: 11, color: "#A8B0BD" }}>
                <div style={{ color: "#9CA3AF", letterSpacing: 2, marginBottom: 6 }}>STUDIO TRACE</div>
                {f > 80  && <div>POST /api/rooms/:roomId/go-live           ✓ host=aki</div>}
                {live    && <div style={{ color: theme.accent1 }}>[ws] room:song_changed · room:sync_checkpoint × N</div>}
                {mic     && <div style={{ color: theme.err }}>[ws] room:audio_chunk → 142 listeners (~48 KB each)</div>}
                {drop    && <div style={{ color: theme.accent5 }}>[ws] room:asset_play → presigned S3 GET URL · room:asset_broadcast</div>}
              </div>
            </div>
          </div>
        </BrowserChrome>
      </div>

      <Caption
        title={drop ? "Broadcast asset · presigned S3 URL fanned out via room:asset_broadcast" :
               mic  ? "Live mic · 10-second hard cap · raw audio chunks relayed to listeners" :
               live ? "Channel is live · sync_checkpoint pushing every 5s" :
                      "Studio · go live · queue · feature flags"}
        subtitle="POST /api/rooms/:roomId/go-live · ws room:audio_chunk / room:asset_play · PATCH /api/rooms/me/feature-flags"
      />
    </AbsoluteFill>
  );
};
