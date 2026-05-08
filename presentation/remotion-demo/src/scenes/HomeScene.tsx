import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, SpacicLogo, Caption, Pulse } from "../components/Phone";

const LIVE_ROOMS = [
  { id: "r1", title: "Late-Night Lo-Fi Lounge", host: "Aki",   listeners: 142, color: theme.accent1, tag: "Lo-Fi" },
  { id: "r2", title: "Tokyo Drive Sessions",    host: "Yuki",  listeners: 87,  color: theme.accent3, tag: "Indie" },
  { id: "r3", title: "Velvet Jazz Night",        host: "Theo",  listeners: 64,  color: theme.accent5, tag: "Jazz" },
  { id: "r4", title: "Focus / Ambient",          host: "SOLA",  listeners: 56,  color: theme.accent2, tag: "Ambient" },
];

const FRIENDS = [
  { name: "Minh", color: theme.accent3, doing: "joined Tokyo Drive Sessions" },
  { name: "Linh", color: theme.accent5, doing: "is hosting Velvet Jazz Night" },
  { name: "Sora", color: theme.accent4, doing: "favourited Late-Night Lo-Fi" },
];

export const HomeScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  // smooth scroll the page from 0 to 320px over 400 frames
  const scroll = interpolate(f, [60, 380, 600], [0, 320, 320], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 40}px)`, opacity: slide }}>
        <BrowserChrome url="spacic.app">
          <div style={{ height: "100%", display: "flex", background: "#FAFBFC" }}>
            {/* sidebar */}
            <div style={{ width: 220, padding: 20, background: "#FFFFFF", borderRight: `1px solid ${theme.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px" }}>
                <SpacicLogo size={28} />
                <div style={{ fontWeight: 800, color: theme.fg, fontSize: 18 }}>Spacic</div>
              </div>
              {[
                { lab: "Home", on: true, ic: "🏠" },
                { lab: "Discover", on: false, ic: "✨" },
                { lab: "Rooms", on: false, ic: "🎙️" },
                { lab: "Friends", on: false, ic: "👥" },
                { lab: "Favourites", on: false, ic: "♥" },
                { lab: "Wallet", on: false, ic: "💰" },
                { lab: "Subscription", on: false, ic: "⭐" },
                { lab: "Studio", on: false, ic: "🎚️" },
              ].map((it) => (
                <div key={it.lab} style={{
                  padding: "10px 12px", borderRadius: 10,
                  background: it.on ? "rgba(243,111,58,0.08)" : "transparent",
                  color: it.on ? theme.accent1 : theme.fg,
                  fontWeight: it.on ? 700 : 500, fontSize: 14,
                  display: "flex", gap: 12, alignItems: "center",
                }}>
                  <span>{it.ic}</span>{it.lab}
                </div>
              ))}
            </div>

            {/* main */}
            <div style={{ flex: 1, padding: "28px 36px", overflow: "hidden" }}>
              <div style={{ transform: `translateY(${-scroll}px)`, transition: "transform 0.6s" }}>
                {/* header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ flex: 1, maxWidth: 460 }}>
                    <div style={{ background: "#FFFFFF", border: `1px solid ${theme.border}`, padding: "10px 14px", borderRadius: 10, color: theme.muted, fontSize: 14 }}>
                      Search rooms, songs, people · ⌘K
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                    <div style={{
                      padding: "8px 14px", borderRadius: 999,
                      background: "rgba(243,111,58,0.08)",
                      border: `1px solid ${theme.accent1}40`,
                      color: theme.accent1, fontWeight: 700, fontSize: 14,
                    }}>💰 1,250 coins</div>
                    <div style={{
                      width: 36, height: 36, borderRadius: 18,
                      background: theme.accent3, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
                    }}>D</div>
                  </div>
                </div>

                {/* hero */}
                <div style={{
                  marginTop: 26,
                  padding: 36,
                  borderRadius: 20,
                  background: theme.gradHero,
                  color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  minHeight: 180,
                }}>
                  <div>
                    <div style={{ fontSize: 12, letterSpacing: 4, color: "#F36F3A" }}>STATION OF THE WEEK</div>
                    <div style={{ marginTop: 8, fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>Late-Night Lo-Fi Lounge</div>
                    <div style={{ marginTop: 6, fontSize: 16, color: "#CBD5E1" }}>Hosted by Aki · 142 listening now</div>
                    <div style={{ marginTop: 18, display: "flex", gap: 10 }}>
                      <button style={{ padding: "10px 18px", borderRadius: 10, background: theme.accent1, color: "#fff", border: "none", fontWeight: 700, fontSize: 14 }}>▶ Join room</button>
                      <button style={{ padding: "10px 18px", borderRadius: 10, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", fontSize: 14 }}>♥ Favourite</button>
                    </div>
                  </div>
                  <div style={{
                    width: 200, height: 140, borderRadius: 14, background: "linear-gradient(135deg,#F36F3A 0%,#D04CD0 100%)",
                  }} />
                </div>

                {/* live now */}
                <div style={{ marginTop: 36 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: theme.fg, display: "flex", alignItems: "center", gap: 10 }}>
                      <Pulse /> Live now
                    </h2>
                    <div style={{ color: theme.muted, fontSize: 13 }}>{LIVE_ROOMS.length} active rooms</div>
                  </div>
                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                    {LIVE_ROOMS.map((r, i) => {
                      const a = spring({ frame: f - (40 + i * 8), fps, config: { damping: 14 } });
                      return (
                        <div key={r.id} style={{
                          background: "#FFFFFF",
                          borderRadius: 14,
                          border: `1px solid ${theme.border}`,
                          overflow: "hidden",
                          opacity: a,
                          transform: `translateY(${(1 - a) * 20}px)`,
                        }}>
                          <div style={{ background: r.color, height: 110, display: "flex", justifyContent: "flex-end", padding: 10 }}>
                            <span style={{ background: "rgba(239,68,68,0.95)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "3px 8px", borderRadius: 4 }}>● LIVE</span>
                          </div>
                          <div style={{ padding: 14 }}>
                            <div style={{ fontWeight: 700, color: theme.fg, fontSize: 15, lineHeight: 1.2 }}>{r.title}</div>
                            <div style={{ marginTop: 6, color: theme.muted, fontSize: 12 }}>by {r.host} · {r.listeners} listeners</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* taste row */}
                <div style={{ marginTop: 36 }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: theme.fg }}>For you · personalised by ALS</h2>
                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                    {LIVE_ROOMS.map((r, i) => (
                      <div key={"f"+r.id} style={{ background: "#FFFFFF", borderRadius: 14, border: `1px solid ${theme.border}`, padding: 12 }}>
                        <div style={{ background: r.color, height: 90, borderRadius: 10 }} />
                        <div style={{ marginTop: 10, fontWeight: 700, color: theme.fg, fontSize: 14 }}>{r.title}</div>
                        <div style={{ color: theme.muted, fontSize: 11 }}>{r.tag}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* friends activity */}
                <div style={{ marginTop: 36 }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: theme.fg }}>Friends listening</h2>
                  <div style={{ marginTop: 14, background: "#FFFFFF", borderRadius: 14, border: `1px solid ${theme.border}`, padding: 6 }}>
                    {FRIENDS.map((fr, i) => {
                      const a = spring({ frame: f - (250 + i * 10), fps, config: { damping: 14 } });
                      return (
                        <div key={fr.name} style={{
                          padding: "12px 14px",
                          display: "flex", alignItems: "center", gap: 14,
                          borderBottom: i < FRIENDS.length - 1 ? `1px solid ${theme.border}` : "none",
                          opacity: a,
                          transform: `translateX(${(1 - a) * 20}px)`,
                        }}>
                          <div style={{ width: 36, height: 36, borderRadius: 18, background: fr.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{fr.name[0]}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ color: theme.fg, fontSize: 14, fontWeight: 600 }}>{fr.name}</div>
                            <div style={{ color: theme.muted, fontSize: 12 }}>{fr.doing}</div>
                          </div>
                          <button style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${theme.border}`, background: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>Join →</button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* moods grid */}
                <div style={{ marginTop: 36 }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: theme.fg }}>Moods</h2>
                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12 }}>
                    {["Late Night","Focus","Workout","Chill","Party","Drive"].map((m, i) => (
                      <div key={m} style={{
                        padding: 22, borderRadius: 12,
                        background: [theme.accent1, theme.accent2, theme.accent3, theme.accent4, theme.accent5, theme.accent3][i],
                        color: "#fff", fontWeight: 700, fontSize: 16, textAlign: "center",
                      }}>{m}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </BrowserChrome>
      </div>

      <Caption
        title="Home — Live now, For you, Friends activity, Moods"
        subtitle="GET /api/rooms/public · GET /api/recs/me · GET /api/friends/activity"
      />
    </AbsoluteFill>
  );
};
