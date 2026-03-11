import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useRoomStore } from '@/stores/useRoomStore';

interface Props {
    onSendMessage: (message: string) => void;
}

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
        <div className="flex flex-col h-full bg-zinc-900 rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex-shrink-0">
                <h3 className="text-sm font-semibold text-zinc-300">Live Chat</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
                {chatMessages.length === 0 ? (
                    <p className="text-center text-zinc-600 text-xs mt-8">
                        No messages yet. Say hello!
                    </p>
                ) : (
                    chatMessages.map((msg) => (
                        <div key={msg.id} className={`text-sm ${msg.isSystem ? 'italic text-zinc-500' : ''}`}>
                            {msg.isSystem ? (
                                <span className="text-zinc-500">⸻ {msg.message}</span>
                            ) : (
                                <>
                                    <span className="font-medium text-emerald-400">{msg.user.username}</span>
                                    <span className="text-zinc-500">: </span>
                                    <span className="text-zinc-200 break-words">{msg.message}</span>
                                </>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-white/5 flex gap-2 flex-shrink-0">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Say something..."
                    maxLength={500}
                    className="flex-1 bg-zinc-800 text-sm text-white rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-white/20 placeholder:text-zinc-600"
                />
                <button
                    onClick={handleSend}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                >
                    <Send className="size-4" />
                </button>
            </div>
        </div>
    );
};
