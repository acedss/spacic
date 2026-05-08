import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { BrowserChrome, Caption } from "../components/Phone";

const TAGS = [
  { name: "Lo-Fi", count: 18, color: theme.accent1 },
  { name: "Indie", count: 14, color: theme.accent3 },
  { name: "Jazz", count: 11, color: theme.accent5 },
  { name: "Ambient", count: 10, color: theme.accent2 },
  { name: "Hip-Hop", count: 9, color: theme.accent4 },
  { name: "Electronic", count: 8, color: theme.accent3 },
  { name: "Pop", count: 7, color: theme.accent1 },
  { name: "Classical", count: 5, color: theme.accent5 },
];

const ROOMS = [
  ["Late-Night Lo-Fi Lounge", "Aki",  142, "Lo-Fi"],
  ["Tokyo Drive Sessions",    "Yuki",  87, "Indie"],
  ["Velvet Jazz Night",        "Theo",  64, "Jazz"],
  ["Focus / Ambient",          "SOLA",  56, "Ambient"],
  ["Boombap Mondays",          "MC O",  42, "Hip-Hop"],
  ["Subway Beats",             "Niko",  38, "Electronic"],
  ["Sunset Drive",             "Lena",  35, "Indie"],
  ["Rainy Window",             "Ari",   28, "Lo-Fi"],
];

export const DiscoverScene: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame: f, fps, config: { damping: 18 } });

  // tag selected over time
  const tagPick = f > 90 ? "Lo-Fi" : null;
  const filtered = tagPick ? ROOMS.filter((r) => r[3] === tagPick) : ROOMS;

  return (
    <AbsoluteFill style={{ background: theme.gradHero, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `translateY(${(1 - slide) * 40}px)`, opacity: slide }}>
        <BrowserChrome url="spacic.app/discover">
          <div style={{ height: "100%", padding: "32px 48px", background: "#FAFBFC" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, color: theme.accent1, letterSpacing: 4, fontWeight: 700 }}>DISCOVER</div>
                <h1 style={{ margin: "8px 0 0", fontSize: 48, fontWeight: 800, letterSpacing: -1.4, color: theme.fg }}>
                  Find your next room.
                </h1>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {["Most listeners", "New", "Friends here"].map((s, i) => (
                  <div key={s} style={{
                    padding: "8px 16px", borderRadius: 10,
                    background: i === 0 ? theme.fg : "#FFFFFF",
                    color: i === 0 ? "#fff" : theme.fg,
                    border: i === 0 ? "none" : `1px solid ${theme.border}`,
                    fontSize: 13, fontWeight: 600,
                  }}>{s}</div>
                ))}
              </div>
            </div>

            {/* Tag chips */}
            <div style={{ marginTop: 28, display: "flex", flexWrap: "wrap", gap: 10 }}>
              {TAGS.map((t) => {
                const on = tagPick === t.name;
                return (
                  <div key={t.name} style={{
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: on ? t.color : "#FFFFFF",
                    border: on ? "none" : `1px solid ${theme.border}`,
                    color: on ? "#fff" : theme.fg,
                    fontWeight: 600,
                    fontSize: 14,
                    transform: on ? "scale(1.05)" : "scale(1)",
                  }}>
                    {t.name} <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>{t.count}</span>
                  </div>
                );
              })}
            </div>

            {/* Search input */}
            <div style={{
              marginTop: 22, padding: "14px 18px",
              background: "#FFFFFF", borderRadius: 12,
              border: `1px solid ${theme.border}`,
              display: "flex", alignItems: "center", gap: 12,
              fontSize: 16, color: theme.muted, maxWidth: 560,
            }}>
              <span>🔍</span>
              {f > 200 ? "lofi study" : "Search rooms or hosts…"}
              {f > 180 && f < 240 && f % 30 < 15 && <span style={{ borderLeft: `2px solid ${theme.fg}`, height: 16 }} />}
            </div>

            {/* Grid */}
            <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
              {filtered.map((r, i) => {
                const a = spring({ frame: f - (60 + i * 8), fps, config: { damping: 14 } });
                const accent = TAGS.find((t) => t.name === r[3])?.color || theme.accent1;
                return (
                  <div key={i} style={{
                    background: "#FFFFFF",
                    borderRadius: 14,
                    border: `1px solid ${theme.border}`,
                    overflow: "hidden",
                    opacity: a,
                    transform: `translateY(${(1 - a) * 20}px)`,
                  }}>
                    <div style={{ background: accent, height: 100, position: "relative" }}>
                      <span style={{
                        position: "absolute", top: 10, right: 10,
                        background: "rgba(239,68,68,0.95)", color: "#fff",
                        fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 4,
                      }}>● LIVE</span>
                    </div>
                    <div style={{ padding: 14 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: theme.fg }}>{r[0]}</div>
                      <div style={{ marginTop: 4, color: theme.muted, fontSize: 12 }}>by {r[1]} · {r[2]} listening</div>
                      <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
                        <span style={{ padding: "3px 10px", borderRadius: 999, background: "#F3F4F6", color: theme.muted, fontSize: 11 }}>{r[3]}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </BrowserChrome>
      </div>

      <Caption
        title={tagPick ? `Discover · filtered by tag "${tagPick}"` : "Discover · browse all live rooms"}
        subtitle="GET /api/rooms/tag-counts · GET /api/rooms/public?tags=Lo-Fi · sort by listener count"
      />
    </AbsoluteFill>
  );
};
