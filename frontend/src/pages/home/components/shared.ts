export const FALLBACK = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80'

export const COVER_FALLBACKS = [
    'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&q=70',
    'https://images.unsplash.com/photo-1496293455970-f8581aae0e3b?w=400&q=70',
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=70',
    'https://images.unsplash.com/photo-1429552077091-836152271555?w=400&q=70',
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=70',
]

export const MOODS = ['Late Night', 'Ambient', 'Indie', 'R&B', 'Focus', 'Hype', 'Chill', 'Jazz', 'Electronic', 'Acoustic', 'Soul', 'Lo-fi']

export const STATIC_GOALS = [
    { title: 'Debut LP — mixing & mastering', artist: 'Remy Okafor', cover: COVER_FALLBACKS[0], raised: 3020, goal: 4200, days: 12 },
    { title: 'Tour van fuel fund', artist: 'Iris Holm', cover: COVER_FALLBACKS[1], raised: 740, goal: 1800, days: 22 },
    { title: 'Studio time · 3 days at Electric Pine', artist: 'Noa Tanaka', cover: COVER_FALLBACKS[2], raised: 855, goal: 900, days: 3 },
]

export interface RoomData {
    _id: string
    title: string
    description: string
    listenerCount: number
    streamGoal: number
    streamGoalCurrent: number
    coverImageUrl?: string
    playlist: { _id: string; title: string; artist: string; imageUrl: string }[]
    creatorId: { fullName: string; imageUrl: string }
}

export const goalPct = (r: RoomData) =>
    r.streamGoal > 0 ? Math.min(100, Math.round((r.streamGoalCurrent / r.streamGoal) * 100)) : 0

export const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 5) return 'Still up'
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    if (h < 22) return 'Good evening'
    return 'Late night'
}
