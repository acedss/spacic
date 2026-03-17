import { Bell, Share2, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const OnlineDot = ({ online }: { online: boolean }) => (
    <span
        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${online ? 'bg-green-500' : 'bg-zinc-500'}`}
    />
)

export const FriendsActivity = () => {
    return (
        <div className='flex flex-col h-full'>

            {/* Header */}
            <div className='px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0 rounded-t-2xl'>
                <h3 className='font-semibold text-base tracking-tight'>Social Feed</h3>
                <Bell className='size-4 text-zinc-400' />
            </div>

            <div className='flex-1 overflow-y-auto px-4 py-6 space-y-6'>

                {/* Emma – listening live */}
                <div className='flex gap-3'>
                    <Avatar className='w-8 h-8 shrink-0'>
                        <AvatarImage src='https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-1.png' alt='Emma Wilson' />
                        <AvatarFallback className='text-xs'>EW</AvatarFallback>
                        <OnlineDot online />
                    </Avatar>
                    <div className='flex flex-col gap-1 flex-1 min-w-0'>
                        <span className='text-xs font-semibold truncate'>Emma Wilson</span>
                        <p className='text-[10px] text-zinc-400 leading-snug'>
                            Listening to <span className='text-white'>Midnight Dreams</span>
                        </p>
                        <button className='text-[10px] font-bold text-blue-400 mt-1 uppercase tracking-widest text-left'>
                            Join Room
                        </button>
                    </div>
                </div>

                {/* Sophie – room invite card */}
                <div className='bg-zinc-900 p-4 rounded-xl border border-blue-500/20 space-y-3 relative overflow-hidden'>
                    <span className='absolute top-2 right-2 text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase'>
                        Invite
                    </span>
                    <div className='flex gap-3'>
                        <Avatar className='w-8 h-8 shrink-0'>
                            <AvatarImage src='https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-3.png' alt='Sophie Chen' />
                            <AvatarFallback className='text-xs'>SC</AvatarFallback>
                            <OnlineDot online />
                        </Avatar>
                        <div className='flex flex-col min-w-0'>
                            <span className='text-xs font-semibold truncate'>Sophie Chen</span>
                            <p className='text-[10px] text-zinc-400'>Invited you to jam</p>
                        </div>
                    </div>
                    <div className='flex gap-2'>
                        <button className='flex-1 py-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-md'>
                            Accept
                        </button>
                        <button className='px-3 py-1.5 bg-white/5 rounded-md'>
                            <X className='size-3.5' />
                        </button>
                    </div>
                </div>

                {/* Jake – away */}
                <div className='flex gap-3 opacity-60'>
                    <Avatar className='w-8 h-8 shrink-0'>
                        <AvatarImage src='https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-2.png' alt='Jake Martinez' />
                        <AvatarFallback className='text-xs'>JM</AvatarFallback>
                        <OnlineDot online={false} />
                    </Avatar>
                    <div className='flex flex-col gap-1 flex-1 min-w-0'>
                        <span className='text-xs font-semibold truncate'>Jake Martinez</span>
                        <p className='text-[10px] text-zinc-400'>Away • 2h ago</p>
                    </div>
                </div>

                {/* Grow Community */}
                <div className='pt-4 border-t border-white/5'>
                    <div className='p-4 rounded-xl bg-white/5 space-y-3'>
                        <h4 className='text-[10px] font-bold uppercase tracking-widest text-zinc-400'>
                            Grow Community
                        </h4>
                        <p className='text-[10px] text-zinc-500 leading-relaxed'>
                            Share your profile link to earn bonus coins.
                        </p>
                        <button className='w-full flex items-center justify-center gap-2 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-semibold transition-all'>
                            <Share2 className='size-3.5' />
                            Copy Link
                        </button>
                    </div>
                </div>

            </div>
        </div>
    )
}
