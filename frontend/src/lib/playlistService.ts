import { axiosInstance } from '@/lib/axios';
import type { SavedPlaylist } from '@/types/types';

export const getMyPlaylists = async (): Promise<SavedPlaylist[]> => {
    const { data } = await axiosInstance.get('/playlists');
    return data.data;
};

export const createPlaylist = async (payload: {
    name: string;
    songs?: string[];   // Song _id array
    coverArt?: string;
}): Promise<SavedPlaylist> => {
    const { data } = await axiosInstance.post('/playlists', payload);
    return data.data;
};

export const updatePlaylist = async (
    id: string,
    payload: { name?: string; songs?: string[]; coverArt?: string }
): Promise<SavedPlaylist> => {
    const { data } = await axiosInstance.patch(`/playlists/${id}`, payload);
    return data.data;
};

export const deletePlaylist = async (id: string): Promise<void> => {
    await axiosInstance.delete(`/playlists/${id}`);
};
