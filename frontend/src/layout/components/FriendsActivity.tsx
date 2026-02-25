

import { Share2 } from 'lucide-react'

interface Friend {
    id: string
    name: string
    activity: string
    album: string
    avatar: string
    isOnline: boolean
}

const friendsData: Friend[] = [
    {
        id: '1',
        name: 'Emma Wilson',
        activity: 'Listening to Neon Dreams',
        album: 'The Synthwave Collective',
        avatar: '🥰',
        isOnline: true
    },
    {
        id: '2',
        name: 'Jake Martinez',
        activity: 'Vibing to Electric Echoes',
        album: 'The Indie Waves',
        avatar: '👤',
        isOnline: true
    },
    {
        id: '3',
        name: 'Sophie Chen',
        activity: 'Rocking to Chill Vibes Only',
        album: 'Lo-Fi Beats Collective',
        avatar: '👤',
        isOnline: false
    },
    {
        id: '4',
        name: 'Alex Turner',
        activity: 'Disc Joon 2 hours Ago',
        album: '',
        avatar: '👤',
        isOnline: false
    },
    {
        id: '5',
        name: 'Maria Rodriguez',
        activity: 'Last seen 3 months ago',
        album: '',
        avatar: '👤',
        isOnline: false
    }
]

export const FriendsActivity = () => {
    return (
        <div className='bg-black/40 rounded-lg p-4 h-full flex flex-col'>
            <h2 className='text-white font-semibold mb-4'>Friends Activity</h2>

            <div className='flex-1 space-y-4 overflow-y-auto p-2'>
                {friendsData.map(friend => (
                    <div key={friend.id} className='flex items-start gap-3'>
                        <div className='relative'>
                            <div className='w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl'>
                                {friend.avatar}
                            </div>
                            {friend.isOnline && (
                                <div className='absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black'></div>
                            )}
                        </div>
                        <div className='flex-1 min-w-0'>
                            <p className='text-white text-sm font-medium'>{friend.name}</p>
                            <p className='text-gray-400 text-xs truncate'>{friend.activity}</p>
                            {friend.album && (
                                <p className='text-gray-500 text-xs truncate'>{friend.album}</p>
                            )}
                            {friend.isOnline && (
                                <button className='mt-1 text-xs text-white bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded-full transition-colors'>
                                    Join Room
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className='mt-4 pt-4 border-t border-gray-700'>
                <p className='text-gray-300 text-sm mb-3'>Invite Friends</p>
                <p className='text-gray-500 text-xs mb-3'>Share CoListen and earn bonus coins</p>
                <button className='w-full bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-2 px-4 rounded-full flex items-center justify-center gap-2 transition-all'>
                    <Share2 className='size-4' />
                    Share Now
                </button>
            </div>
        </div>
    )
}
