// Spacic Demo · 1080p 30fps · ~9 minutes total

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Scene durations in seconds — based on agents.md feature list
export const SCENES = [
  { id: "intro",      label: "Spacic — open",                         seconds: 12 },
  { id: "problem",    label: "Why a music room?",                      seconds: 22 },
  { id: "stack",      label: "The full stack",                         seconds: 28 },
  { id: "signin",     label: "Clerk sign-in",                          seconds: 22 },
  { id: "onboarding", label: "Onboarding wizard — taste, mood, songs", seconds: 36 },
  { id: "home",       label: "Home — hero, live now, recs, friends",   seconds: 38 },
  { id: "discover",   label: "Discover — tags, search, browse",        seconds: 24 },
  { id: "joinroom",   label: "Joining a live room",                    seconds: 26 },
  { id: "syncchat",   label: "Sync + chat + emoji burst + reactions",  seconds: 30 },
  { id: "donate",     label: "Tip the creator — Stripe wallet",        seconds: 30 },
  { id: "nominate",   label: "Nominate songs · vote queue · pin msg",  seconds: 28 },
  { id: "minigame",   label: "Minigame — guess the song",              seconds: 22 },
  { id: "studio",     label: "Studio — go live · queue · mic · drops", seconds: 32 },
  { id: "wallet",     label: "Wallet · Stripe top-up · subscribe",     seconds: 26 },
  { id: "admin",      label: "Admin — analytics · alerts · catalogue", seconds: 30 },
  { id: "tech",       label: "Hard problems we solved",                seconds: 26 },
  { id: "outro",      label: "Spacic — thank you",                     seconds: 14 },
] as const;

// Timeline map (frame ranges)
export const TIMELINE = SCENES.reduce<{ id: string; from: number; durationInFrames: number; label: string }[]>((acc, s) => {
  const last = acc[acc.length - 1];
  const from = last ? last.from + last.durationInFrames : 0;
  acc.push({ id: s.id, from, durationInFrames: s.seconds * FPS, label: s.label });
  return acc;
}, []);

export const TOTAL_FRAMES = TIMELINE.reduce((n, s) => n + s.durationInFrames, 0);
