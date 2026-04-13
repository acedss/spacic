import { useState } from 'react'

export const usePending = () => {
    const [pending, setPending] = useState<Set<string>>(new Set())
    const start = (id: string) => setPending((s) => new Set(s).add(id))
    const stop  = (id: string) => setPending((s) => { const n = new Set(s); n.delete(id); return n })
    const has   = (id: string) => pending.has(id)
    return { start, stop, has }
}
