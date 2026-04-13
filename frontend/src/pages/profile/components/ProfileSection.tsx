import { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { AtSign, Check, Loader } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { axiosInstance } from '@/lib/axios'

export const ProfileSection = () => {
    const { user } = useUser()
    const [input, setInput] = useState(user?.username ?? '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saved, setSaved] = useState(false)

    const current = user?.username ?? null
    const unchanged = input === (current ?? '')

    useEffect(() => { setInput(current ?? '') }, [current])

    const handleSave = async () => {
        setError(null)
        if (!/^[a-z0-9_]{3,20}$/.test(input)) {
            setError('3–20 chars, lowercase letters, numbers, or underscores only')
            return
        }
        setSaving(true)
        try {
            await axiosInstance.patch('/auth/username', { username: input })
            await user?.reload()
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            setError(msg ?? 'Failed to save username')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-8 max-w-2xl">
            <div className="flex items-center gap-5">
                <img
                    src={user?.imageUrl}
                    alt={user?.fullName ?? ''}
                    className="size-20 rounded-2xl object-cover ring-2 ring-white/10"
                />
                <div>
                    <h2 className="text-xl font-bold text-white">{user?.fullName}</h2>
                    {current && (
                        <p className="text-sm text-zinc-500 mt-0.5">@{current}</p>
                    )}
                    <p className="text-xs text-zinc-600 mt-1">
                        {user?.primaryEmailAddress?.emailAddress}
                    </p>
                </div>
            </div>

            <Separator className="bg-white/10" />

            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-white">Username</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                        Friends can search for you by{' '}
                        <span className="text-purple-400">@username</span>
                    </p>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
                        <Input
                            value={input}
                            onChange={(e) => { setInput(e.target.value.toLowerCase()); setError(null) }}
                            placeholder="e.g. spacic_fan"
                            maxLength={20}
                            className="pl-8 bg-zinc-800 border-white/10 text-white placeholder:text-zinc-600 focus-visible:ring-purple-500/50"
                        />
                    </div>
                    <Button
                        onClick={handleSave}
                        disabled={saving || unchanged}
                        className={cn(
                            'shrink-0 transition-all',
                            saved
                                ? 'bg-green-500 hover:bg-green-500 text-white'
                                : 'bg-purple-600 hover:bg-purple-500 text-white',
                        )}
                    >
                        {saving ? <Loader className="size-4 animate-spin" />
                            : saved ? <><Check className="size-4" /> Saved</>
                                : 'Save'}
                    </Button>
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
        </div>
    )
}
