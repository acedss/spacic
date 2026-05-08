import { SignedIn, SignedOut, SignInButton, useClerk, useUser } from '@clerk/clerk-react'
import { Gem, LogIn, LogOut, Search, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWalletStore } from '@/stores/useWalletStore'

export const HomeHeader = ({ onSearchOpen }: { onSearchOpen: () => void }) => {
    const navigate = useNavigate()
    const { user } = useUser()
    const { signOut } = useClerk()
    const { balance } = useWalletStore()

    return (
        <div className="sticky top-0 z-20 flex items-center gap-4 px-10 h-16 border-b hair glass">
            <button onClick={onSearchOpen} className="flex items-center gap-2 flex-1 text-left">
                <Search className="size-3.5 shrink-0" style={{ color: 'var(--fg-3)' }} />
                <span className="text-[13px] w-105 truncate text-zinc-300">Search rooms, creators, songs…</span>
                <kbd className="mono text-[10px] px-2 py-0.5 rounded-md ring-1 ring-white/10 ml-auto" style={{ color: 'var(--fg-3)', background: 'var(--ink-2)' }}>⌘K</kbd>
            </button>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => navigate('/studio')}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium text-white hover:bg-white/8 transition-colors"
                >
                    <Zap className="size-3" /> Go live
                </button>
                <button className="h-9 w-9 rounded-full grid place-items-center text-[oklch(0.88_0.12_75)] hover:bg-white/8 transition-colors">
                    <Gem className="size-4" />
                </button>
                <span className="mono text-[11px] text-white">{balance > 0 ? balance.toLocaleString() : '0'}</span>
                <div className="h-5 w-px bg-white/10 mx-1" />
                <SignedIn>
                    <button
                        onClick={() => signOut()}
                        title="Sign out"
                        className="relative group">
                        <img
                            src={user?.imageUrl}
                            alt=""
                            className="w-8 h-8 rounded-full ring-1 ring-white/15 object-cover transition-opacity group-hover:opacity-70"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white grid place-items-center ring-2 ring-[var(--ink-0)]">
                            <LogOut className="size-2.5 text-black" />
                        </span>
                    </button>
                </SignedIn>
                <SignedOut>
                    <SignInButton mode="modal">
                        <button
                            title="Sign in"
                            className="h-8 w-8 rounded-full ring-1 ring-white/15 grid place-items-center bg-white/5 hover:bg-white/10 transition-colors">
                            <LogIn className="size-4 text-white" />
                        </button>
                    </SignInButton>
                </SignedOut>
            </div>
        </div>
    )
}
