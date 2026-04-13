interface AlbumGoalCardProps {
    title: string
    artist: string
    cover: string
    raised: number
    goal: number
}

export const AlbumGoalCard = ({ title, artist, cover, raised, goal }: AlbumGoalCardProps) => {
    const progress = Math.min((raised / goal) * 100, 100)
    const isComplete = raised >= goal

    return (
        <div className='bg-zinc-900/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center text-center space-y-4'>
            <img src={cover} alt={title} className='w-full aspect-square object-cover rounded-xl' />
            <div>
                <h4 className='font-medium text-sm'>{title}</h4>
                <p className='text-[11px] text-zinc-500'>{artist}</p>
            </div>
            <div className='w-full px-2'>
                <div className='flex justify-between text-[10px] mb-1.5 font-semibold'>
                    <span>${raised.toLocaleString()}</span>
                    <span className='text-zinc-500'>${goal.toLocaleString()}</span>
                </div>
                {isComplete ? (
                    <div className='h-1 bg-green-500 rounded-full' />
                ) : (
                    <div className='h-1 bg-white/5 rounded-full overflow-hidden'>
                        <div className='bg-white/40 h-full rounded-full' style={{ width: `${progress}%` }} />
                    </div>
                )}
            </div>
            <button className='text-xs font-semibold py-2 px-6 rounded-full border border-white/10 hover:bg-white/5 transition-colors'>
                View Goal
            </button>
        </div>
    )
}
