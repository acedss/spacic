import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, Caption, Pulse } from "../components/Phone";

export const JoinRoomScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  // listener count animates upward as people join
  const listeners = Math.floor(interpolate(f, [0, 200], [142, 156], { extrapolateRight: "clamp" }));

  // socket trace lines that appear sequentially
  const socketLines = [
    { t: 30,  m: "[ws] room:join              → server" },
    { t: 70,  m: "[ws] room:joined            ← server  (full snapshot, presigned URL)" },
    { t: 130, m: "[ws] room:listener_joined   ← broadcast (you + 142 others)" },
    { t: 200, m: "[ws] room:sync_checkpoint   ← every 5s · drift correction" },
    { t: 280, m: "[ws] room:sync_checkpoint   ← startTimeUnix=1714968210000" },
    { t: 360, m: "[ws] room:sync_checkpoint   ← serverTimestamp=1714968215042" },
  ];

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 40}px)`, opacity: slide, display: "flex", gap: 24 }}>
        <BrowserChrome url="spacic.app/rooms/r1" width={1140} height={780}>
          <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0F0F12" }}>
            {/* room hero */}
            <div style={{ padding: 26, color: "#fff", background: theme.gradWarm }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, letterSpacing: 4, fontWeight: 700, color: "#fff" }}>● LIVE · LO-FI</div>
                  <div style={{ marginTop: 6, fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>Late-Night Lo-Fi Lounge</div>
                  <div style={{ marginTop: 6, fontSize: 16, color: "rgba(255,255,255,0.8)" }}>Hosted by Aki · {listeners} listening</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(0,0,0,0.25)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", fontSize: 13 }}>♥ Favourite</button>
                  <button style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(0,0,0,0.25)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", fontSize: 13 }}>↗ Share</button>
                </div>
              </div>
            </div>

            {/* now playing strip */}
            <div style={{ padding: 22, display: "flex", alignItems: "center", gap: 20, background: "#161922", color: "#fff" }}>
              <div style={{ width: 80, height: 80, borderRadius: 8, background: "linear-gradient(135deg,#F36F3A,#D04CD0)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#9CA3AF", letterSpacing: 2 }}>NOW PLAYING</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>Floating Lanterns</div>
                <div style={{ fontSize: 14, color: "#9CA3AF" }}>Aki Sora · Drift</div>
                {/* progress bar */}
                <div style={{ marginTop: 8, height: 6, background: "#252A33", borderRadius: 3 }}>
                  <div style={{
                    height: 6,
                    width: `${interpolate(f, [0, 780], [12, 78], { extrapolateRight: "clamp" })}%`,
                    background: theme.accent1,
                    borderRadius: 3,
                  }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 11, color: "#9CA3AF", display: "flex", justifyContent: "space-between" }}>
                  <span>1:24</span><span>3:42</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ padding: "4px 8px", background: "#252A33", borderRadius: 4, fontSize: 11 }}>♥ 38</span>
                <span style={{ padding: "4px 8px", background: "#252A33", borderRadius: 4, fontSize: 11 }}>👎 2</span>
                <button style={{ padding: "8px 12px", background: "#252A33", borderRadius: 8, color: "#fff", border: "none", fontSize: 12 }}>⏭ Vote skip 4/24</button>
              </div>
            </div>

            {/* listeners + console */}
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", padding: 22, gap: 20, color: "#fff" }}>
              <div>
                <div style={{ fontSize: 14, color: "#9CA3AF", letterSpacing: 2 }}>LISTENERS</div>
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 6 }}>
                  {Array.from({ length: 32 }).map((_, i) => (
                    <div key={i} style={{
                      width: 36, height: 36, borderRadius: 18,
                      background: [theme.accent1, theme.accent2, theme.accent3, theme.accent4, theme.accent5][i % 5],
                      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                    }}>{String.fromCharCode(65 + (i % 26))}</div>
                  ))}
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: "#252A33", color: "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>+{listeners - 32}</div>
                </div>
                <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, color: "#9CA3AF", fontSize: 12 }}>
                  <Pulse color={theme.ok} /> Geo: VN, JP, US, DE, FR (geoip-lite tag)
                </div>
              </div>

              <div style={{ background: "#0B0B0F", borderRadius: 8, border: `1px solid ${theme.borderDark}`, padding: 12, fontFamily: "ui-monospace,monospace" }}>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 8, letterSpacing: 2 }}>SOCKET.IO TRACE · room=r1</div>
                {socketLines.map((line, i) => {
                  const visible = f > line.t;
                  return (
                    <div key={i} style={{
                      fontSize: 12,
                      color: i < 2 ? theme.accent2 : "#D7DBE3",
                      opacity: visible ? 1 : 0,
                      transform: `translateY(${visible ? 0 : 8}px)`,
                      transition: "all 0.3s",
                      padding: "3px 0",
                    }}>{line.m}</div>
                  );
                })}
              </div>
            </div>
          </div>
        </BrowserChrome>
      </div>

      <Caption
        title="Joining a live room — server-authoritative state"
        subtitle="POST /api/rooms/:roomId/join · room:join socket event · sync_checkpoint every 5s · hard-correct drift > 500ms"
      />
    </AbsoluteFill>
  );
};
