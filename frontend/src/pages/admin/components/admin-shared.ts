import axios from 'axios';
import type { AnalyticsGranularity } from './AnalyticsContext';

export interface Plan {
    _id: string; slug: string; name: string; tier: string;
    priceMonthlyUsd: number; priceYearlyUsd: number | null;
    stripePriceIdMonthly: string | null; stripePriceIdYearly: string | null;
    stripeProductId: string | null; features: string[]; isActive: boolean;
}

export interface AdminUser {
    clerkId: string; fullName: string; username: string | null;
    imageUrl: string; userTier: string; role: string;
    subscriptionStatus: string | null;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    currentPeriodEnd: string | null;
    balance: number; createdAt: string;
}

export interface Song {
    _id: string; title: string; artist: string;
    imageUrl: string; s3Key: string; duration: number;
    streamCount?: number; uniquePlays?: number; skipCount?: number;
    createdAt?: string;
}

export interface SongAnalytics {
    playsPerPeriod: { date: string; plays: number; streams: number; skips: number }[];
    playsPerDay?: { date: string; plays: number; streams: number; skips: number }[];
    topSongs: { songId: string; title: string; artist: string; streams: number; plays: number; skips: number; listeners: number; skipRate: number }[];
    skipRates: { title: string; artist: string; plays: number; skipRate: number }[];
    geoBreakdown: { country: string; streams: number }[];
    summary: { plays: number; streams: number; skippedPlays: number; activeSongs: number };
    granularity: AnalyticsGranularity;
    from: string;
    to: string;
    days: number;
}

export interface TopupPkg {
    _id: string; packageId: string; name: string;
    priceUsd: number; credits: number; bonusPercent: number;
    isActive: boolean; isFeatured: boolean; sortOrder: number;
}

export interface Stats {
    users: { FREE: number; PREMIUM: number; CREATOR: number };
    totalUsers: number; activeSubscribers: number;
    songCount: number; totalCreditsToppedup: number;
    recentTopups: { _id: string; amount: number; createdAt: string; userId: { fullName: string; imageUrl: string } }[];
}

export const TIER_COLORS: Record<string, string> = {
    FREE:    'bg-zinc-700 text-zinc-300',
    PREMIUM: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    CREATOR: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
};

export const STATUS_STYLES: Record<string, string> = {
    active:               'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    cancel_at_period_end: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    past_due:             'bg-red-500/15 text-red-400 border-red-500/30',
    canceled:             'bg-zinc-700 text-zinc-500 border-zinc-600',
};

export const formatCredits = (c: number) => `$${(c / 100).toFixed(2)}`;
export const fmtDuration   = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const fmtMinutesCompact = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m}m`);

export const toDate = (value: string) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const fmtDateShort = (value: string) => {
    const d = toDate(value);
    return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : value;
};

export const fmtDateLong = (value: string) => {
    const d = toDate(value);
    return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : value;
};

export const sortByDateAsc = <T extends { date: string }>(arr: T[]) =>
    [...arr].sort((a, b) => {
        const aT = toDate(a.date)?.getTime() ?? 0;
        const bT = toDate(b.date)?.getTime() ?? 0;
        return aT - bT;
    });

export const toDateTimeInputValue = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
};

export const fmtDateTimeInput = (value: string) => {
    const d = toDate(value);
    return d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : value;
};

export const fmtShortDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' }) : '—';

export const getAxiosErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
        return error.response?.data?.message ?? fallback;
    }
    return fallback;
};
