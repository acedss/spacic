import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';
import { SHORTCUT_GROUPS } from '@/hooks/useKeyboardShortcuts';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ShortcutsOverlay = ({ open, onOpenChange }: Props) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-md">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white">
                    <Keyboard className="size-4 text-violet-400" /> Keyboard shortcuts
                </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 py-2">
                {SHORTCUT_GROUPS.map(group => (
                    <div key={group.title} className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-(--fg-3) font-semibold">
                            {group.title}
                        </p>
                        <div className="space-y-1.5">
                            {group.items.map(item => (
                                <div key={item.desc} className="flex items-center justify-between text-xs">
                                    <span className="text-(--fg-2)">{item.desc}</span>
                                    <div className="flex items-center gap-1">
                                        {item.keys.map(k => (
                                            <kbd
                                                key={k}
                                                className="mono px-2 py-0.5 rounded-md bg-white/8 border border-white/10 text-[10px] text-white min-w-[24px] text-center"
                                            >
                                                {k}
                                            </kbd>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <p className="text-[10px] text-(--fg-3) pt-2 border-t border-white/8">
                Tip: shortcuts are disabled while typing in chat or input fields.
            </p>
        </DialogContent>
    </Dialog>
);
