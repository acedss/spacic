import { axiosInstance } from '@/lib/axios'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { Loader } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const AuthCallbackPage = () => {

    const { isLoaded, user } = useUser()
    const navigate = useNavigate()

    useEffect(() => {
        const syncUser = async () => {
            console.log('Checking Clerk status:', { isLoaded, user });
            if (!isLoaded || !user) return;
            try {
                await axiosInstance.post('/auth/callback', {
                    clerkId: user.id,
                    fullName: user.fullName || `${user.firstName} ${user.lastName}`,
                    imageUrl: user.imageUrl,
                    role: 'USER',
                });
            } catch (error) {
                console.error('Sync Error:', error);
            } finally {
                // navigate("/");
                setTimeout(() => {
                    navigate("/");
                }, 10000); // Fallback navigation after 10 seconds
            }
        };
        syncUser();
    }, [isLoaded, user, navigate]);
    return (
        <div className="flex items-center justify-center w-full h-screen bg-black">
            <Card className="w-[90%] max-w-md bg-zinc-900 border-zinc-800">
                <CardContent className="flex flex-col items-center gap-4 pt-6">
                    <Loader className="size-6 text-emerald-500 animate-spin"></Loader>
                    <h3 className="text-xl font-bold text-zinc-400">Logging you in</h3>
                    <p className="text-sm text-zinc-400">Redirecting...</p>
                </CardContent>
            </Card>
        </div>
    )
}
export default AuthCallbackPage