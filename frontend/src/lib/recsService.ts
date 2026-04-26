import { axiosInstance } from '@/lib/axios';

export interface RecRoom {
    _id:           string;
    title:         string;
    description?:  string;
    status:        'live' | 'offline';
    coverImageUrl: string | null;
    tags:          string[];
    favoriteCount: number;
    stats?:        { totalListeners?: number };
    creatorId?: {
        _id:      string;
        fullName: string;
        imageUrl: string;
    };
}

export interface RecsResult {
    rooms:       RecRoom[];
    source:      'cache' | 'content' | 'fallback' | 'offline';
    generatedAt: string | null;
}

export const getMyRecommendations = async (limit = 20): Promise<RecsResult> => {
    const { data } = await axiosInstance.get('/recs/me', { params: { limit } });
    return data.data as RecsResult;
};

export interface TrendingSong {
    _id:           string;
    title:         string;
    artist:        string;
    imageUrl:      string;
    streamCount:   number;
    todayStreams:  number;
}

export const getTrendingSongs = async (): Promise<TrendingSong[]> => {
    const { data } = await axiosInstance.get('/songs/trending');
    return data.data as TrendingSong[];
};
