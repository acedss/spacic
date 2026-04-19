import { create } from 'zustand';
import { axiosInstance } from '@/lib/axios';

export interface Notification {
    _id: string;
    type: 'friend_request' | 'friend_accepted' | 'room_invite' | 'room_live' | 'system';
    title: string;
    message: string;
    metadata: Record<string, string>;
    read: boolean;
    createdAt: string;
}

interface NotificationStore {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    fetchNotifications: () => Promise<void>;
    fetchUnreadCount: () => Promise<void>;
    markAllRead: () => Promise<void>;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,

    fetchNotifications: async () => {
        set({ loading: true });
        try {
            const { data } = await axiosInstance.get('/notifications');
            set({ notifications: data.data ?? [], loading: false });
        } catch {
            set({ loading: false });
        }
    },

    fetchUnreadCount: async () => {
        try {
            const { data } = await axiosInstance.get('/notifications/unread');
            set({ unreadCount: data.count ?? 0 });
        } catch { /* silent */ }
    },

    markAllRead: async () => {
        try {
            await axiosInstance.post('/notifications/read');
            set({ unreadCount: 0 });
            const updated = get().notifications.map(n => ({ ...n, read: true }));
            set({ notifications: updated });
        } catch { /* silent */ }
    },
}));
