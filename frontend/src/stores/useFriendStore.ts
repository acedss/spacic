import { create } from 'zustand';
import { toast } from 'sonner';
import { axiosInstance } from '@/lib/axios';
import type {
    Friend,
    FriendRequest,
    FriendSearchResult,
    FriendActivity,
    FriendInvite,
} from '@/types/types';

interface FriendStore {
    // State
    friends:        Friend[];
    requests:       FriendRequest[];   // incoming pending
    sentRequests:   FriendRequest[];   // outgoing pending
    activity:       FriendActivity;
    searchResults:  FriendSearchResult[];
    pendingInvites: FriendInvite[];    // live socket invites awaiting response
    loading:        boolean;
    searchLoading:  boolean;

    // SPC-55: Friend Request System
    fetchFriends:        () => Promise<void>;
    fetchRequests:       () => Promise<void>;
    sendRequest:         (targetUserId: string) => Promise<void>;
    acceptRequest:       (friendshipId: string) => Promise<void>;
    declineRequest:      (friendshipId: string) => Promise<void>;
    cancelRequest:       (friendshipId: string, targetUserId: string) => Promise<void>;
    unfriend:            (friendshipId: string, targetUserId: string) => Promise<void>;

    // SPC-57: Discovery & Search
    searchUsers:         (q: string) => Promise<void>;
    clearSearch:         () => void;

    // SPC-18: Activity Feed
    fetchActivity:       () => Promise<void>;

    // SPC-56: Direct Invite
    sendInvite:          (friendId: string, roomId: string) => Promise<void>;
    addPendingInvite:    (invite: FriendInvite) => void;
    dismissInvite:       (inviteId: string) => void;
}

export const useFriendStore = create<FriendStore>((set, get) => ({
    friends:        [],
    requests:       [],
    sentRequests:   [],
    activity:       { listening: [], online: [], offline: [] },
    searchResults:  [],
    pendingInvites: [],
    loading:        false,
    searchLoading:  false,

    // ── SPC-55 ────────────────────────────────────────────────────────────────

    fetchFriends: async () => {
        try {
            const { data } = await axiosInstance.get('/friends');
            set({ friends: data.data });
        } catch {
            toast.error('Failed to load friends');
        }
    },

    fetchRequests: async () => {
        set({ loading: true });
        try {
            const [incoming, sent] = await Promise.all([
                axiosInstance.get('/friends/requests'),
                axiosInstance.get('/friends/sent'),
            ]);
            set({ requests: incoming.data.data, sentRequests: sent.data.data });
        } catch {
            toast.error('Failed to load requests');
        } finally {
            set({ loading: false });
        }
    },

    sendRequest: async (targetUserId) => {
        try {
            await axiosInstance.post(`/friends/request/${targetUserId}`);
            toast.success('Friend request sent');
            // Optimistically update search results
            set((state) => ({
                searchResults: state.searchResults.map((u) =>
                    u.userId === targetUserId
                        ? { ...u, friendshipStatus: 'pending_sent' }
                        : u
                ),
            }));
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ?? 'Failed to send request';
            toast.error(msg);
        }
    },

    acceptRequest: async (friendshipId) => {
        try {
            await axiosInstance.post(`/friends/accept/${friendshipId}`);
            toast.success('Friend request accepted!');
            set((state) => ({
                requests: state.requests.filter((r) => r._id !== friendshipId),
                searchResults: state.searchResults.map((u) =>
                    u.friendshipId === friendshipId
                        ? { ...u, friendshipStatus: 'accepted' }
                        : u
                ),
            }));
            get().fetchFriends();
        } catch {
            toast.error('Failed to accept request');
        }
    },

    declineRequest: async (friendshipId) => {
        try {
            await axiosInstance.post(`/friends/decline/${friendshipId}`);
            set((state) => ({
                requests: state.requests.filter((r) => r._id !== friendshipId),
            }));
        } catch {
            toast.error('Failed to decline request');
        }
    },

    cancelRequest: async (friendshipId, targetUserId) => {
        try {
            await axiosInstance.delete(`/friends/${friendshipId}`);
            set((state) => ({
                sentRequests: state.sentRequests.filter((r) => r._id !== friendshipId),
                searchResults: state.searchResults.map((u) =>
                    u.userId === targetUserId
                        ? { ...u, friendshipStatus: 'none', friendshipId: null }
                        : u
                ),
            }));
            toast.success('Request cancelled');
        } catch {
            toast.error('Failed to cancel request');
        }
    },

    unfriend: async (friendshipId, targetUserId) => {
        try {
            await axiosInstance.delete(`/friends/${friendshipId}`);
            set((state) => ({
                friends: state.friends.filter((f) => f.userId !== targetUserId),
                searchResults: state.searchResults.map((u) =>
                    u.userId === targetUserId
                        ? { ...u, friendshipStatus: 'none', friendshipId: null }
                        : u
                ),
            }));
            toast.success('Unfriended');
        } catch {
            toast.error('Failed to unfriend');
        }
    },

    // ── SPC-57 ────────────────────────────────────────────────────────────────

    searchUsers: async (q) => {
        if (!q.trim()) return set({ searchResults: [] });
        set({ searchLoading: true });
        try {
            const { data } = await axiosInstance.get('/friends/search', { params: { q } });
            set({ searchResults: data.data });
        } catch {
            toast.error('Search failed');
        } finally {
            set({ searchLoading: false });
        }
    },

    clearSearch: () => set({ searchResults: [] }),

    // ── SPC-18 ────────────────────────────────────────────────────────────────

    fetchActivity: async () => {
        try {
            const { data } = await axiosInstance.get('/friends/activity');
            set({ activity: data.data });
        } catch {
            // Silently fail — activity feed is non-critical
        }
    },

    // ── SPC-56 ────────────────────────────────────────────────────────────────

    sendInvite: async (friendId, roomId) => {
        try {
            await axiosInstance.post('/friends/invite', { friendId, roomId });
            toast.success('Invite sent');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ?? 'Failed to send invite';
            toast.error(msg);
        }
    },

    addPendingInvite: (invite) => {
        set((state) => ({ pendingInvites: [invite, ...state.pendingInvites] }));
    },

    dismissInvite: (inviteId) => {
        set((state) => ({
            pendingInvites: state.pendingInvites.filter((i) => i.inviteId !== inviteId),
        }));
    },
}));
