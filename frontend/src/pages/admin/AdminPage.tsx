import { useAuthStore } from '@/stores/useAuthStore'

export const AdminPage = () => {
    const { isAdmin, isLoading } = useAuthStore()
    console.log(isAdmin);

    if (!isAdmin && !isLoading) return <div>Unauthorized</div>


    return (
        <div className='min-h-screen p-8 bg-fixed bg-linear-to-b from-black via-purple-900 to-black text-zinc-100'>

        </div>
    )
}
