import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { createMinigame, deleteMinigame } from '@/lib/minigameService';
import type { Minigame, MinigameType, MinigameTriggerType } from '@/types/types';
import { Card, FieldLabel, SectionHead } from './studio-atoms';
import { GAME_TYPES, STATUS_COLORS, TRIGGER_TYPES } from './studio-shared';

interface Props {
    roomId: string | undefined;
    isLive: boolean;
    minigames: Minigame[];
    setMinigames: React.Dispatch<React.SetStateAction<Minigame[]>>;
    minigamesLoading: boolean;
}

export const MinigamesTab = ({ roomId, isLive, minigames, setMinigames, minigamesLoading }: Props) => {
    const navigate = useNavigate();
    const hasRoom = !!roomId;

    const [showForm, setShowForm] = useState(false);
    const [type, setType] = useState<MinigameType>('song_guesser');
    const [title, setTitle] = useState('');
    const [trigger, setTrigger] = useState<MinigameTriggerType>('manual');
    const [songIndex, setSongIndex] = useState('');
    const [duration, setDuration] = useState('30');
    const [coinReward, setCoinReward] = useState('0');
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [lyric, setLyric] = useState('');
    const [options, setOptions] = useState(['', '', '', '']);
    const [correctOption, setCorrectOption] = useState(0);
    const [saving, setSaving] = useState(false);

    const buildConfig = () => {
        if (type === 'lyric_fill') return { lyric, answer };
        if (type === 'trivia') return { question, options, correctOption };
        if (type === 'song_guesser') return { answer };
        return {};
    };

    const handleCreate = async () => {
        if (!title.trim() || !roomId) return;
        setSaving(true);
        try {
            const g = await createMinigame(roomId, {
                type,
                title: title.trim(),
                trigger: {
                    type: trigger,
                    songIndex: trigger !== 'manual' && songIndex ? parseInt(songIndex, 10) : null,
                },
                durationSeconds: parseInt(duration, 10) || 30,
                coinReward: parseInt(coinReward, 10) || 0,
                config: buildConfig(),
            });
            setMinigames(prev => [g, ...prev]);
            setShowForm(false);
            setTitle('');
            toast.success('Minigame saved');
        } catch { toast.error('Failed to save minigame'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this minigame?')) return;
        try {
            await deleteMinigame(id);
            setMinigames(prev => prev.filter(g => g._id !== id));
            toast.success('Minigame deleted');
        } catch { toast.error('Failed to delete minigame'); }
    };

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <SectionHead label="Minigames" sub="Schedule games or trigger manually during a live session" />
                {hasRoom && (
                    <button onClick={() => setShowForm(p => !p)}
                        className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white bg-white/8 ring-1 ring-white/10 hover:bg-white/12 press">
                        <Plus className="size-3.5" /> New Game
                    </button>
                )}
            </div>

            {!hasRoom && (
                <Card className="py-16 text-center">
                    <p className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>Create a channel first in Settings</p>
                </Card>
            )}

            {showForm && hasRoom && (
                <Card className="space-y-4">
                    <p className="text-[14px] font-semibold text-white">Create Minigame</p>

                    <div>
                        <FieldLabel>Game title</FieldLabel>
                        <Input placeholder="e.g. Song Blitz Round 1" value={title} onChange={e => setTitle(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                    </div>

                    <div>
                        <FieldLabel>Game type</FieldLabel>
                        <div className="grid grid-cols-2 gap-2">
                            {GAME_TYPES.map(gt => (
                                <button key={gt.value} onClick={() => setType(gt.value)}
                                    className={cn(
                                        'p-3 rounded-xl ring-1 text-left transition-all press',
                                        type === gt.value
                                            ? 'ring-[oklch(0.72_0.22_295_/_0.5)] bg-[oklch(0.55_0.18_295_/_0.12)] text-white'
                                            : 'ring-white/8 text-white/50 hover:ring-white/20'
                                    )}>
                                    <p className="text-[13px] font-medium">{gt.label}</p>
                                    <p className="mono text-[10px] mt-0.5 opacity-70">{gt.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {type === 'song_guesser' && (
                        <div>
                            <FieldLabel>Correct song title</FieldLabel>
                            <Input placeholder="Case-insensitive match" value={answer} onChange={e => setAnswer(e.target.value)}
                                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                        </div>
                    )}
                    {type === 'lyric_fill' && (
                        <div className="space-y-2">
                            <div>
                                <FieldLabel>Lyric with blank</FieldLabel>
                                <Input placeholder='e.g. "Never gonna give you ___"' value={lyric} onChange={e => setLyric(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                            </div>
                            <div>
                                <FieldLabel>Correct answer</FieldLabel>
                                <Input placeholder="up" value={answer} onChange={e => setAnswer(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                            </div>
                        </div>
                    )}
                    {type === 'trivia' && (
                        <div className="space-y-2">
                            <div>
                                <FieldLabel>Question</FieldLabel>
                                <Input placeholder="What year did this album drop?" value={question} onChange={e => setQuestion(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                            </div>
                            {options.map((opt, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <button onClick={() => setCorrectOption(i)}
                                        className={cn('size-5 rounded-full ring-2 shrink-0 transition-colors press',
                                            correctOption === i ? 'ring-[oklch(0.75_0.14_160)] bg-[oklch(0.75_0.14_160)]' : 'ring-white/20'
                                        )} />
                                    <Input placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt}
                                        onChange={e => setOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                                        className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20 flex-1" />
                                </div>
                            ))}
                            <p className="mono text-[10px]" style={{ color: 'var(--fg-3)' }}>Circle = correct answer</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <FieldLabel>Trigger</FieldLabel>
                            <select value={trigger} onChange={e => setTrigger(e.target.value as MinigameTriggerType)}
                                className="w-full h-9 rounded-xl ring-1 ring-white/10 px-3 text-[13px] outline-none"
                                style={{ background: 'var(--ink-1)', color: 'var(--fg-2)' }}>
                                {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        {trigger !== 'manual' && (
                            <div>
                                <FieldLabel>Song index (0-based)</FieldLabel>
                                <Input type="number" min="0" placeholder="2" value={songIndex} onChange={e => setSongIndex(e.target.value)}
                                    className="h-9 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus-visible:ring-white/20" />
                            </div>
                        )}
                        <div>
                            <FieldLabel>Duration (seconds)</FieldLabel>
                            <Input type="number" min="10" max="120" value={duration} onChange={e => setDuration(e.target.value)}
                                className="h-9 bg-white/5 border-white/10 text-white focus-visible:ring-white/20" />
                        </div>
                        <div>
                            <FieldLabel>Coin reward (winner)</FieldLabel>
                            <Input type="number" min="0" value={coinReward} onChange={e => setCoinReward(e.target.value)}
                                className="h-9 bg-white/5 border-white/10 text-white focus-visible:ring-white/20" />
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowForm(false)} className="h-9 px-4 rounded-xl text-[13px] press hover:bg-white/5" style={{ color: 'var(--fg-3)' }}>Cancel</button>
                        <button onClick={handleCreate} disabled={saving || !title.trim()}
                            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] text-white disabled:opacity-50 press"
                            style={{ background: 'oklch(0.55 0.18 295)' }}>
                            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Game
                        </button>
                    </div>
                </Card>
            )}

            {minigamesLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl bg-white/5" />)}</div>
            ) : minigames.length === 0 && hasRoom ? (
                <Card className="py-16 text-center">
                    <p className="mono text-[11px]" style={{ color: 'var(--fg-3)' }}>No minigames yet — create one above</p>
                </Card>
            ) : (
                <div className="space-y-2">
                    {minigames.map(g => (
                        <div key={g._id} className="rounded-2xl ring-1 ring-white/8 px-5 py-3.5 flex items-center gap-4" style={{ background: 'var(--ink-2)' }}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-[14px] font-semibold text-white">{g.title}</p>
                                    <span className={cn('mono text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full', STATUS_COLORS[g.status] ?? '')}>{g.status}</span>
                                </div>
                                <p className="mono text-[10px] mt-0.5" style={{ color: 'var(--fg-3)' }}>
                                    {GAME_TYPES.find(t => t.value === g.type)?.label} ·{' '}
                                    {g.trigger.type === 'manual' ? 'Manual trigger' : `${g.trigger.type.replace('_', ' ')} song ${g.trigger.songIndex}`} ·{' '}
                                    {g.durationSeconds}s · {g.coinReward > 0 ? `${g.coinReward} coins` : 'No reward'}
                                </p>
                            </div>
                            <button onClick={() => handleDelete(g._id)} className="press hover:text-[oklch(0.72_0.22_20)] transition-colors shrink-0" style={{ color: 'var(--fg-3)' }}>
                                <Trash2 className="size-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {isLive && (
                <div className="flex items-center gap-3 rounded-2xl px-5 py-3 ring-1 ring-[oklch(0.55_0.18_250_/_0.3)]"
                    style={{ background: 'oklch(0.55 0.18 250 / 0.08)' }}>
                    <Gamepad2 className="size-4 text-[oklch(0.75_0.1_250)]" />
                    <p className="text-[13px] text-[oklch(0.75_0.1_250)]">
                        You're live — trigger games from the{' '}
                        <button onClick={() => navigate('/studio/live')} className="underline press">Live Dashboard</button>
                    </p>
                </div>
            )}
        </div>
    );
};
