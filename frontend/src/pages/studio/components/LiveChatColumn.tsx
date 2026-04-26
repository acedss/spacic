import { useEffect, useRef } from 'react';
import { Crown, Gem, Send, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { ChatMessage } from '@/types/types';
import { StatBadge } from './StatBadge';
import type { LiveStats } from './live-shared';

interface Props {
    messages: ChatMessage[];
    chatInput: string;
    setChatInput: (v: string) => void;
    onSend: () => void;
    creatorId: string;
    stats: LiveStats;
}

export const LiveChatColumn = ({ messages, chatInput, setChatInput, onSend, creatorId, stats }: Props) => {
    const chatEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex flex-col p-5 gap-3 overflow-hidden">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex-shrink-0">
                Live Chat
            </h2>

            <div className="flex md:hidden items-center gap-2 flex-shrink-0 flex-wrap">
                <StatBadge icon={Users} value={stats.listenerCount} label="listeners" color="text-blue-400" />
                <StatBadge icon={Gem} value={stats.coinsThisSession.toLocaleString()} label="coins" color="text-yellow-400" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
                {messages.length === 0 && (
                    <p className="text-zinc-600 text-xs text-center pt-8">Chat will appear here</p>
                )}
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={cn('px-3 py-2 rounded-xl', msg.isSystem ? 'bg-white/3 text-zinc-500' : 'bg-white/5')}
                    >
                        {!msg.isSystem && (
                            <div className="flex items-center gap-1.5 mb-0.5">
                                {msg.user.imageUrl && (
                                    <img src={msg.user.imageUrl} className="size-4 rounded-full" alt="" />
                                )}
                                <span className="text-xs font-semibold text-violet-400">{msg.user.username}</span>
                                {msg.user.id === creatorId && (
                                    <Crown className="size-3 text-yellow-400" />
                                )}
                            </div>
                        )}
                        <p className="text-sm text-zinc-200 break-words">{msg.message}</p>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 flex-shrink-0">
                <Input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
                    }}
                    placeholder="Say something…"
                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 flex-1"
                />
                <button
                    onClick={onSend}
                    disabled={!chatInput.trim()}
                    className="p-2.5 bg-white/10 hover:bg-white/15 disabled:opacity-40 border border-white/10 rounded-xl transition-colors"
                >
                    <Send className="size-4 text-white" />
                </button>
            </div>
        </div>
    );
};
