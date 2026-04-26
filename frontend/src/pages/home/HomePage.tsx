import { useAuth } from '@clerk/clerk-react'
import { useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useState } from 'react'
import { useWalletStore } from '@/stores/useWalletStore'
import { getFavoriteStatus, getPublicRooms, toggleFavorite } from '@/lib/roomService'
import { useSocialSocket } from '@/providers/SocialSocketProvider'
import { axiosInstance } from '@/lib/axios'
import { toast } from 'sonner'

import type { RoomData } from './components/shared'
import { OnboardingBanner } from './components/OnboardingBanner'
import { HomeHeader } from './components/HomeHeader'
import { HeroSection } from './components/HeroSection'
import { LiveNowSection } from './components/LiveNowSection'
import { TasteRowSection } from './components/TasteRowSection'
import { FriendsActivitySection } from './components/FriendsActivitySection'
import { StationOfTheWeekSection } from './components/StationOfTheWeekSection'
import { CreatorGoalsSection } from './components/CreatorGoalsSection'
import { MoodsGridSection } from './components/MoodsGridSection'
import { HomeFooter } from './components/HomeFooter'

const HomePage = () => {
    const { userId } = useAuth()
    const { fetchWallet } = useWalletStore()
    const navigate = useNavigate()
    const socket = useSocialSocket()

    const [rooms, setRooms] = useState<RoomData[]>([])
    const [loading, setLoading] = useState(true)
    const [featuredFav, setFeaturedFav] = useState(false)
    const [filter, setFilter] = useState<'All' | 'For you' | 'Friends' | 'Nearby'>('All')
    const [showOnboardingBanner, setShowOnboardingBanner] = useState(false)

    const openSearch = useCallback(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
    }, [])

    const refreshRooms = async () => {
        try {
            const res = await getPublicRooms({ limit: 12, sort: 'listener_count' })
            setRooms(res.data ?? [])
        } catch { /* handled */ }
    }

    useEffect(() => { fetchWallet() }, [fetchWallet])

    useEffect(() => {
        refreshRooms().finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        if (!userId) return
        axiosInstance.get('/auth/onboarding/status')
            .then(({ data }) => { if (!data.onboardingCompleted) setShowOnboardingBanner(true) })
            .catch(() => { })
    }, [userId])

    useEffect(() => {
        if (!socket) return
        const onStatus = () => refreshRooms()
        socket.on('creator:room_live', onStatus)
        socket.on('creator:room_offline', onStatus)
        return () => { socket.off('creator:room_live', onStatus); socket.off('creator:room_offline', onStatus) }
    }, [socket])

    useEffect(() => {
        if (!userId || rooms.length === 0) return
        getFavoriteStatus(rooms[0]._id).then(setFeaturedFav).catch(() => { })
    }, [userId, rooms])

    const handleJoin = (id: string) => navigate(`/rooms/${id}`)

    const handleFeaturedFav = async () => {
        if (!userId) { navigate('/sign-in'); return }
        try {
            const { favorited } = await toggleFavorite(rooms[0]._id)
            setFeaturedFav(favorited)
            toast.success(favorited ? 'Added to favorites' : 'Removed from favorites')
        } catch { toast.error('Could not update favorites') }
    }

    const featured = rooms[0]
    const liveNow = rooms.slice(1)
    const tasteRooms = rooms.slice(2, 7)

    return (
        <div className="relative" style={{ background: 'var(--ink-0)', minHeight: '100vh' }}>
            {showOnboardingBanner && <OnboardingBanner onDismiss={() => setShowOnboardingBanner(false)} />}
            <HomeHeader onSearchOpen={openSearch} />
            <HeroSection
                rooms={rooms}
                featured={featured}
                loading={loading}
                featuredFav={featuredFav}
                onJoin={handleJoin}
                onFavorite={handleFeaturedFav}
            />
            <LiveNowSection
                liveNow={liveNow}
                loading={loading}
                filter={filter}
                setFilter={setFilter}
                onJoin={handleJoin}
            />
            <TasteRowSection rooms={rooms} tasteRooms={tasteRooms} loading={loading} onJoin={handleJoin} />
            <FriendsActivitySection rooms={rooms} loading={loading} onJoin={handleJoin} />
            {featured && <StationOfTheWeekSection featured={featured} onJoin={handleJoin} />}
            <CreatorGoalsSection />
            <MoodsGridSection />
            <HomeFooter />
        </div>
    )
}

export default HomePage
