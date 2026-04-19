// RoomInfoModal — accessible via the (i) button in RoomPage.
// Shows the room's enabled features so listeners know what they can do.
import { Info, Mic, MessageSquare, Coins, Vote, Gamepad2, Music2, Radio } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import type { RoomInfo, RoomFeatureFlags } from '@/types/types'
import { cn } from '@/lib/utils'

const DEFAULT_FLAGS: RoomFeatureFlags = {
    liveMic:    true,
    chat:       true,
    donations:  true,
    voting:     true,
    minigames:  true,
    voteQueue:  true,
    broadcasts: true,
}

interface FeatureRow {
    key:   keyof RoomFeatureFlags
    icon:  React.ElementType
    label: string
    desc:  string
}

const FEATURES: FeatureRow[] = [
    { key: 'chat',       icon: MessageSquare, label: 'Live Chat',      desc: 'Send messages in real time'         },
    { key: 'voting',     icon: Vote,          label: 'Vote to Skip',   desc: 'Vote to skip the current song'      },
    { key: 'voteQueue',  icon: Music2,        label: 'Vote Queue',     desc: 'Nominate & vote songs into queue'   },
    { key: 'donations',  icon: Coins,         label: 'Donations',      desc: 'Send coins to support the creator'  },
    { key: 'minigames',  icon: Gamepad2,      label: 'Minigames',      desc: 'Participate in live mini-games'     },
    { key: 'liveMic',    icon: Mic,           label: 'Creator Mic',    desc: 'Creator can speak between songs'    },
    { key: 'broadcasts', icon: Radio,         label: 'Broadcasts',     desc: 'Creator can play pre-recorded clips'},
]

interface Props {
    room: RoomInfo
}

export const RoomInfoModal = ({ room }: Props) => {
    const flags = room.featureFlags ?? DEFAULT_FLAGS

    return (
        <Sheet>
            <SheetTrigger asChild>
                <button
                    className="flex items-center justify-center size-8 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 transition-colors"
                    title="Room info & features"
                >
                    <Info className="size-3.5 text-zinc-400" />
                </button>
            </SheetTrigger>

            <SheetContent side="right" className="w-[320px] bg-zinc-950 border-white/10 text-white">
                <SheetHeader className="mb-5">
                    <SheetTitle className="text-white text-base">{room.title}</SheetTitle>
                    {room.description && (
                        <p className="text-xs text-zinc-500 mt-1">{room.description}</p>
                    )}
                </SheetHeader>

                <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Enabled features</p>

                    {FEATURES.map(({ key, icon: Icon, label, desc }) => {
                        const enabled = flags[key]
                        return (
                            <div
                                key={key}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-xl border',
                                    enabled
                                        ? 'bg-white/5 border-white/10'
                                        : 'bg-zinc-900/50 border-white/5 opacity-50',
                                )}
                            >
                                <div className={cn(
                                    'size-7 rounded-lg flex items-center justify-center flex-shrink-0',
                                    enabled ? 'bg-violet-500/20' : 'bg-zinc-800',
                                )}>
                                    <Icon className={cn('size-3.5', enabled ? 'text-violet-400' : 'text-zinc-600')} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn('text-xs font-medium', enabled ? 'text-white' : 'text-zinc-600')}>{label}</p>
                                    <p className="text-[10px] text-zinc-600 truncate">{desc}</p>
                                </div>
                                <span className={cn(
                                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0',
                                    enabled
                                        ? 'bg-emerald-500/15 text-emerald-400'
                                        : 'bg-zinc-800 text-zinc-600',
                                )}>
                                    {enabled ? 'On' : 'Off'}
                                </span>
                            </div>
                        )
                    })}
                </div>
            </SheetContent>
        </Sheet>
    )
}
