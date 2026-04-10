import { axiosInstance } from "@/lib/axios";
import { create } from "zustand";

interface AuthStore {
    isAdmin: boolean;
    isLoading: boolean;
    error: string | null;

    checkAdminStatus: () => Promise<void>;
    reset: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
    isAdmin: false,
    isLoading: false,
    error: null,

    checkAdminStatus: async () => {
        set({ isLoading: true, error: null });
        try {
            const response = await axiosInstance.get("/admin/check");
            set({ isAdmin: Boolean(response.data?.admin), error: null });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            const status = error?.response?.status;
            // Non-admin or unauthenticated should not be treated as app errors.
            if (status === 401 || status === 403) {
                set({ isAdmin: false, error: null });
            } else {
                set({ isAdmin: false, error: error?.response?.data?.message ?? "Failed to check admin status" });
            }
        } finally {
            set({ isLoading: false });
        }
    },

    reset: () => {
        set({ isAdmin: false, isLoading: false, error: null });
    },
}));
