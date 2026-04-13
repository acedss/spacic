import { useEffect, useRef, useState } from 'react'
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader,
    AlertDialogTitle, AlertDialogDescription, AlertDialogFooter,
    AlertDialogCancel,
} from '@/components/ui/alert-dialog'

export const GoLiveDialog = ({
    open,
    onCancel,
    onConfirm,
}: {
    open: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) => {
    const [count, setCount] = useState(5)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (!open) { setCount(5); return }
        setCount(5)
        timerRef.current = setInterval(() => setCount(p => {
            if (p <= 1) { clearInterval(timerRef.current!); return 0 }
            return p - 1
        }), 1000)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [open])

    useEffect(() => { if (open && count === 0) onConfirm() }, [count, open, onConfirm])

    return (
        <AlertDialog open={open}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Going Live</AlertDialogTitle>
                    <AlertDialogDescription>
                        Your room will go live and listeners will be notified. Ready?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex justify-center py-4">
                    <div className="relative size-20">
                        <svg className="size-20 -rotate-90" viewBox="0 0 80 80">
                            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                            <circle
                                cx="40" cy="40" r="34" fill="none" stroke="#ef4444" strokeWidth="6"
                                strokeDasharray={`${2 * Math.PI * 34}`}
                                strokeDashoffset={`${2 * Math.PI * 34 * (1 - count / 5)}`}
                                strokeLinecap="round" className="transition-all duration-1000"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-3xl font-bold text-white tabular-nums">{count}</span>
                        </div>
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
                    <button
                        onClick={onConfirm}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-400 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                        <span className="size-1.5 rounded-full bg-white animate-pulse" />
                        Go Live Now
                    </button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
