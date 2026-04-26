import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
    cycle: 'monthly' | 'yearly';
    onChange: (cycle: 'monthly' | 'yearly') => void;
}

export const BillingToggle = ({ cycle, onChange }: Props) => (
    <div className="flex items-center justify-center gap-3 mt-6">
        <Label htmlFor="billing-toggle" className={cn('text-sm cursor-pointer', cycle === 'monthly' ? 'text-white' : 'text-zinc-500')}>
            Monthly
        </Label>
        <Switch
            id="billing-toggle"
            checked={cycle === 'yearly'}
            onCheckedChange={checked => onChange(checked ? 'yearly' : 'monthly')}
            className="data-[state=checked]:bg-purple-500"
        />
        <Label htmlFor="billing-toggle" className={cn('text-sm flex items-center gap-1.5 cursor-pointer', cycle === 'yearly' ? 'text-white' : 'text-zinc-500')}>
            Yearly
            <Badge className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20">
                Save 20%
            </Badge>
        </Label>
    </div>
);
