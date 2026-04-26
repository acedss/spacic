import { BarChart3, Gamepad2, ListMusic, Mic, Settings } from 'lucide-react';
import type { MinigameType, MinigameTriggerType } from '@/types/types';

export type AnalyticsGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type StudioTab = 'overview' | 'playlists' | 'broadcasts' | 'minigames' | 'settings';

export const CHART_AXIS = { fontSize: 10, fill: 'oklch(0.55 0.01 285)' };
export const CHART_GRID = 'oklch(0.18 0.01 285)';
export const CHART_TOOLTIP = { backgroundColor: 'oklch(0.14 0.015 285)', border: '1px solid oklch(0.25 0.01 285)', borderRadius: 8, fontSize: 12 };
export const CHART_COLORS = ['#a78bfa', '#34d399', '#f59e0b', '#60a5fa', '#f472b6', '#22d3ee', '#fb7185', '#a3e635'];

export const ALL_TAGS = ['Late Night', 'Ambient', 'Indie', 'R&B', 'Focus', 'Hype', 'Chill', 'Jazz', 'Electronic', 'Acoustic', 'Soul', 'Lo-fi', 'Pop', 'Hip-Hop', 'Classical', 'Country', 'Reggae', 'Metal'];

export const TABS: { id: StudioTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'broadcasts', label: 'Broadcasts', icon: Mic },
    { id: 'minigames', label: 'Minigames', icon: Gamepad2 },
    { id: 'settings', label: 'Settings', icon: Settings },
];

export const GAME_TYPES: { value: MinigameType; label: string; desc: string }[] = [
    { value: 'song_guesser', label: 'Song Guesser', desc: 'First to type the song title wins' },
    { value: 'lyric_fill', label: 'Lyric Fill-in', desc: 'Complete the missing lyric' },
    { value: 'trivia', label: 'Trivia', desc: 'Multiple-choice question, timed' },
    { value: 'skip_battle', label: 'Skip Battle', desc: 'Vote duel — keep or skip current song' },
];

export const TRIGGER_TYPES: { value: MinigameTriggerType; label: string }[] = [
    { value: 'manual', label: 'Manual (trigger from Live page)' },
    { value: 'before_song', label: 'Before song at index…' },
    { value: 'after_song', label: 'After song at index…' },
];

export const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-white/8 text-white/50',
    scheduled: 'bg-[oklch(0.55_0.18_250_/_0.15)] text-[oklch(0.75_0.1_250)]',
    active: 'bg-[oklch(0.72_0.22_20_/_0.12)] text-[oklch(0.82_0.17_20)]',
    completed: 'bg-[oklch(0.55_0.18_160_/_0.15)] text-[oklch(0.75_0.12_160)]',
    cancelled: 'bg-white/5 text-white/30',
};

export const toHours = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const toDateTimeInputValue = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
export const toDate = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
export const fmtDateShort = (v: string) => { const d = toDate(v); return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : v; };
export const fmtDateLong = (v: string) => { const d = toDate(v); return d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : v; };
export const sortByDateAsc = <T extends { date: string }>(arr: T[]) =>
    [...arr].sort((a, b) => (toDate(a.date)?.getTime() ?? 0) - (toDate(b.date)?.getTime() ?? 0));
