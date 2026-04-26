import { useNavigate } from 'react-router-dom';
import { Radio, Users, Gem } from 'lucide-react';
import type { RoomInfo } from '@/types/types';

export const RoomResultCard = ({ room }: { room: RoomInfo }) => {
    const navigate = useNavigate();
    const isLive   = room.status === 'live';
    const song     = room.playlist[room.playback?.currentSongIndex ?? 0];

    return (
        <button
            onClick={() => navigate(`/rooms/${room._id}`)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 hover:bg-white/6 border border-white/8 hover:border-white/15 transition-all group text-left w-full"
        >
            <div className="relative flex-shrink-0">
                {song?.imageUrl
                    ? <img src={song.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                    : <div className="size-10 rounded-lg bg-zinc-800 flex items-center justify-center"><Radio className="size-4 text-zinc-600" /></div>
                }
                {isLive && (
                    <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-red-500 border-2 border-zinc-950" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">{room.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                    {isLive
                        ? <span className="text-[10px] text-red-400 font-semibold">LIVE</span>
                        : <span className="text-[10px] text-zinc-600">Offline</span>
                    }
                    {isLive && (
                        <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                            <Users className="size-2.5" />{(room.listenerCount ?? 0)}
                        </span>
                    )}
                    {room.streamGoal > 0 && (
                        <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                            <Gem className="size-2.5 text-yellow-600" />{room.streamGoalCurrent.toLocaleString()}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};
