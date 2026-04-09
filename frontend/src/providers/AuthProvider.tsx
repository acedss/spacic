import { axiosInstance } from "@/lib/axios"
import { useAuth, useUser } from "@clerk/clerk-react"
import { useState, useEffect } from "react"
import { Loader } from "lucide-react"
import { useAuthStore } from "@/stores/useAuthStore";

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const { getToken, userId } = useAuth()
    const { user } = useUser()
    const [loading, setLoading] = useState(true)
    const { checkAdminStatus } = useAuthStore()

    useEffect(() => {
        // Attach a request interceptor so every axios call gets a fresh token.
        // Clerk's getToken() caches internally and only refreshes when near expiry.
        // Interceptor is set up once on mount; getToken reference is captured via closure.
        const interceptorId = axiosInstance.interceptors.request.use(async (config) => {
            try {
                const token = await getToken();
                if (token) config.headers['Authorization'] = `Bearer ${token}`;
            } catch {
                // proceed without auth header if token fetch fails
            }
            return config;
        });

        return () => {
            axiosInstance.interceptors.request.eject(interceptorId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // interceptor set up once — getToken is stable via closure

    // Ensure the user exists in MongoDB whenever they're authenticated.
    // Handles cases where /auth-callback was never visited (deep links, existing sessions).
    useEffect(() => {
        if (!userId || !user) return;
        axiosInstance.post('/auth/callback', {
            clerkId: user.id,
            fullName: user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown',
            imageUrl: user.imageUrl,
            role: 'USER',
            username: user.username ?? undefined,
        }).catch(() => {}); // fire-and-forget — non-blocking
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    useEffect(() => {
        // Re-check admin status only when the logged-in user changes.
        // getToken and checkAdminStatus are intentionally excluded — both are stable
        // references that don't affect when the check should run.
        const initAuth = async () => {
            try {
                if (userId) await checkAdminStatus();
            } catch (error) {
                console.log("Error in auth provider ", error)
            } finally {
                setLoading(false)
            }
        };
        initAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);
    if (loading) return (
        <div className="flex items-center justify-center w-full h-screen">
            <Loader className="size-8 text-emerald-50 animate-spin" />
        </div>
    )

    return <>{children}</>;
}
export default AuthProvider
