import { createContext, useContext } from 'react'

export type AnalyticsGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly'

export interface AnalyticsData {
    dailyRevenue:   { date: string; revenue: number; txns: number }[];
    dailySignups:   { date: string; count: number }[];
    topArtists:     { artist: string; songs: number }[];
    tierDist:       { tier: string; count: number }[];
    donationsByDay: { date: string; amount: number; count: number }[];
    roomDailySessions: { date: string; sessions: number; listeners: number; minutesListened: number; coinsEarned: number }[];
    topRooms: { roomId: string; title: string; status: 'live' | 'offline'; favoriteCount: number; sessions: number; listeners: number; minutesListened: number; coinsEarned: number; avgListeners: number }[];
    roomSummary: {
        totalRooms: number;
        liveRooms: number;
        sessions: number;
        listeners: number;
        minutesListened: number;
        coinsEarned: number;
    };
    granularity: AnalyticsGranularity;
    from: string;
    to: string;
    days: number;
}

export interface AnalyticsCtxValue {
    data: AnalyticsData | null;
    loading: boolean;
    granularity: AnalyticsGranularity;
    setGranularity: (value: AnalyticsGranularity) => void;
    from: string;
    setFrom: (value: string) => void;
    to: string;
    setTo: (value: string) => void;
    applyRange: () => void;
    refresh: () => void;
}

export const AnalyticsCtx = createContext<AnalyticsCtxValue>({
    data: null,
    loading: true,
    granularity: 'daily',
    setGranularity: () => {},
    from: '',
    setFrom: () => {},
    to: '',
    setTo: () => {},
    applyRange: () => {},
    refresh: () => {},
})

export const useAnalytics = () => useContext(AnalyticsCtx)
