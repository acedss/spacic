import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getSongs, upsertRoom } from '@/lib/roomService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import type { Song } from '@/types/types';

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
    title:           z.string().min(1, 'Room name is required').max(60, 'Max 60 characters'),
    streamGoalCoins: z.string()
        .refine((v) => v === '' || (Number(v) > 0 && Number.isInteger(Number(v))), {
            message: 'Must be a positive whole number',
        })
        .optional(),
    selectedIds: z.array(z.string()).min(1, 'Pick at least one song'),
});

type FormValues = z.infer<typeof schema>;

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

const CreateRoomModal = ({ isOpen, onClose }: Props) => {
    const navigate = useNavigate();
    const [songs, setSongs] = useState<Song[]>([]);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { title: '', streamGoalCoins: '', selectedIds: [] },
    });

    const { watch, setValue, reset } = form;
    const selectedIds = watch('selectedIds');

    // Reset form and fetch songs each time modal opens
    useEffect(() => {
        if (!isOpen) return;
        reset();
        getSongs().then(setSongs).catch(() => {});
    }, [isOpen, reset]);

    const toggleSong = (id: string) => {
        setValue(
            'selectedIds',
            selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id],
            { shouldValidate: true }
        );
    };

    const onSubmit = async (values: FormValues) => {
        const streamGoal = values.streamGoalCoins ? Math.max(0, parseInt(values.streamGoalCoins, 10)) : 0;
        const room = await upsertRoom({ title: values.title.trim(), playlistIds: values.selectedIds, streamGoal });
        onClose();
        navigate(`/rooms/${room._id}`);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">Create a Room</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                        {/* Title */}
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-zinc-400">Room name</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="e.g. Late Night Vibes"
                                            className="bg-zinc-800 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-purple-500"
                                        />
                                    </FormControl>
                                    <FormMessage className="text-red-400 text-xs" />
                                </FormItem>
                            )}
                        />

                        {/* Stream goal */}
                        <FormField
                            control={form.control}
                            name="streamGoalCoins"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-zinc-400">
                                        Stream goal <span className="text-zinc-600">(optional, in coins)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="number"
                                            min="1"
                                            step="1"
                                            placeholder="e.g. 1000"
                                            className="bg-zinc-800 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-purple-500"
                                        />
                                    </FormControl>
                                    <FormDescription className="text-xs text-zinc-600">
                                        Listeners can donate coins toward this goal.
                                    </FormDescription>
                                    <FormMessage className="text-red-400 text-xs" />
                                </FormItem>
                            )}
                        />

                        {/* Song selection */}
                        <FormField
                            control={form.control}
                            name="selectedIds"
                            render={() => (
                                <FormItem>
                                    <div className="flex items-center justify-between">
                                        <FormLabel className="text-zinc-400">Playlist</FormLabel>
                                        <span className="text-xs text-purple-400">{selectedIds.length} selected</span>
                                    </div>
                                    <ScrollArea className="max-h-60 rounded-xl border border-white/5">
                                        <div className="space-y-1.5 p-2">
                                            {songs.length === 0 ? (
                                                <p className="text-zinc-500 text-sm py-4 text-center">Loading songs...</p>
                                            ) : (
                                                songs.map((song) => {
                                                    const selected = selectedIds.includes(song._id);
                                                    return (
                                                        <button
                                                            key={song._id}
                                                            type="button"
                                                            onClick={() => toggleSong(song._id)}
                                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors text-left
                                                                ${selected ? 'bg-purple-600/20 ring-1 ring-purple-500' : 'bg-zinc-800 hover:bg-zinc-700'}`}
                                                        >
                                                            <img src={song.imageUrl} alt={song.title} className="size-10 rounded-lg object-cover shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-white text-sm font-medium truncate">{song.title}</p>
                                                                <p className="text-zinc-400 text-xs truncate">{song.artist}</p>
                                                            </div>
                                                            {selected && <div className="size-2 rounded-full bg-purple-400 shrink-0" />}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </ScrollArea>
                                    <FormMessage className="text-red-400 text-xs" />
                                </FormItem>
                            )}
                        />

                        <Button
                            type="submit"
                            disabled={form.formState.isSubmitting}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl"
                        >
                            {form.formState.isSubmitting ? 'Creating...' : 'Create Room'}
                        </Button>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default CreateRoomModal;
