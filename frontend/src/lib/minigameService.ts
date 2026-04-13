import { axiosInstance } from '@/lib/axios';
import type { Minigame, MinigameType, MinigameTriggerType, MinigameConfig } from '@/types/types';

export interface CreateMinigamePayload {
    type:    MinigameType;
    title:   string;
    trigger?: { type: MinigameTriggerType; songIndex?: number | null };
    durationSeconds?: number;
    coinReward?:      number;
    config?:          MinigameConfig;
}

export const getMinigamesForRoom = async (roomId: string): Promise<Minigame[]> => {
    const { data } = await axiosInstance.get(`/minigames/rooms/${roomId}`);
    return data.data;
};

export const createMinigame = async (roomId: string, payload: CreateMinigamePayload): Promise<Minigame> => {
    const { data } = await axiosInstance.post(`/minigames/rooms/${roomId}`, payload);
    return data.data;
};

export const updateMinigame = async (id: string, payload: Partial<CreateMinigamePayload>): Promise<Minigame> => {
    const { data } = await axiosInstance.patch(`/minigames/${id}`, payload);
    return data.data;
};

export const deleteMinigame = async (id: string): Promise<void> => {
    await axiosInstance.delete(`/minigames/${id}`);
};
