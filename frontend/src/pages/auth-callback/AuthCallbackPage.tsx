import { axiosInstance } from '@/lib/axios'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'


const AuthCallbackPage = () => {

    const { isLoaded, user } = useUser()
    const navigate = useNavigate()
    // AuthCallbackPage.tsx
    useEffect(() => {
        const syncUser = async () => {
            // Log để kiểm tra trạng thái
            console.log('Checking Clerk status:', { isLoaded, user });

            if (!isLoaded || !user) return; // Nếu chưa load xong thì thoát để chờ lần chạy sau

            try {
                const response = await axiosInstance.post('/auth/callback', {
                    clerkId: user.id,
                    fullName: user.fullName || `${user.firstName} ${user.lastName}`, // Đảm bảo không bị null
                    imageUrl: user.imageUrl,
                    role: 'USER', // Gửi role mặc định
                });
                console.log('Sync Successful:', response.data);
            } catch (error) {
                console.error('Sync Error:', error);
            } finally {
                navigate("/");
            }
        };

        syncUser();
    }, [isLoaded, user, navigate]); // QUAN TRỌNG: Phải có isLoaded và user ở đây

    return (
        <div>AuthCallbackPage</div>
    )
}
export default AuthCallbackPage