import { useState, useRef, useEffect } from 'react';
import { Send, Gem, Pin } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';

interface Props {
    onSendMessage: (message: string) => void;
    onPinMessage?: (messageId: string, message: string, userId: string, userName: string) => void;
    isCreator?: boolean;
}

const classifySystem = (text: string) => {
    const t = text.toLowerCase();
    if (t.includes('donated') || t.includes('tipped')) return { accent: 'oklch(0.88 0.12 75)', bg: 'oklch(0.82 0.15 75 / 0.08)', icon: '🪙' };
    if (t.includes('goal reached'))                      return { accent: 'oklch(0.74 0.14 160)', bg: 'oklch(0.74 0.14 160 / 0.08)', icon: '🎉' };
    if (t.includes('now playing'))                       return { accent: 'oklch(0.68 0.21 295)', bg: 'oklch(0.68 0.21 295 / 0.08)', icon: '🎵' };
    if (t.includes('joined'))                            return { accent: 'oklch(0.7 0.14 220)', bg: 'oklch(0.7 0.14 220 / 0.06)', icon: '👋' };
    if (t.includes('left'))                              return { accent: 'var(--fg-3)', bg: 'var(--ink-2)', icon: '💨' };
    return { accent: 'var(--fg-3)', bg: 'var(--ink-2)', icon: '—' };
};

export const ChatPanel = ({ onSendMessage, onPinMessage, isCreator }: Props) => {
    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement>(null);
    const { chatMessages } = useRoomStore();

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSendMessage(input.trim());
        setInput('');
    };

    return (
        <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-auto px-4 pt-4 pb-2 space-y-2.5 hide-scrollbar" style={{ minHeight: 0 }}>
                {chatMessages.length === 0 ? (
                    <p className="text-center text-[12px] mt-10" style={{ color: 'var(--fg-3)' }}>
                        No messages yet. Say hello!
                    </p>
                ) : (
                    chatMessages.map((msg) => {
                        if (msg.isSystem) {
                            const { accent, bg, icon } = classifySystem(msg.message);
                            return (
                                <div key={msg.id}
                                     className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-[12px]"
                                     style={{ background: bg, border: `1px solid ${accent}22`, color: accent }}>
                                    <span className="shrink-0">{icon}</span>
                                    <span className="leading-relaxed">{msg.message}</span>
                                </div>
                            );
                        }

                        const isTip = msg.message.startsWith('🪙') || msg.message.toLowerCase().includes('coin');
                        return (
                            <div key={msg.id} className="group flex items-start gap-2.5">
                                <div className="w-6 h-6 rounded-full shrink-0 mt-0.5 grid place-items-center text-[9px] font-bold text-white"
                                     style={{ background: `oklch(0.5 0.15 ${(msg.user?.username?.charCodeAt(0) ?? 65) * 17 % 360})` }}>
                                    {msg.user?.username?.[0]?.toUpperCase() ?? '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-[11px] font-medium text-[oklch(0.74_0.14_160)] mr-1.5">
                                        {msg.user?.username ?? 'Listener'}
                                    </span>
                                    {isTip ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[12px] text-[oklch(0.88_0.12_75)] bg-[oklch(0.82_0.15_75_/_0.12)] ring-1 ring-[oklch(0.82_0.15_75_/_0.25)]">
                                            <Gem className="size-2.5" /> {msg.message}
                                        </span>
                                    ) : (
                                        <span className="text-[13px] break-words leading-snug" style={{ color: 'var(--fg-1)' }}>
                                            {msg.message}
                                        </span>
                                    )}
                                </div>
                                {isCreator && onPinMessage && !msg.isSystem && (
                                    <button
                                        onClick={() => onPinMessage(msg.id, msg.message, msg.user?.id ?? '', msg.user?.username ?? '')}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 p-1 rounded-md hover:bg-white/10"
                                        title="Pin this message"
                                    >
                                        <Pin className="size-3 text-[var(--fg-3)]" />
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t hair flex-shrink-0">
                <div className="flex items-center gap-2 px-3 h-10 rounded-xl ring-1 ring-white/10 bg-white/5">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Say something…"
                        maxLength={500}
                        className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-[var(--fg-3)] text-white"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className="text-[var(--fg-2)] hover:text-white disabled:opacity-30 transition-colors"
                    >
                        <Send className="size-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
