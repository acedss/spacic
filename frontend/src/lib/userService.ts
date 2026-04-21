import { axiosInstance } from '@/lib/axios';

export interface PublicProfile {
    _id: string;
    fullName: string;
    imageUrl: string;
    username: string | null;
    userTier: string;
    role: string;
    joinedAt: string;
    stats: {
        roomsJoined: number;
        gamesPlayed: number;
        donationsMade: number;
        totalCoinsDonated: number;
        minigameWins: number;
        listeningHours: number;
    };
    creatorStats: {
        totalRoomsHosted: number;
        totalStreams: number;
        totalMinutesListened: number;
        totalWinPointsEarned: number;
        totalUniqueDonors: number;
    } | null;
    badges: { id: string; label: string; emoji: string }[];
}

export const getPublicProfile = async (userId: string): Promise<PublicProfile> => {
    const { data } = await axiosInstance.get(`/users/${userId}/public-profile`);
    return data.data;
};
