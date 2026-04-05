import { axiosInstance } from '@/lib/axios';
import type { RoomInfo, Song, CreateRoomPayload } from '@/types/types';

export const getSongs = async (): Promise<Song[]> => {
    const { data } = await axiosInstance.get('/songs');
    return data;
};

// ── Creator channel management ────────────────────────────────────────────

export const upsertRoom = async (payload: CreateRoomPayload): Promise<RoomInfo> => {
    const { data } = await axiosInstance.post('/rooms', payload);
    return data.data;
};

export const getMyRoom = async (): Promise<RoomInfo | null> => {
    const { data } = await axiosInstance.get('/rooms/me/room');
    return data.data;
};

export const goLive = async (roomId: string): Promise<RoomInfo> => {
    const { data } = await axiosInstance.post(`/rooms/${roomId}/go-live`);
    return data.data;
};

export const goOffline = async (roomId: string): Promise<void> => {
    await axiosInstance.post(`/rooms/${roomId}/go-offline`);
};

// ── Discovery ─────────────────────────────────────────────────────────────

export const getRoomById = async (roomId: string): Promise<RoomInfo> => {
    const { data } = await axiosInstance.get(`/rooms/${roomId}`);
    return data.data;
};

export const getPublicRooms = async (params?: {
    sort?: string;
    limit?: number;
    offset?: number;
    search?: string;
}) => {
    const { data } = await axiosInstance.get('/rooms/public', { params });
    return data;
};

// ── Session actions ───────────────────────────────────────────────────────

export const joinRoom = async (roomId: string) => {
    const { data } = await axiosInstance.post(`/rooms/${roomId}/join`);
    return data.data;
};

export const leaveRoom = async (roomId: string) => {
    await axiosInstance.post(`/rooms/${roomId}/leave`);
};

export const skipSong = async (roomId: string) => {
    const { data } = await axiosInstance.post(`/rooms/${roomId}/skip`);
    return data.data;
};

export const addToQueue = async (roomId: string, songId: string) => {
    const { data } = await axiosInstance.post(`/rooms/${roomId}/queue`, { songId });
    return data.data;
};

export const sendChatMessage = async (roomId: string, message: string) => {
    const { data } = await axiosInstance.post(`/rooms/${roomId}/chat`, { message });
    return data.data;
};
