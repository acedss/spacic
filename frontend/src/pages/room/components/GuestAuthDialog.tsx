// GuestAuthDialog — shown to unauthed visitors on room pages
// Prompts sign-in/sign-up, dismissible
import { useClerk } from '@clerk/clerk-react'
import { useLocation } from 'react-router-dom'
import { Radio, SkipForward } from 'lucide-react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
    open:         boolean
    onOpenChange: (open: boolean) => void
    roomTitle?:   string
}

export const GuestAuthDialog = ({ open, onOpenChange, roomTitle }: Props) => {
    const { openSignIn, openSignUp } = useClerk()
    const location = useLocation()

    const handleSignIn = () => {
        onOpenChange(false)
        openSignIn({ fallbackRedirectUrl: location.pathname })
    }

    const handleSignUp = () => {
        onOpenChange(false)
        openSignUp({ fallbackRedirectUrl: location.pathname })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-white/10 text-white max-w-sm">
                {/* Dismiss X is built into DialogContent by default */}
                <DialogHeader>
                    <div className="flex items-center justify-center mb-3">
                        <div className="bg-violet-500/15 rounded-2xl p-4">
                            <Radio className="size-7 text-violet-400" />
                        </div>
                    </div>
                    <DialogTitle className="text-center text-white text-lg">
                        Join the room
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-1">
                    {roomTitle && (
                        <p className="text-center text-zinc-400 text-sm">
                            Sign in to listen live, chat, and support <span className="text-white font-medium">{roomTitle}</span>
                        </p>
                    )}

                    <div className="space-y-2">
                        <Button
                            onClick={handleSignUp}
                            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold"
                        >
                            Create free account
                        </Button>
                        <Button
                            onClick={handleSignIn}
                            variant="ghost"
                            className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10"
                        >
                            Sign in
                        </Button>
                    </div>

                    <button
                        onClick={() => onOpenChange(false)}
                        className="flex items-center justify-center gap-1.5 w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
                    >
                        <SkipForward className="size-3" />
                        Continue as guest (read-only)
                    </button>

                    <p className="text-center text-[11px] text-zinc-700">
                        Free forever · No credit card required to sign up
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}
