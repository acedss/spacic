import { axiosInstance } from "@/lib/axios"
import { useAuth } from "@clerk/clerk-react"
import { useState, useEffect } from "react"
import { Loader } from "lucide-react"
import { useAuthStore } from "@/stores/useAuthStore";

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const { getToken, userId } = useAuth()
    const [loading, setLoading] = useState(true)
    const { checkAdminStatus } = useAuthStore()

    useEffect(() => {
        // Attach a request interceptor so every axios call gets a fresh token.
        // Clerk's getToken() caches internally and only refreshes when near expiry.
        const interceptorId = axiosInstance.interceptors.request.use(async (config) => {
            try {
                const token = await getToken();
                if (token) config.headers['Authorization'] = `Bearer ${token}`;
            } catch {
                // proceed without auth header if token fetch fails
            }
            return config;
        });

        const initAuth = async () => {
            try {
                const token = await getToken()
                if (token) await checkAdminStatus();
            } catch (error) {
                console.log("Error in auth provider ", error)
            } finally {
                setLoading(false)
            }
        };
        initAuth();

        return () => {
            axiosInstance.interceptors.request.eject(interceptorId);
        }

    }, [getToken, checkAdminStatus, userId])
    if (loading) return (
        <div className="flex items-center justify-center w-full h-screen">
            <Loader className="size-8 text-emerald-50 animate-spin" />
        </div>
    )

    return <>{children}</>;
}
export default AuthProvider
