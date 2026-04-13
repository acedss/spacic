import { Check, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const FREE_FEATURES = [
    'Join any public room',
    'Chat & send reactions',
    'Up to 10 listeners in your room',
    'Basic audio quality',
]

export const FreePlanCard = ({ isCurrentPlan }: { isCurrentPlan: boolean }) => (
    <div className={cn(
        'relative flex flex-col rounded-2xl border border-white/10 p-6 bg-white/5',
        isCurrentPlan && 'ring-2 ring-white/20',
    )}>
        <div className="flex items-start justify-between mb-6">
            <div className="rounded-xl p-2.5 bg-white/5">
                <Zap className="size-5 text-zinc-400" />
            </div>
            {isCurrentPlan && (
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/10 text-zinc-400">
                    Current Plan
                </span>
            )}
        </div>

        <h3 className="text-lg font-bold text-white mb-1">Free</h3>
        <div className="mb-4">
            <span className="text-3xl font-bold text-white">$0</span>
            <span className="text-zinc-500 text-sm"> / mo</span>
        </div>

        <ul className="flex flex-col gap-2.5 my-2 flex-1">
            {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-400">
                    <Check className="size-4 mt-0.5 flex-shrink-0 text-zinc-600" />
                    {f}
                </li>
            ))}
        </ul>

        <Button disabled variant="ghost" className="mt-5 w-full bg-white/5 text-zinc-600 cursor-default rounded-xl">
            {isCurrentPlan ? 'Current Plan' : 'Free'}
        </Button>
    </div>
)
