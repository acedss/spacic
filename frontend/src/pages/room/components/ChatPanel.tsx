import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
    onSendMessage: (message: string) => void;
}

// Classify system messages by keyword for styled display
const classifySystem = (text: string): { color: string; icon: string } => {
    const t = text.toLowerCase();
    if (t.includes('donated'))       return { color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: '🪙' };
    if (t.includes('goal reached'))  return { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: '🎉' };
    if (t.includes('now playing'))   return { color: 'text-violet-300 bg-violet-500/10 border-violet-500/20', icon: '🎵' };
    if (t.includes('joined'))        return { color: 'text-blue-300 bg-blue-500/8 border-blue-500/15', icon: '👋' };
    if (t.includes('left'))          return { color: 'text-zinc-500 bg-white/3 border-white/8', icon: '💨' };
    if (t.includes('stream goal'))   return { color: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20', icon: '🎯' };
    return { color: 'text-zinc-500 bg-white/3 border-white/8', icon: '—' };
};

export const ChatPanel = ({ onSendMessage }: Props) => {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { chatMessages } = useRoomStore();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSendMessage(input.trim());
        setInput('');
    };

    return (
        <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-3 space-y-1.5">
                    {chatMessages.length === 0 ? (
                        <p className="text-center text-zinc-600 text-xs mt-10">
                            No messages yet. Say hello!
                        </p>
                    ) : (
                        chatMessages.map((msg) => {
                            if (msg.isSystem) {
                                const { color, icon } = classifySystem(msg.message);
                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${color}`}
                                    >
                                        <span className="flex-shrink-0">{icon}</span>
                                        <span className="leading-relaxed">{msg.message}</span>
                                    </div>
                                );
                            }
                            return (
                                <div key={msg.id} className="flex items-start gap-2 px-1 py-1 group">
                                    <div className="flex-1 min-w-0">
                                        <span className="text-xs font-semibold text-emerald-400 mr-1.5">
                                            {msg.user.username}
                                        </span>
                                        <span className="text-xs text-zinc-200 break-words">{msg.message}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            <div className="p-2.5 border-t border-white/5 flex gap-2 flex-shrink-0">
                <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Say something..."
                    maxLength={500}
                    className="flex-1 bg-zinc-800 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-white/20 h-8 text-xs"
                />
                <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="p-2 bg-white/10 hover:bg-white/15 disabled:opacity-40 border border-white/10 rounded-lg transition-colors flex-shrink-0"
                >
                    <Send className="size-3.5 text-white" />
                </button>
            </div>
        </div>
    );
};
